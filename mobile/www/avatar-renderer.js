// avatar-renderer.js
// Fase: avatar libre por toda la pantalla (mascota de escritorio).
//
// HONESTIDAD TÉCNICA (importante): los assets son FOTOS de poses, no frames
// de caminata. El movimiento se SIMULA con tres trucos, no hay animación de
// huesos:
//   (a) "Flipbook" de 2 cuadros: alternar rápido flotando.jpg / dinamica.jpg
//       mientras se desplaza, para sugerir el paso.
//   (b) Interpolación suave de la posición con easing (nada de saltos secos).
//   (c) scaleX(-1) en la imagen según la dirección horizontal.
// El salto es un arco parabólico en translateY + squash & stretch (clásico de
// animación, no física real). Con solo 6 fotos por outfit, el resultado se ve
// "a saltitos" comparado con sprites reales — es lo mejor posible hoy, y la
// mejora real sería pedir más fotos de transición.

const avatar = document.getElementById('avatar-libre');
const imagen = document.getElementById('avatar-img');

// --- Poses (mismo mapa que renderer.js, para respetar la cadena de respaldo) --

const ARCHIVOS_POSE = {
  pensando: ['pensando.png', 'pensando.jpg'],
  saludo: ['saludo.png', 'saludo.jpg'],
  dinamica: ['flotando.png', 'flotando.jpg'],
  suspension: ['suspension.png', 'suspension.jpg'],
  flotando: ['flotando.png', 'flotando.jpg'],
  odjetando: ['odjetando.png', 'odjetando.jpg'],
};

// Frames de caminata generados con tools/generar_frames_caminata.py a partir
// de las poses existentes (paso intermedio entre flotando y dinamica).
// Cuatro cuadros alternando piernas -> flipbook convincente de caminata.
const FRAMES_CAMINAR = ['caminar1.png', 'caminar2.png', 'caminar3.png', 'caminar4.png'];
const FRAMES_CORRER = ['caminar2.png', 'caminar4.png']; // los más dinámicos
// Aviso honesto: los PNG se generan desde los JPG con tools/chroma_key_avatar.py
// (quita el croma verde). Si se agregan outfits nuevos, hay que correr ese
// script para que el avatar libre use transparencia.

const RESPALDO_POSE = {
  base: ['base', 'flotando', 'saludo', 'pensando'],
  pensando: ['pensando', 'base', 'flotando'],
  saludo: ['saludo', 'base', 'flotando'],
  dinamica: ['dinamica', 'flotando', 'suspension', 'base'],
  suspension: ['suspension', 'flotando', 'base'],
  flotando: ['flotando', 'suspension', 'base'],
  odjetando: ['odjetando', 'pensando', 'base', 'flotando'],
};

// El outfit activo se guarda en localStorage compartido con la ventana
// principal (misma sesión de Electron). Escuchamos 'storage' para reaccionar
// si la cambia desde allí, y además sondeamos cada 5 s por si el evento no
// llega (comportamiento inconsistente entre plataformas).
let modeloActual = localStorage.getItem('airaos_modelo_avatar') || 'default';
let modoAvatar = localStorage.getItem('airaos_modo_avatar') || '2d';

window.addEventListener('storage', (evento) => {
  if (evento.key === 'airaos_modelo_avatar' && evento.newValue) {
    modeloActual = evento.newValue;
    ponerPose(poseActual);
  }
  if (evento.key === 'airaos_modo_avatar' && evento.newValue) {
    modoAvatar = evento.newValue;
    document.getElementById('avatar-libre').classList.toggle('modo-3d', modoAvatar === '3d');
    window.dispatchEvent(new CustomEvent('airaos:modo-avatar', { detail: modoAvatar }));
  }
});

function aplicarModoAvatar() {
  document.getElementById('avatar-libre').classList.toggle('modo-3d', modoAvatar === '3d');
  window.dispatchEvent(new CustomEvent('airaos:modo-avatar', { detail: modoAvatar }));
}

setInterval(() => {
  const guardado = localStorage.getItem('airaos_modelo_avatar') || 'default';
  if (guardado !== modeloActual) {
    modeloActual = guardado;
    ponerPose(poseActual);
  }
  const modoGuardado = localStorage.getItem('airaos_modo_avatar') || '2d';
  if (modoGuardado !== modoAvatar) {
    modoAvatar = modoGuardado;
    aplicarModoAvatar();
  }
}, 5000);

