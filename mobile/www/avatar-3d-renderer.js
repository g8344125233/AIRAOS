import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

const contenedor = document.getElementById('avatar-libre');
const canvas = document.getElementById('avatar-3d');
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
const reloj = new THREE.Clock();
const luzClave = new THREE.DirectionalLight(0xffffff, 2.4);
const luzRelleno = new THREE.HemisphereLight(0xd9ccff, 0x201a2e, 1.4);
let vrm = null;
let mezclador = null;
let caminando = false;
let hablando = false;
let cargando = false;
let huesosMarcha = null;

const MODELOS_3D = {
  default: '../models/aira_default.vrm',
  pijama: '../models/outfits/aira_base pijama.vrm',
  primavera: '../models/outfits/aira_base primavera.vrm',
  elegante: '../models/outfits/aira_vestido elegante azul.vrm',
  cyber: '../models/aira_default.vrm',
  gotico: '../models/outfits/aira_vestido dark alice.vrm',
};

luzClave.position.set(1, 2, 3);
escena.add(luzClave, luzRelleno);
camara.position.set(0, 1.05, 4.2);

function ajustarTamano() {
  const ancho = Math.max(contenedor.clientWidth, 1);
  const alto = Math.max(contenedor.clientHeight, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(ancho, alto, false);
  camara.aspect = ancho / alto;
  camara.updateProjectionMatrix();
}

function rutaModeloActual() {
  const id = localStorage.getItem('airaos_modelo_avatar') || 'default';
  return MODELOS_3D[id] || MODELOS_3D.default;
}

function prepararHuesos() {
  if (!vrm?.humanoid) {
    huesosMarcha = null;
    return;
  }
  const hueso = (nombre) => vrm.humanoid.getNormalizedBoneNode(nombre);
  huesosMarcha = {
    brazoIzquierdo: hueso('leftUpperArm'),
    brazoDerecho: hueso('rightUpperArm'),
    antebrazoIzquierdo: hueso('leftLowerArm'),
    antebrazoDerecho: hueso('rightLowerArm'),
    piernaIzquierda: hueso('leftUpperLeg'),
    piernaDerecha: hueso('rightUpperLeg'),
    rodillaIzquierda: hueso('leftLowerLeg'),
    rodillaDerecha: hueso('rightLowerLeg'),
    columna: hueso('spine'),
  };
}

function descargarModeloAnterior() {
  if (!vrm) return;
  escena.remove(vrm.scene);
  vrm.scene.traverse((objeto) => {
    objeto.geometry?.dispose();
    if (Array.isArray(objeto.material)) objeto.material.forEach((material) => material.dispose());
    else objeto.material?.dispose();
  });
  vrm = null;
  mezclador = null;
  huesosMarcha = null;
}

function cargarModelo() {
  if (cargando) return;
  descargarModeloAnterior();
  cargando = true;
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.load(rutaModeloActual(), (gltf) => {
    vrm = gltf.userData.vrm;
    vrm.scene.rotation.y = Math.PI;
    vrm.scene.position.y = -1.05;
    vrm.scene.scale.setScalar(1.45);
    escena.add(vrm.scene);
    prepararHuesos();
    if (gltf.animations?.length) {
      mezclador = new THREE.AnimationMixer(vrm.scene);
      for (const clip of gltf.animations) mezclador.clipAction(clip).play();
    }
    cargando = false;
  }, undefined, (error) => {
    console.warn('No se pudo cargar el outfit VRM; se conserva el avatar 2D.', error);
    cargando = false;
    localStorage.setItem('airaos_modo_avatar', '2d');
    aplicarModoAvatarSeguro('2d');
  });
}

function aplicarModoAvatarSeguro(modo) {
  contenedor.classList.toggle('modo-3d', modo === '3d');
  if (modo === '3d') cargarModelo();
}

window.addEventListener('airaos:modo-avatar', (evento) => aplicarModoAvatarSeguro(evento.detail));
window.addEventListener('storage', (evento) => {
  if (evento.key === 'airaos_modelo_avatar' && contenedor.classList.contains('modo-3d')) cargarModelo();
});
window.addEventListener('resize', ajustarTamano);
window.addEventListener('airaos:avatar-estado', (evento) => { caminando = evento.detail === 'caminando' || evento.detail === 'corriendo'; });
window.addEventListener('airaos:voz-estado', (evento) => {
  hablando = evento.detail === 'hablando' || evento.detail === 'escuchando';
});

function animar() {
  const delta = Math.min(reloj.getDelta(), 0.1);
  if (mezclador) mezclador.update(delta);
  if (vrm) {
    vrm.update(delta);
    const tiempo = performance.now() / 1000;
    const paso = caminando ? Math.sin(tiempo * 10) : Math.sin(tiempo * 1.4) * 0.08;
    if (huesosMarcha) {
      const amplitudPierna = caminando ? 0.38 : 0.025;
      const amplitudBrazo = caminando ? 0.22 : (hablando ? 0.06 : 0.015);
      huesosMarcha.piernaIzquierda.rotation.x = paso * amplitudPierna;
      huesosMarcha.piernaDerecha.rotation.x = -paso * amplitudPierna;
      huesosMarcha.rodillaIzquierda.rotation.x = Math.max(0, -paso) * 0.28;
      huesosMarcha.rodillaDerecha.rotation.x = Math.max(0, paso) * 0.28;
      huesosMarcha.brazoIzquierdo.rotation.x = -paso * amplitudBrazo;
      huesosMarcha.brazoDerecho.rotation.x = paso * amplitudBrazo;
      huesosMarcha.antebrazoIzquierdo.rotation.x = Math.max(0, paso) * 0.08;
      huesosMarcha.antebrazoDerecho.rotation.x = Math.max(0, -paso) * 0.08;
      huesosMarcha.columna.rotation.z = Math.sin(tiempo * 5) * (caminando ? 0.025 : (hablando ? 0.018 : 0.008));
      huesosMarcha.brazoIzquierdo.rotation.z = hablando ? Math.sin(tiempo * 2.1) * 0.035 : 0;
      huesosMarcha.brazoDerecho.rotation.z = hablando ? Math.sin(tiempo * 2.1 + 1.2) * 0.035 : 0;
    }
    const balanceo = caminando ? paso * 0.035 : Math.sin(tiempo * 1.4) * 0.012;
    vrm.scene.rotation.z = balanceo;
    vrm.scene.position.y = -1.05 + (caminando ? Math.abs(Math.sin(performance.now() / 110)) * 0.018 : 0);
  }
  renderer.render(escena, camara);
  requestAnimationFrame(animar);
}

ajustarTamano();
aplicarModoAvatarSeguro(localStorage.getItem('airaos_modo_avatar') || '2d');
animar();