// Devuelve la ruta de un frame de caminata, con respaldo al modelo default y
// luego a la pose flotando si el outfit no tiene frames generados.
function rutaFrameCaminar(indice, corriendo) {
  const frames = corriendo ? FRAMES_CORRER : FRAMES_CAMINAR;
  const archivo = frames[indice % frames.length];
  return `assets/avatar/${modeloActual}/${archivo}`;
}

// Pone un frame concreto de caminata en la imagen, con el mismo respaldo
// (outfit -> default) que las poses normales. Esta función faltaba y era la
// causa de que la caminata crasheara nada más empezar.
function ponerFrameCaminar(indice, corriendo) {
  const ruta = rutaFrameCaminar(indice, corriendo);
  if (imagen.getAttribute('src') === ruta) return;
  try {
    imagen.src = ruta;
    imagen.onerror = () => {
      imagen.onerror = null;
      if (modeloActual !== 'default') {
        modeloActual = 'default';
        imagen.src = rutaFrameCaminar(indice, corriendo);
      }
    };
  } catch (error) {
    console.warn('No se pudo poner el frame de caminata:', error);
  }
}

function rutaPose(nombrePose) {
  const candidatas = RESPALDO_POSE[nombrePose] || [nombrePose, 'base', 'flotando'];
  for (const candidata of candidatas) {
    const archivos = ARCHIVOS_POSE[candidata];
    if (archivos) {
      // Preferimos PNG (fondo transparente); si el outfit no lo tiene, JPG.
      // La existencia real la verifica imagen.onerror en ponerPose().
      return `assets/avatar/${modeloActual}/${archivos[0]}`;
    }
  }
  return `assets/avatar/${modeloActual}/flotando.png`;
}

let poseActual = 'flotando';

function ponerPose(nombrePose) {
  poseActual = nombrePose;
  const ruta = rutaPose(nombrePose);
  if (imagen.getAttribute('src') === ruta) return;
  try {
    imagen.src = ruta;
    // Si el outfit no tiene la pose, caemos al modelo default (igual que
    // hace la ventana principal) — nunca una imagen rota.
    imagen.onerror = () => {
      imagen.onerror = null;
      if (modeloActual !== 'default') {
        console.warn(`Falta ${ruta}; usando modelo default.`);
        modeloActual = 'default';
        imagen.src = rutaPose(nombrePose);
      }
    };
  } catch (error) {
    console.warn('No se pudo poner la pose:', error);
  }
}

// --- Máquina de estados ------------------------------------------------------
//  reposo -> caminando | corriendo | saltando -> reposo -> ...
// Los tiempos de espera SIEMPRE son aleatorios dentro de un rango, para que
// no se sienta robótica.

const ESTADO = {
  REPOSO: 'reposo',
  CAMINANDO: 'caminando',
  CORRIENDO: 'corriendo',
  SALTANDO: 'saltando',
  ENTRANDO: 'entrando',   // camina desde fuera de pantalla hasta su sitio
  SALIENDO: 'saliendo',   // se va caminando fuera de pantalla a descansar
  FUERA: 'fuera',         // fuera de vista; vuelve después de un rato
};

let estado = ESTADO.REPOSO;
let ocupada = false; // AIRA hablando/escuchando/pensando -> solo reposo
let bailando = false; // música sonando -> movimiento tipo baile
let ciclosReposo = 0; // cuántas veces seguidas quedó en reposo (para aburrirse)
let temporizadorEstado = null;
let tiempoEnEstado = 0;
let relojFrames = 0;
let indiceFrame = 0;
let arrastrando = false;
let ultimaDireccion = 1;

function aleatorio(min, max) {
  return min + Math.random() * (max - min);
}

// --- Posición y movimiento ---------------------------------------------------

const TAM_AVATAR = 130;

// El "suelo" es una franja baja de la pantalla: caminar por ahí se ve como
// una mascota de verdad. Flotar por toda la pantalla queda reservado para
// estados ocasionales (suspension) — no como movimiento por defecto.
const NIVEL_SUELO = () => Math.max(window.innerHeight - TAM_AVATAR - aleatorio(0, 40), 0);

let posX = Math.max(window.innerWidth - 220, 0);
let posY = 0;
let objetivoX = posX;
let objetivoY = 0;
let velocidad = 60; // px por segundo (caminar); correr la sube

// NOTA: la deriva libre por toda la pantalla se QUITÓ — era la causa de que
// AIRA "flotara descontroladamente". Ahora vive anclada al suelo; 'suspension'
// solo se usa como pose de levitación EN SU SITIO (con la respiración sutil),
// nunca para viajar por el escritorio.
function fijarEnSuelo() {
  posY = NIVEL_SUELO();
  objetivoY = posY;
}
fijarEnSuelo();

// Movimiento con easing: en vez de teleportarnos al objetivo, cada frame
// acercamos la posición una fracción proporcional a la distancia y al tiempo
// (interpolación exponencial). Se ve mucho más natural que velocidad fija.
function pasoMovimiento(dtSegundos) {
  const suavizado = 1 - Math.exp(-(velocidad / 90) * dtSegundos * 4);
  posX += (objetivoX - posX) * suavizado;
  posY += (objetivoY - posY) * suavizado;
}

function actualizarFrameCaminata(dtSegundos) {
  if (estado !== ESTADO.CAMINANDO && estado !== ESTADO.CORRIENDO) return;
  const intervalo = estado === ESTADO.CORRIENDO ? 0.13 : 0.22;
  relojFrames += dtSegundos;
  if (relojFrames < intervalo) return;
  relojFrames -= intervalo;
  indiceFrame = (indiceFrame + 1) % (estado === ESTADO.CORRIENDO ? FRAMES_CORRER.length : FRAMES_CAMINAR.length);
  ponerFrameCaminar(indiceFrame, estado === ESTADO.CORRIENDO);
}

function ponerEnBordes(x, y) {
  const xMax = Math.max(window.innerWidth - TAM_AVATAR, 0);
  const yMax = Math.max(window.innerHeight - TAM_AVATAR, 0);
  return {
    x: Math.min(Math.max(x, 0), xMax),
    y: Math.min(Math.max(y, 0), yMax),
  };
}

// --- Salto: arco parabólico + squash & stretch (truco clásico) ---------------

let saltoActivo = null; // { inicio, duracion, altura }

function iniciarSalto() {
  saltoActivo = { inicio: performance.now(), duracion: aleatorio(600, 850), altura: aleatorio(70, 120) };
}

function pasoSalto(ahora) {
  if (!saltoActivo) return;
  const progreso = (ahora - saltoActivo.inicio) / saltoActivo.duracion;
  if (progreso >= 1) {
    saltoActivo = null;
    return;
  }
  // Parábola: sin(t * PI) sube y baja suave.
  const elevacion = Math.sin(progreso * Math.PI) * saltoActivo.altura;
  const estirar = 1 + Math.sin(progreso * Math.PI) * 0.12;       // estira al despegar
  const achicar = progreso < 0.08 || progreso > 0.92 ? 0.9 : 1;  // squash al aterrizar
  avatar.style.setProperty('--salto-y', `${-elevacion}px`);
  avatar.style.setProperty('--salto-escala', String(achicar * estirar));
}

// --- Bucle principal (requestAnimationFrame) ---------------------------------

let ultimoFrame = performance.now();

function bucle(ahora) {
  const dt = Math.min((ahora - ultimoFrame) / 1000, 0.1);
  ultimoFrame = ahora;
  tiempoEnEstado += dt;

  if (estado === ESTADO.CAMINANDO || estado === ESTADO.CORRIENDO) {
    pasoMovimiento(dt);
    actualizarFrameCaminata(dt);
    // ¿Llegó (aprox) al objetivo? -> de vuelta a reposo.
    if (Math.hypot(objetivoX - posX, objetivoY - posY) < 4) {
      ponerEstado(ESTADO.REPOSO);
    } else if (estado === ESTADO.CAMINANDO && tiempoEnEstado > 1.2 && Math.random() < 0.0025) {
      // Rara vez, un salto a mitad del camino (probabilidad por frame).
      ponerPose('suspension');
      iniciarSalto();
    }
  }

  if (saltoActivo) pasoSalto(ahora);

  // Flip según dirección horizontal (con zona muerta para no vibrar).
  const dx = objetivoX - posX;
  if (Math.abs(dx) > 6) {
    ultimaDireccion = dx < 0 ? -1 : 1;
    imagen.style.setProperty('--direccion', String(ultimaDireccion));
  }

  // Aplicamos la posición. El salto usa una variable CSS que se combina con
  // transform (declarada en el CSS) para no recalcular layout cada frame.
  const { x, y } = ponerEnBordes(posX, posY);
  avatar.style.left = `${x}px`;
  avatar.style.top = `${y}px`;

  requestAnimationFrame(bucle);
}

// --- Transiciones de estado --------------------------------------------------

function elegirDestino() {
  const margen = 20;
  // Caminar/correr: se queda pegada al suelo, solo cambia el X.
  objetivoX = aleatorio(margen, Math.max(window.innerWidth - TAM_AVATAR - margen, margen));
  objetivoY = posY; // mantiene la altura actual (nivel del suelo)
}

function detenerTemporizadores() {
  if (temporizadorEstado) clearTimeout(temporizadorEstado);
  temporizadorEstado = null;
}

function ponerEstado(nuevo) {
  detenerTemporizadores();
  estado = nuevo;
  tiempoEnEstado = 0;
  window.dispatchEvent(new CustomEvent('airaos:avatar-estado', { detail: nuevo }));

  try {
    if (nuevo === ESTADO.REPOSO) {
      velocidad = 0;
      ciclosReposo++;
      avatar.style.setProperty('--salto-y', '0px');
      avatar.style.setProperty('--salto-escala', '1');
      avatar.classList.remove('mirando'); // por si venimos de un mirar alrededor
      avatar.classList.add('idle'); // respiración sutil (ver avatar.html)
      fijarEnSuelo();
      // Consciente y con carácter: de pie la mayoría del tiempo; a veces
      // piensa; si lleva demasiado sin nada que hacer, se ABURRE (odjetando)
      // y muy de vez en cuando te saluda ella sola. Nunca deriva por la pantalla.
      let pose = 'flotando';
      if (ciclosReposo >= 3 && Math.random() < 0.55) {
        pose = 'odjetando'; // aburrida: se quedó sin nada que hacer
      } else if (Math.random() < 0.28) {
        pose = 'pensando';
      } else if (Math.random() < 0.10) {
        pose = 'saludo'; // saludito espontáneo al pasar
      }
      ponerPose(pose);
      // De vez en cuando, mientras está de pie, "mira alrededor" (inclinación
      // sutil animada). Solo si no está aburrida: aburrida se queda quieta.
      if (pose !== 'odjetando' && Math.random() < 0.45) {
        avatar.classList.remove('idle');
        avatar.classList.add('mirando');
      }
      // Espera aleatoria antes de la siguiente acción: nunca un ritmo fijo.
      // Aburrida se espera más tiempo (no tiene prisa por nada).
      temporizadorEstado = setTimeout(
        siguienteAccion,
        pose === 'odjetando' ? aleatorio(6000, 12000) : aleatorio(2500, 7000)
      );
    } else if (nuevo === ESTADO.CAMINANDO || nuevo === ESTADO.CORRIENDO) {
      ciclosReposo = 0;
      avatar.classList.remove('idle');
      avatar.classList.remove('mirando');
      elegirDestino();
      const corriendo = nuevo === ESTADO.CORRIENDO;
      velocidad = corriendo ? aleatorio(200, 280) : aleatorio(70, 110);
      relojFrames = 0;
      indiceFrame = 0;
      ponerFrameCaminar(0, corriendo);
      // Red de seguridad: si por algo no llega al objetivo, se cansa sola.
      temporizadorEstado = setTimeout(() => ponerEstado(ESTADO.REPOSO), aleatorio(6000, 12000));
    } else if (nuevo === ESTADO.SALTANDO) {
      ciclosReposo = 0;
      avatar.classList.remove('idle');
      ponerPose('suspension');
      iniciarSalto();
      temporizadorEstado = setTimeout(() => ponerEstado(ESTADO.REPOSO), 1000);
    }
  } catch (error) {
    console.warn('Error en la máquina de estados del avatar:', error);
    ponerEstado(ESTADO.REPOSO);
  }
}

function siguienteAccion() {
  if (ocupada) {
    // AIRA está hablando/escuchando: se queda quieta, en reposo.
    temporizadorEstado = setTimeout(siguienteAccion, aleatorio(1500, 3000));
    return;
  }
  const dado = Math.random();
  if (dado < 0.08) {
    ponerEstado(ESTADO.SALTANDO);
  } else if (dado < 0.26) {
    // Correr solo de vez en cuando (~1 de cada 4 desplazamientos).
    ponerEstado(ESTADO.CORRIENDO);
  } else {
    ponerEstado(ESTADO.CAMINANDO);
  }
}

// Sondeo de "ocupada" desde la ventana principal (vía main.js).
// AVISO: depende de executeJavaScript sobre la ventana principal; si esa
// ventana se cierra, devolverá false y el avatar seguirá con su vida.
setInterval(async () => {
  try {
    const valor = await window.airaos.avatarEstaOcupada();
    const antes = ocupada;
    ocupada = Boolean(valor);
    if (!antes && ocupada) ponerEstado(ESTADO.REPOSO);
  } catch {}
}, 1500);

// AIRA habla/escucha/CANTA: la ventana principal ya emite 'voz:estado' por IPC.
// 'bailando' es un estado nuevo que solo usa el reproductor de música (Fase 4).
// Reutilizamos el mismo canal para no inventar IPC extra.
window.airaos.alCambiarEstadoVoz((estadoVoz) => {
  const estabaOcupada = ocupada;
  const elementoAvatar = document.getElementById('avatar-libre');
  elementoAvatar.classList.toggle('hablando', estadoVoz === 'hablando');
  elementoAvatar.classList.toggle('escuchando', estadoVoz === 'escuchando');
  elementoAvatar.classList.toggle('reaccionando', estadoVoz === 'hablando' || estadoVoz === 'escuchando');
  window.dispatchEvent(new CustomEvent('airaos:voz-estado', { detail: estadoVoz }));
  if (estadoVoz === 'bailando') {
    // Mientras suena la canción, AIRA se mueve al ritmo: flipbook rápido +
    // saltitos. No es coreografía real — es un flipbook acelerado.
    bailando = true;
    ponerEstado(ESTADO.CORRIENDO); // reutiliza el movimiento rápido como "baile"
    return;
  }
  if (estadoVoz === 'reposo' && bailando) {
    // La música se paró: vuelve a la normalidad de inmediato.
    bailando = false;
    ponerEstado(ESTADO.REPOSO);
    return;
  }
  ocupada = estadoVoz === 'hablando' || estadoVoz === 'escuchando';
  if (!estabaOcupada && ocupada) ponerEstado(ESTADO.REPOSO);
});

// --- Interacción: clic y arrastre -------------------------------------------
//
// La ventana ignora el mouse por defecto (click-through). Solo cuando el
// cursor está sobre el avatar avisamos a main.js para que deje de ignorarlo;
// ahí sí recibimos mousedown/mousemove y podemos arrastrar o hacer clic.

let distanciaArrastre = 0;
let ultimoScreen = { x: 0, y: 0 };

function cursorSobreAvatar(evento) {
  const rect = avatar.getBoundingClientRect();
  // Un pelín de margen para que sea fácil de agarrar.
  return (
    evento.clientX >= rect.left - 8 && evento.clientX <= rect.right + 8 &&
    evento.clientY >= rect.top - 8 && evento.clientY <= rect.bottom + 8
  );
}

document.addEventListener('mousemove', (evento) => {
  try {
    window.airaos.avatarRatonEncima(cursorSobreAvatar(evento));

    if (arrastrando) {
      window.airaos.avatarArrastreMover({ x: evento.screenX, y: evento.screenY });
      const dx = evento.screenX - ultimoScreen.x;
      const dy = evento.screenY - ultimoScreen.y;
      distanciaArrastre += Math.hypot(dx, dy);
      ultimoScreen = { x: evento.screenX, y: evento.screenY };
      // El avatar sigue al cursor mientras se arrastra.
      posX += dx;
      posY += dy;
      objetivoX = posX;
      objetivoY = posY;
    }
  } catch {}
});

avatar.addEventListener('mousedown', (evento) => {
  if (evento.button !== 0) return;
  arrastrando = true;
  ciclosReposo = 0;
  avatar.classList.remove('idle');
  distanciaArrastre = 0;
  ultimoScreen = { x: evento.screenX, y: evento.screenY };
  avatar.classList.add('arrastrando');
  ponerEstado(ESTADO.REPOSO); // se queda quieto mientras la agarras
  try {
    window.airaos.avatarArrastreInicio({ x: evento.screenX, y: evento.screenY });
  } catch {}
});

document.addEventListener('mouseup', () => {
  if (!arrastrando) return;
  arrastrando = false;
  avatar.classList.remove('arrastrando');
  try {
    window.airaos.avatarArrastreFin();
  } catch {}
  // Si apenas se movió, fue un CLIC, no un arrastre: saluda (pose saludo)
  // y abre la ventana principal, igual que hace la burbuja.
  if (distanciaArrastre < 6) {
    ponerPose('saludo');
    setTimeout(() => {
      if (estado === ESTADO.REPOSO) ponerPose('flotando');
    }, 1800);
    try {
      window.airaos.avatarClic();
    } catch {}
  }
});

// Informamos dónde está el avatar (útil para depurar desde main.js).
function reportarRegion() {
  try {
    const rect = avatar.getBoundingClientRect();
    window.airaos.avatarRegion({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  } catch {}
}
setInterval(reportarRegion, 1000);

// --- Arranque ---------------------------------------------------------------

aplicarModoAvatar();
ponerEstado(ESTADO.REPOSO);
requestAnimationFrame(bucle);
