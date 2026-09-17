// renderer.js
// Fase 2: memoria persistente, configuración de API key real, y voz
// (texto a voz, y micrófono).

// --- 1) Transición splash -> app -------------------------------------

const splash = document.getElementById('splash');
const app = document.getElementById('app');
const estadoTexto = document.getElementById('estado');

setTimeout(() => {
  estadoTexto.textContent = 'Núcleo listo.';
  setTimeout(async () => {
    splash.classList.add('oculto');
    app.classList.remove('oculto');
    mostrarPose('base');
    await iniciarChat(); // carga memoria y muestra el saludo o el historial
  }, 500);
}, 1400);

// --- 2) Estado del avatar (Fase 4: varios modelos) ----------------------
//
// Cada modelo 2D vive en su propia carpeta: src/assets/avatar/<modelo>/.
// No todos los modelos tienen todas las poses, así que si falta una, se cae
// a una pose equivalente que sí exista (para no mostrar una imagen rota).

const MODELOS_AVATAR = [
  { id: 'default',   nombre: 'Default',            descripcion: 'El modelo original de AIRA.' },
  { id: 'pijama',    nombre: 'Pijama',             descripcion: 'AIRA relajada, en pijama.' },
  { id: 'primavera', nombre: 'Primavera',          descripcion: 'AIRA con look de primavera.' },
  { id: 'elegante',  nombre: 'Elegante (amarillo)', descripcion: 'AIRA con vestido elegante.' },
  { id: 'cyber',     nombre: 'Cyber tecnológica',  descripcion: 'AIRA con estilo futurista.' },
  { id: 'gotico',    nombre: 'Gótico',             descripcion: 'AIRA con estilo gótico.' },
];

// Nombre de archivo por pose (igual en todas las carpetas) y el orden en que
// intentamos cada una: si una no existe, probamos la siguiente.
//
// OJO: "base.jpg" NO está en este mapa a propósito. En las 6 carpetas de
// outfits, ese archivo es en realidad una hoja de contacto con las 6 poses
// juntas (un error de origen en los assets), no una pose usable. Como el
// respaldo automático solo se activa si la imagen FALLA al cargar, y esa
// imagen sí carga bien (solo que su contenido está mal), el bug pasaba
// desapercibido. Al no listar "base" aquí, la cadena de respaldo de abajo
// salta directo a "flotando", que sí es una pose real en todos los outfits.
const ARCHIVOS_POSE = {
  pensando: 'pensando.jpg',
  saludo: 'saludo.jpg',
  dinamica: 'flotando.jpg',   // dynamic se ve como flotando
  suspension: 'suspension.jpg',
  flotando: 'flotando.jpg',
  odjetando: 'odjetando.jpg',
};

// Cadena de respaldo por pose: si el modelo no tiene la pose pedida, usa la
// primera de esta lista que exista en disco.
const RESPALDO_POSE = {
  base: ['base', 'flotando', 'saludo', 'pensando'],
  pensando: ['pensando', 'base', 'flotando'],
  saludo: ['saludo', 'base', 'flotando'],
  dinamica: ['dinamica', 'flotando', 'suspension', 'base'],
  suspension: ['suspension', 'flotando', 'base'],
  flotando: ['flotando', 'suspension', 'base'],
  odjetando: ['odjetando', 'pensando', 'base', 'flotando'],
};

let modeloAvatarActual = localStorage.getItem('airaos_modelo_avatar') || 'default';
const imgAvatar = document.getElementById('avatar');
let ocupada = false;

function carpetaModelo() {
  return `assets/avatar/${modeloAvatarActual}`;
}

// Construye la ruta de una pose para el modelo actual, aplicando el respaldo.
function rutaPose(nombrePose) {
  const candidatas = RESPALDO_POSE[nombrePose] || [nombrePose, 'base', 'flotando'];
  for (const candidata of candidatas) {
    const archivo = ARCHIVOS_POSE[candidata];
    if (archivo) return `${carpetaModelo()}/${archivo}`;
  }
  return `${carpetaModelo()}/flotando.jpg`;
}

function mostrarPose(nombrePose) {
  const ruta = rutaPose(nombrePose);
  imgAvatar.style.opacity = 0;
  setTimeout(() => {
    imgAvatar.src = ruta;
    imgAvatar.style.opacity = 1;
  }, 120);

  // Si la imagen no carga (archivo que falta), caemos al modelo por defecto
  // en vez de dejar un hueco roto. Nunca fallar en silencio visualmente.
  imgAvatar.onerror = () => {
    imgAvatar.onerror = null;
    if (modeloAvatarActual !== 'default') {
      console.warn(`Falta la imagen ${ruta}; usando el modelo default.`);
      modeloAvatarActual = 'default';
      imgAvatar.src = rutaPose(nombrePose);
    }
  };
}

const POSES_REPOSO = ['flotando', 'dinamica', 'suspension'];
let ultimaPoseReposo = 'flotando';

function cicloDeVida() {
  if (ocupada) return;
  let siguiente;
  do {
    siguiente = POSES_REPOSO[Math.floor(Math.random() * POSES_REPOSO.length)];
  } while (siguiente === ultimaPoseReposo);
  ultimaPoseReposo = siguiente;
  mostrarPose(siguiente);
}

function programarSiguienteCiclo() {
  const espera = 4000 + Math.random() * 4000;
  setTimeout(() => {
    cicloDeVida();
    programarSiguienteCiclo();
  }, espera);
}
programarSiguienteCiclo();

// --- Movimiento: AIRA "camina" sola por su panel ---------------------------
//
// Esto NO es animación de huesos (eso requiere el modelo 3D con
// animaciones reales, que dejamos para una fase aparte). Es un truco
// simple pero efectivo: mover el CONTENEDOR de un lado a otro del panel,
// dándole vida sin tocar la imagen de la pose en sí.

const avatarContenedor = document.getElementById('avatar-contenedor');
const panelAvatar = document.getElementById('panel-avatar');

let escalaActual = parseFloat(localStorage.getItem('airaos_avatar_escala')) || 1;
aplicarTransformAvatar();

function aplicarTransformAvatar(pasoPx) {
  if (typeof pasoPx === 'number') {
    avatarContenedor.style.setProperty('--paso', `${pasoPx}px`);
  }
  avatarContenedor.style.setProperty('--escala', escalaActual);
}

function programarPaseo() {
  const espera = 5000 + Math.random() * 5000;
  setTimeout(() => {
    if (!ocupada) {
      // Rango de movimiento relativo al ancho del panel, para que nunca
      // se salga (el panel tiene overflow:hidden como red de seguridad).
      const anchoPanel = panelAvatar.clientWidth;
      const margen = 45; // deja aire a los lados para que no se corte
      const rango = Math.max(anchoPanel / 2 - margen, 0);
      const paso = (Math.random() * 2 - 1) * rango; // entre -rango y +rango
      aplicarTransformAvatar(paso);
    }
    programarPaseo();
  }, espera);
}
programarPaseo();

// --- Zoom: rueda del mouse y gesto de pellizco (pantallas táctiles) --------

const ESCALA_MIN = 0.6;
const ESCALA_MAX = 2.2;

function cambiarEscala(delta) {
  escalaActual = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, escalaActual + delta));
  localStorage.setItem('airaos_avatar_escala', String(escalaActual));
  aplicarTransformAvatar();
}

avatarContenedor.addEventListener('wheel', (evento) => {
  evento.preventDefault();
  // Rueda hacia arriba = agrandar; hacia abajo = achicar.
  cambiarEscala(evento.deltaY < 0 ? 0.08 : -0.08);
}, { passive: false });

// Pellizco con dos dedos (pantallas táctiles). Si no hay pantalla táctil,
// estos eventos simplemente nunca se disparan — no rompe nada.
let distanciaPellizcoInicial = null;
let escalaAlIniciarPellizco = 1;

function distanciaEntreDedos(toques) {
  const [a, b] = toques;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

avatarContenedor.addEventListener('touchstart', (evento) => {
  if (evento.touches.length === 2) {
    distanciaPellizcoInicial = distanciaEntreDedos(evento.touches);
    escalaAlIniciarPellizco = escalaActual;
  }
});

avatarContenedor.addEventListener('touchmove', (evento) => {
  if (evento.touches.length === 2 && distanciaPellizcoInicial) {
    evento.preventDefault();
    const distanciaActual = distanciaEntreDedos(evento.touches);
    const factor = distanciaActual / distanciaPellizcoInicial;
    escalaActual = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, escalaAlIniciarPellizco * factor));
    localStorage.setItem('airaos_avatar_escala', String(escalaActual));
    aplicarTransformAvatar();
  }
}, { passive: false });

avatarContenedor.addEventListener('touchend', (evento) => {
  if (evento.touches.length < 2) distanciaPellizcoInicial = null;
});

// --- 3) Configuración (API key / proveedor) ------------------------------
//
// Se guarda en localStorage: es almacenamiento normal del navegador,
// y en Electron persiste en la carpeta de datos de la app en tu PC
// (no es un servicio externo, no sale de tu máquina).

function obtenerConfig() {
  return {
    proveedor: localStorage.getItem('airaos_proveedor') || 'mock',
    apiKey: localStorage.getItem('airaos_apikey') || '',
    endpointLocal: localStorage.getItem('airaos_endpoint_local') || 'http://127.0.0.1:11434',
    modeloLocal: localStorage.getItem('airaos_modelo_local') || 'qwen2.5:1.5b',
    // Fase 4: cómo quieres que AIRA se dirija a ti.
    nombreUsuario: localStorage.getItem('airaos_nombre') || '',
  };
}

function guardarConfig(proveedor, apiKey, nombreUsuario, endpointLocal, modeloLocal) {
  localStorage.setItem('airaos_proveedor', proveedor);
  localStorage.setItem('airaos_apikey', apiKey);
  localStorage.setItem('airaos_endpoint_local', endpointLocal || 'http://127.0.0.1:11434');
  localStorage.setItem('airaos_modelo_local', modeloLocal || 'qwen2.5:1.5b');
  localStorage.setItem('airaos_nombre', nombreUsuario || '');
}

const modalConfig = document.getElementById('modal-config');
const selectProveedor = document.getElementById('config-proveedor');
const inputApiKey = document.getElementById('config-apikey');
const inputEndpointLocal = document.getElementById('config-endpoint-local');
const inputModeloLocal = document.getElementById('config-modelo-local');
const inputNombreUsuario = document.getElementById('config-nombre');

document.getElementById('btn-config').addEventListener('click', () => {
  const config = obtenerConfig();
  selectProveedor.value = config.proveedor;
  inputApiKey.value = config.apiKey;
  inputEndpointLocal.value = config.endpointLocal;
  inputModeloLocal.value = config.modeloLocal;
  if (inputNombreUsuario) inputNombreUsuario.value = config.nombreUsuario;
  marcarPaletaActiva(localStorage.getItem('airaos_paleta_burbuja') || 'morado');
  modalConfig.classList.remove('oculto');
});

document.getElementById('config-cancelar').addEventListener('click', () => {
  modalConfig.classList.add('oculto');
});

document.getElementById('config-guardar').addEventListener('click', () => {
  guardarConfig(
    selectProveedor.value,
    inputApiKey.value.trim(),
    inputNombreUsuario ? inputNombreUsuario.value.trim() : '',
    inputEndpointLocal.value.trim(),
    inputModeloLocal.value.trim()
  );
  modalConfig.classList.add('oculto');
  agregarMensaje(
    selectProveedor.value === 'mock'
      ? 'Configuración guardada: seguiré usando respuestas de prueba.'
      : 'Configuración guardada. Ya puedes hablarme usando el modelo real.',
    'aira'
  );
});

// --- Paleta de colores de la burbuja ----------------------------------

const PALETAS_BURBUJA = {
  morado: { color1: '#2c1a4d', color2: '#6b46c1', color3: '#b794f6', color4: '#8f8fd9', color5: '#3b1f63' },
  siri:   { color1: '#1b1f4d', color2: '#3a6bc1', color3: '#ff9ecb', color4: '#7fb8ff', color5: '#241b63' },
  gemini: { color1: '#0d3b3f', color2: '#1e88a8', color3: '#7fe0c0', color4: '#3f9bd9', color5: '#0a2e40' },
  gris:   { color1: '#1c1c1e', color2: '#5a5a60', color3: '#b8b8c0', color4: '#8a8a90', color5: '#2a2a2e' },
};

function aplicarPaletaBurbuja(nombrePaleta) {
  const paleta = PALETAS_BURBUJA[nombrePaleta] || PALETAS_BURBUJA.morado;
  window.airaos.guardarEstiloBurbuja(paleta);
  localStorage.setItem('airaos_paleta_burbuja', nombrePaleta);
}

function marcarPaletaActiva(nombrePaleta) {
  document.querySelectorAll('.paleta-opcion').forEach((boton) => {
    boton.classList.toggle('paleta-opcion--activa', boton.dataset.paleta === nombrePaleta);
  });
}

document.querySelectorAll('.paleta-opcion').forEach((boton) => {
  boton.addEventListener('click', () => {
    aplicarPaletaBurbuja(boton.dataset.paleta);
    marcarPaletaActiva(boton.dataset.paleta);
  });
});

// Al arrancar la app, aplica la paleta guardada (o la de por defecto) a la
// burbuja, que arranca siempre en su color base hasta que le llega este aviso.
aplicarPaletaBurbuja(localStorage.getItem('airaos_paleta_burbuja') || 'morado');

// --- 4) Chat + memoria persistente ---------------------------------------

const mensajesEl = document.getElementById('mensajes');
const form = document.getElementById('form-mensaje');
const input = document.getElementById('input-mensaje');

// Guarda TODO el historial en memoria (arreglo en RAM) para poder
// enviarlo como contexto al modelo de IA, y para volver a guardarlo
// en disco cada vez que cambia.
let historial = [];

// Los recordatorios se declaran AQUÍ, al principio, porque agregarMensaje()
// (Fase 2) ya los incluye al guardar la memoria. Si los declarara más abajo,
// una llamada temprana a agregarMensaje chocaría con la zona muerta temporal
// de "let". Mejor un solo lugar claro para todo el estado persistente.
let recordatorios = []; // { id, texto, fechaISO, avisado }

// Notas rápidas (Fase 3). Igual que los recordatorios, van dentro de la misma
// memoria persistente, para que agregarMensaje() las guarde sin esfuerzo extra.
let notas = []; // { id, texto, fechaISO }

// Memory a largo plazo (Fase 4): cosas que AIRA aprende de ti y recuerda
// entre sesiones. Ej: "le gusta el café", "trabaja de noche".
// { id, texto, fechaISO }
let hechos = [];

// Guardamos el id de cada setTimeout activo para poder cancelarlo si el
// usuario borra el recordatorio antes de que suene (y no dejar timers huérfanos).
const temporizadoresAviso = new Map(); // id -> timeoutId

function agregarMensaje(texto, de, guardar = true) {
  const burbuja = document.createElement('div');
  burbuja.className = `mensaje mensaje--${de}`;
  burbuja.textContent = texto;
  mensajesEl.appendChild(burbuja);
  mensajesEl.scrollTop = mensajesEl.scrollHeight;

  if (guardar) {
    historial.push({ de, texto, fecha: Date.now() });
    window.airaos.guardarMemoria({ historial, recordatorios, notas, hechos }).catch((error) => {
      console.error('No se pudo guardar la memoria:', error);
    });
  }

  if (de === 'aira') hablar(texto);
}

async function iniciarChat() {
  const memoria = await window.airaos.cargarMemoria().catch(() => null);

  if (memoria && Array.isArray(memoria.recordatorios)) {
    recordatorios = memoria.recordatorios;
    pintarRecordatorios();
    for (const recordatorio of recordatorios.filter((r) => !r.avisado)) {
      programarAviso(recordatorio);
    }
  }

  if (memoria && Array.isArray(memoria.notas)) {
    notas = memoria.notas;
    pintarNotas();
  }

  if (memoria && Array.isArray(memoria.hechos)) {
    hechos = memoria.hechos;
    pintarHechos();
  }

  if (memoria && Array.isArray(memoria.historial) && memoria.historial.length > 0) {
    // Ya había conversaciones anteriores: las volvemos a mostrar,
    // sin re-guardarlas (ya están guardadas) ni hacer que hable de nuevo.
    historial = memoria.historial;
    for (const entrada of historial) {
      agregarMensaje(entrada.texto, entrada.de, false);
    }
  } else {
    // Primera vez que se abre AIRAOS: saludo inicial.
    ocupada = true;
    mostrarPose('saludo');
    agregarMensaje('Hola, soy AIRA. Todavía estoy aprendiendo, pero aquí estoy.', 'aira');
    setTimeout(() => {
      mostrarPose('base');
      ocupada = false;
    }, 1800);
  }
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = input.value.trim();
  if (!texto) return;

  agregarMensaje(texto, 'usuario');
  input.value = '';

  // Antes de molestar a la IA: ¿es una orden de recordatorio o de temporizador
  // en lenguaje natural? Si lo es, AIRA la resuelve sola (sin gastar API).
  const orden = interpretarOrdenDeRecordatorio(texto);
  if (orden) {
    ocupada = true;
    mostrarPose('pensando');
    await esperar(500);
    crearRecordatorioDesdeOrden(orden);
    mostrarPose('saludo');
    setTimeout(() => { mostrarPose('base'); ocupada = false; }, 1200);
    return;
  }

  const ordenTimer = interpretarOrdenDeTemporizador(texto);
  if (ordenTimer) {
    ocupada = true;
    mostrarPose('pensando');
    await esperar(500);
    if (ordenTimer.accion === 'cancelar') {
      cancelarTemporizador();
      agregarMensaje('Temporizador cancelado.', 'aira');
    } else if (ordenTimer.accion === 'pomodoro') {
      iniciarPomodoro('enfoque');
    } else {
      iniciarTemporizador(ordenTimer.etiqueta, ordenTimer.segundos);
    }
    mostrarPose('saludo');
    setTimeout(() => { mostrarPose('base'); ocupada = false; }, 1200);
    return;
  }

  // Fase 4: ¿me está preguntando por sus propios datos o pidiendo que
  // recuerde/olvide un hecho? AIRA lo resuelve sola, sin gastar API.
  const consulta = interpretarOrdenDeMemoria(texto);
  if (consulta) {
    ocupada = true;
    mostrarPose('pensando');
    await esperar(400);
    resolverOrdenDeMemoria(consulta);
    mostrarPose('saludo');
    setTimeout(() => { mostrarPose('base'); ocupada = false; }, 1200);
    return;
  }

  // Fase 5: ¿me pide cambiar de voz? ("cambia tu voz", "voz más grave",
  // "habla más despacio", "silénciate").
  const ordenVoz = interpretarOrdenDeVoz(texto);
  if (ordenVoz) {
    ocupada = true;
    mostrarPose('pensando');
    await esperar(400);
    resolverOrdenDeVoz(ordenVoz);
    mostrarPose('saludo');
    setTimeout(() => { mostrarPose('base'); ocupada = false; }, 1200);
    return;
  }

  // Fase 5: ¿me pide optimizar/diagnosticar el equipo?
  if (/optimiza|optimizar|analiza (mi|el) (equipo|pc|computadora|ordenador|m[aá]quina)|c[oó]mo va (mi|el) (pc|equipo|computadora)|rendimiento del equipo|diagn[oó]stico del (equipo|pc)/.test(texto.toLowerCase())) {
    ocupada = true;
    mostrarPose('pensando');
    await esperar(500);
    await diagnosticarEquipoEnChat();
    mostrarPose('saludo');
    setTimeout(() => { mostrarPose('base'); ocupada = false; }, 1200);
    return;
  }

  // Fase 7: ¿me pide controlar música o volumen?
  const ordenMedia = interpretarOrdenDeMedia(texto);
  if (ordenMedia) {
    ocupada = true;
    mostrarPose('pensando');
    await esperar(300);
    await resolverOrdenDeMedia(ordenMedia);
    mostrarPose('saludo');
    setTimeout(() => { mostrarPose('base'); ocupada = false; }, 1000);
    return;
  }

  // Fase 7: ¿me pide generar una imagen?
  const promptImagen = interpretarOrdenDeImagen(texto);
  if (promptImagen) {
    ocupada = true;
    mostrarPose('pensando');
    await generarImagenEnChat(promptImagen);
    mostrarPose('base');
    ocupada = false;
    return;
  }

  ocupada = true;
  mostrarPose('pensando');

  const respuesta = await generarRespuesta(texto);

  agregarMensaje(respuesta, 'aira');
  mostrarPose('base');
  ocupada = false;
});

// --------------------------------------------------------------------
// Generación de respuesta: usa el modelo real si hay API key
// configurada, o el modo de prueba si no.
// --------------------------------------------------------------------
async function generarRespuesta(mensajeUsuario) {
  const config = obtenerConfig();

  if (config.proveedor === 'gemini' && config.apiKey) {
    try {
      return await preguntarGemini(mensajeUsuario, config.apiKey);
    } catch (error) {
      console.error('Error llamando a Gemini:', error);
      return 'Tuve un problema conectándome con Gemini. Revisa tu API key en Configuración, o inténtalo de nuevo en un momento.';
    }
  }

  if (config.proveedor === 'ollama' || config.proveedor === 'lmstudio') {
    const endpoint = config.proveedor === 'ollama'
      ? config.endpointLocal
      : (config.endpointLocal.includes(':11434') ? 'http://127.0.0.1:1234' : config.endpointLocal);
    const respuesta = await window.airaos.preguntarCerebroLocal({
      endpoint,
      modelo: config.modeloLocal,
      mensajes: [
        { role: 'system', content: construirInstruccionSistema() },
        ...construirContenidoLocal(mensajeUsuario),
      ],
    });
    if (respuesta.ok) return respuesta.texto;
    return respuesta.error;
  }

  // Modo de prueba (sin API key configurada).
  await esperar(700);
  return `Recibí: "${mensajeUsuario}". Todavía no tienes una API key configurada ` +
         `(botón ⚙ arriba) — esta es una respuesta de prueba.`;
}

function construirContenidoLocal(mensajeUsuario) {
  const recientes = historial.slice(-20).map((entrada) => ({
    role: entrada.de === 'usuario' ? 'user' : 'assistant',
    content: entrada.texto,
  }));
  const ultimo = recientes[recientes.length - 1];
  if (!ultimo || ultimo.role !== 'user' || ultimo.content !== mensajeUsuario) {
    recientes.push({ role: 'user', content: mensajeUsuario });
  }
  return recientes;
}

// Fase 4: además del mensaje nuevo, le enviamos al modelo
//  (1) una instrucción de sistema con la personalidad de AIRA, y
//  (2) los últimos turnos de la conversación, para que tenga contexto
//      y no responda como si empezara de cero cada vez.
function construirInstruccionSistema() {
  const config = obtenerConfig();
  const nombre = (config.nombreUsuario || '').trim();
  const sobreUsuario = nombre ? ` La persona con quien hablas se llama ${nombre}.` : '';

  let base =
    'Eres AIRA, una asistente personal de escritorio, cercana, cálida y directa. ' +
    'Respondes siempre en español, con naturalidad, sin sonar robótica ni acartonada. ' +
    'Eres útil y concreta: si algo se puede resolver en dos frases, no escribas cinco.' + sobreUsuario;

  // Fase 4: contexto del día. Así puede responder cosas como
  // "¿qué tengo pendiente hoy?" sin inventarse nada.
  const contexto = construirContextoDelDia();
  if (contexto) base += '\n\n' + contexto;

  return base;
}

// Arma un bloque de contexto (recordatorios, hechos, temporizador) para el modelo.
function construirContextoDelDia() {
  const partes = [];
  const ahora = new Date();
  partes.push(`Ahora es ${ahora.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}.`);

  const pendientes = recordatorios
    .filter((r) => !r.avisado)
    .sort((a, b) => new Date(a.fechaISO) - new Date(b.fechaISO));
  if (pendientes.length > 0) {
    const lista = pendientes
      .map((r) => `- "${r.texto}" (${formatearFecha(r.fechaISO)})`)
      .join('\n');
    partes.push(`Recordatorios pendientes de la persona:\n${lista}`);
  }

  if (hechos.length > 0) {
    const lista = hechos.map((h) => `- ${h.texto}`).join('\n');
    partes.push(`Cosas que sabes de la persona y debes recordar:\n${lista}`);
  }

  if (temporizador) {
    const estado = temporizador.pausado ? 'en pausa' : 'en marcha';
    partes.push(
      `Tiene un temporizador ${estado}: "${temporizador.etiqueta}" ` +
      `con ${formatearReloj(temporizador.segundosRestantes)} restantes.`
    );
  }

  if (notas.length > 0) {
    const lista = notas.slice(-10).map((n) => `- ${n.texto}`).join('\n');
    partes.push(`Notas rápidas recientes de la persona:\n${lista}`);
  }

  return partes.join('\n\n');
}

// Convierte el historial interno al formato de Gemini (role: user/model).
// Recortamos a los últimos N turnos para no enviar conversaciones enteras
// (menos costo y menos ruido).
function construirContenidoGemini(mensajeUsuario) {
  const MAX_TURNOS = 20;

  const recientes = historial.slice(-MAX_TURNOS);
  const contenido = recientes.map((entrada) => ({
    role: entrada.de === 'usuario' ? 'user' : 'model',
    parts: [{ text: entrada.texto }],
  }));

  // Gemini exige que el primer turno sea del usuario. Si el historial
  // empezara con un mensaje de AIRA, lo quitamos.
  while (contenido.length > 0 && contenido[0].role !== 'user') {
    contenido.shift();
  }

  // Ya agregamos el mensaje nuevo al historial en agregarMensaje(), así que
  // aquí evitamos duplicarlo: si el último ya es el mensaje, no lo añadimos.
  const ultimo = contenido[contenido.length - 1];
  const yaIncluido = ultimo && ultimo.role === 'user' && ultimo.parts[0].text === mensajeUsuario;
  if (!yaIncluido) {
    contenido.push({ role: 'user', parts: [{ text: mensajeUsuario }] });
  }

  return contenido;
}

async function preguntarGemini(mensajeUsuario, apiKey) {
  // NOTA: gemini-1.5-flash fue retirado por Google (da 404). Usamos
  // gemini-2.5-flash, el modelo rápido vigente al momento de escribir esto.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Instrucción de sistema: la personalidad de AIRA (Fase 4).
      systemInstruction: { parts: [{ text: construirInstruccionSistema() }] },
      // Contexto real de la conversación, no solo el último mensaje.
      contents: construirContenidoGemini(mensajeUsuario),
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`Gemini respondió con estado ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  return datos.candidates?.[0]?.content?.parts?.[0]?.text
    ?? 'No obtuve una respuesta clara del modelo.';
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- 5) Voz: texto a voz (TTS) --------------------------------------------
//
// AVISO HONESTO: en Linux, Chromium/Electron muchas veces no trae
// ninguna voz de sistema instalada, y speechSynthesis simplemente no
// dice nada aunque el código esté bien. Si eso pasa, lo vas a ver
// reflejado en un mensaje de aviso una sola vez, no un error silencioso.

let vozActivada = true;
let avisoVozMostrado = false;

// Preferencias de voz (Fase 5). Se guardan en localStorage, igual que el
// resto de la configuración: no salen de tu equipo.
const PREF_VOZ = {
  nombre: localStorage.getItem('airaos_voz_nombre') || '',
  velocidad: parseFloat(localStorage.getItem('airaos_voz_velocidad')) || 1,
  tono: parseFloat(localStorage.getItem('airaos_voz_tono')) || 1,
};

const modalVoz = document.getElementById('modal-voz');
const vozSelector = document.getElementById('voz-selector');
const vozVelocidad = document.getElementById('voz-velocidad');
const vozVelocidadValor = document.getElementById('voz-velocidad-valor');
const vozTono = document.getElementById('voz-tono');
const vozTonoValor = document.getElementById('voz-tono-valor');
const vozNota = document.getElementById('voz-nota');
const btnVoz = document.getElementById('btn-voz');

// Lista de voces disponibles. OJO: en Chromium/Electron getVoices() puede
// devolver un arreglo vacío la primera vez, y luego llenarse de forma
// asíncrona (evento 'voiceschanged'). Por eso escuchamos ese evento.
let vocesDisponibles = [];

function cargarVoces() {
  if (!('speechSynthesis' in window)) return;
  const voces = window.speechSynthesis.getVoices();
  if (voces.length > 0) {
    vocesDisponibles = voces;
    pintarSelectorDeVoces();
  }
}

if ('speechSynthesis' in window) {
  cargarVoces();
  window.speechSynthesis.addEventListener('voiceschanged', cargarVoces);
}

// Llena el <select> con las voces, marcando las de español.
function pintarSelectorDeVoces() {
  if (!vozSelector) return;
  vozSelector.innerHTML = '';

  const enEspanol = vocesDisponibles.filter((v) => v.lang.toLowerCase().startsWith('es'));
  const otras = vocesDisponibles.filter((v) => !v.lang.toLowerCase().startsWith('es'));

  const agregarGrupo = (etiqueta, lista) => {
    if (lista.length === 0) return;
    const grupo = document.createElement('optgroup');
    grupo.label = etiqueta;
    for (const voz of lista) {
      const opcion = document.createElement('option');
      opcion.value = voz.name;
      opcion.textContent = `${voz.name} (${voz.lang})`;
      if (voz.name === PREF_VOZ.nombre) opcion.selected = true;
      grupo.appendChild(opcion);
    }
    vozSelector.appendChild(grupo);
  };

  agregarGrupo('Español', enEspanol);
  agregarGrupo('Otros idiomas', otras);

  if (vocesDisponibles.length === 0) {
    const opcion = document.createElement('option');
    opcion.textContent = 'No hay voces instaladas';
    opcion.disabled = true;
    vozSelector.appendChild(opcion);
  }
}

function buscarVozPreferida() {
  if (vocesDisponibles.length === 0) return null;
  // 1) La voz elegida por el usuario, si sigue existiendo.
  const elegida = vocesDisponibles.find((v) => v.name === PREF_VOZ.nombre);
  if (elegida) return elegida;
  // 2) Si no, la primera en español.
  const espanol = vocesDisponibles.find((v) => v.lang.toLowerCase().startsWith('es'));
  return espanol || vocesDisponibles[0];
}

// Aplica la voz, velocidad y tono guardados a un enunciado nuevo.
function configurarEnunciado(enunciado) {
  enunciado.rate = PREF_VOZ.velocidad;
  enunciado.pitch = PREF_VOZ.tono;
  const voz = buscarVozPreferida();
  if (voz) {
    enunciado.voice = voz;
    enunciado.lang = voz.lang;
  } else {
    enunciado.lang = 'es-ES';
  }
  return enunciado;
}

// El botón 🔊 abre el panel de voz para elegirla.
btnVoz.addEventListener('click', () => {
  abrirPanelDeVoz();
});

function abrirPanelDeVoz() {
  cargarVoces();
  pintarSelectorDeVoces();

  vozVelocidad.value = PREF_VOZ.velocidad;
  vozVelocidadValor.textContent = PREF_VOZ.velocidad.toFixed(1);
  vozTono.value = PREF_VOZ.tono;
  vozTonoValor.textContent = PREF_VOZ.tono.toFixed(1);

  actualizarNotaDeVoz();
  modalVoz.classList.remove('oculto');
}

function actualizarNotaDeVoz() {
  if (!vozNota) return;
  if (!('speechSynthesis' in window)) {
    vozNota.textContent =
      'Este entorno no soporta síntesis de voz, así que AIRA no puede hablar aquí.';
    return;
  }
  if (vocesDisponibles.length === 0) {
    vozNota.textContent =
      'Tu sistema no tiene voces instaladas, así que AIRA no puede hablar todavía. ' +
      'En Linux instálalas con: sudo apt install espeak-ng speech-dispatcher ' +
      '(o el paquete de voz de tu escritorio). Después reinicia AIRAOS.';
    return;
  }
  vozNota.textContent =
    'Elige la voz con la que AIRA te habla. Las voces disponibles las pone tu sistema.';
}

document.getElementById('voz-cerrar').addEventListener('click', () => {
  modalVoz.classList.add('oculto');
});

vozVelocidad.addEventListener('input', () => {
  vozVelocidadValor.textContent = parseFloat(vozVelocidad.value).toFixed(1);
});
vozTono.addEventListener('input', () => {
  vozTonoValor.textContent = parseFloat(vozTono.value).toFixed(1);
});

// Probar sin guardar: habla una frase de muestra con lo que hay puesto ahora.
document.getElementById('voz-probar').addEventListener('click', () => {
  const texto = 'Hola, soy AIRA. Así suena mi voz.';
  hablarConVoz(texto, {
    nombreVoz: vozSelector ? vozSelector.value : PREF_VOZ.nombre,
    velocidad: parseFloat(vozVelocidad.value),
    tono: parseFloat(vozTono.value),
  });
});

document.getElementById('voz-guardar').addEventListener('click', () => {
  PREF_VOZ.nombre = vozSelector ? vozSelector.value : '';
  PREF_VOZ.velocidad = parseFloat(vozVelocidad.value) || 1;
  PREF_VOZ.tono = parseFloat(vozTono.value) || 1;

  localStorage.setItem('airaos_voz_nombre', PREF_VOZ.nombre);
  localStorage.setItem('airaos_voz_velocidad', String(PREF_VOZ.velocidad));
  localStorage.setItem('airaos_voz_tono', String(PREF_VOZ.tono));

  modalVoz.classList.add('oculto');
  agregarMensaje(`Voz guardada: "${PREF_VOZ.nombre || 'automática'}".`, 'aira', false);
});

// Habla usando una voz/velocidad/tono concretos (para "Probar").
function hablarConVoz(texto, { nombreVoz, velocidad, tono }) {
  if (!('speechSynthesis' in window)) return;
  const voces = window.speechSynthesis.getVoices();
  if (voces.length === 0) return;

  const enunciado = new SpeechSynthesisUtterance(texto);
  const voz = voces.find((v) => v.name === nombreVoz)
    || voces.find((v) => v.lang.toLowerCase().startsWith('es'))
    || voces[0];
  enunciado.voice = voz;
  enunciado.lang = voz.lang;
  enunciado.rate = velocidad || 1;
  enunciado.pitch = tono || 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(enunciado);
}

function hablar(texto) {
  if (!vozActivada) return;
  if (!('speechSynthesis' in window)) return;

  const voces = window.speechSynthesis.getVoices();
  if (voces.length === 0 && !avisoVozMostrado) {
    avisoVozMostrado = true;
    console.warn(
      'No hay voces de sistema instaladas para speechSynthesis. ' +
      'En Linux esto es común: Chromium/Electron no trae voces por defecto. ' +
      'Instálalas con: sudo apt install espeak-ng speech-dispatcher'
    );
    return;
  }

  const enunciado = configurarEnunciado(new SpeechSynthesisUtterance(texto));
  enunciado.addEventListener('start', () => window.airaos.avisarEstadoVoz('hablando'));
  enunciado.addEventListener('end', () => window.airaos.avisarEstadoVoz('reposo'));
  enunciado.addEventListener('error', () => window.airaos.avisarEstadoVoz('reposo'));

  window.speechSynthesis.cancel(); // corta cualquier voz anterior sin terminar
  window.speechSynthesis.speak(enunciado);
}

// --- 6) Voz: reconocimiento (micrófono) ------------------------------------
//
// AVISO HONESTO: el reconocimiento de voz del navegador (Web Speech
// API) depende de un servicio de Google al que Electron normalmente
// NO tiene acceso (le falta una clave interna que sí trae Google
// Chrome, pero no Chromium/Electron). Es probable que al usar el
// micrófono salga un error de tipo "network". Si pasa, no es un bug
// de tu código: es una limitación conocida de Electron. La alternativa
// real más adelante es un motor de voz local (ej. whisper.cpp, que
// coincide con el módulo en C++ que ya planeamos en el roadmap).

const btnMicrofono = document.getElementById('btn-microfono');
const ReconocimientoVoz = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!ReconocimientoVoz) {
  btnMicrofono.disabled = true;
  btnMicrofono.title = 'Reconocimiento de voz no disponible en este entorno';
} else {
  const reconocimiento = new ReconocimientoVoz();
  reconocimiento.lang = 'es-ES';
  reconocimiento.interimResults = false;

  let grabando = false;

  btnMicrofono.addEventListener('click', () => {
    if (grabando) {
      reconocimiento.stop();
      return;
    }
    try {
      reconocimiento.start();
      grabando = true;
      btnMicrofono.classList.add('grabando');
      window.airaos.avisarEstadoVoz('escuchando');
    } catch (error) {
      console.error('No se pudo iniciar el micrófono:', error);
    }
  });

  reconocimiento.addEventListener('result', (evento) => {
    const texto = evento.results[0][0].transcript;
    input.value = texto;
    form.requestSubmit();
  });

  reconocimiento.addEventListener('error', (evento) => {
    console.error('Error de reconocimiento de voz:', evento.error);
    if (evento.error === 'network') {
      agregarMensaje(
        'El micrófono no pudo conectarse al servicio de reconocimiento de voz ' +
        '(esto es una limitación conocida de Electron, no un error tuyo). ' +
        'Por ahora sigamos escribiendo — el reconocimiento de voz real offline ' +
        'está planeado para más adelante en el roadmap.',
        'aira',
        false
      );
    }
  });

  reconocimiento.addEventListener('end', () => {
    grabando = false;
    btnMicrofono.classList.remove('grabando');
    window.airaos.avisarEstadoVoz('reposo');
  });
}

// --- Botón de minimizar a burbuja ----------------------------------------

document.getElementById('btn-minimizar').addEventListener('click', () => {
  window.airaos.toggleMainWindow();
});

// Nota (Fase 5): el botón 🔇 ya no silencia al pulsarlo — ahora abre el panel
// de voz. El silenciado sigue existiendo internamente (vozActivada), para
// poder ofrecer un interruptor dentro del panel más adelante.

// --- 7) Recordatorios (Fase 3) --------------------------------------------
//
// Se guardan junto con la memoria en el mismo archivo (memoria.json),
// bajo la clave "recordatorios". Cuando llega su hora, se muestra una
// notificación del sistema operativo (esto SÍ es confiable en Linux,
// a diferencia de la voz — usa el sistema de notificaciones nativo).

// Nota: "recordatorios" y "temporizadoresAviso" se declaran arriba, junto a
// "historial", porque la memoria los guarda desde la sección del chat.
const modalRecordatorios = document.getElementById('modal-recordatorios');
const listaRecordatoriosEl = document.getElementById('lista-recordatorios');
const formRecordatorio = document.getElementById('form-recordatorio');
const inputRecordatorioTexto = document.getElementById('recordatorio-texto');
const inputRecordatorioFecha = document.getElementById('recordatorio-fecha');
const btnRecordatorios = document.getElementById('btn-recordatorios');

document.getElementById('btn-recordatorios').addEventListener('click', () => {
  modalRecordatorios.classList.remove('oculto');
});

document.getElementById('recordatorios-cerrar').addEventListener('click', () => {
  modalRecordatorios.classList.add('oculto');
});

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  // Una fecha inválida (NaN) no debe romper la interfaz: se muestra tal cual.
  if (Number.isNaN(fecha.getTime())) return 'Fecha no válida';
  return fecha.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

function pintarRecordatorios() {
  listaRecordatoriosEl.innerHTML = '';

  const pendientes = recordatorios
    .filter((r) => !r.avisado)
    .sort((a, b) => new Date(a.fechaISO) - new Date(b.fechaISO));

  for (const recordatorio of pendientes) {
    const item = document.createElement('div');
    item.className = 'recordatorio-item';

    item.innerHTML = `
      <div class="recordatorio-item__texto">
        <span>${escaparHtml(recordatorio.texto)}</span>
        <span class="recordatorio-item__fecha">${formatearFecha(recordatorio.fechaISO)}</span>
      </div>
    `;

    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'recordatorio-item__borrar';
    btnBorrar.textContent = '✕';
    btnBorrar.addEventListener('click', () => eliminarRecordatorio(recordatorio.id));
    item.appendChild(btnBorrar);

    listaRecordatoriosEl.appendChild(item);
  }

  actualizarContadorRecordatorios(pendientes.length);
}

// Pequeña señal visual en el botón 📅 para saber cuántos recordatorios
// quedan pendientes sin tener que abrir el panel.
function actualizarContadorRecordatorios(cantidad) {
  if (!btnRecordatorios) return;
  btnRecordatorios.textContent = cantidad > 0 ? `📅 ${cantidad}` : '📅';
  btnRecordatorios.title = cantidad > 0
    ? `${cantidad} recordatorio(s) pendiente(s)`
    : 'Recordatorios';
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

async function guardarRecordatorios() {
  await window.airaos.guardarMemoria({ historial, recordatorios }).catch((error) => {
    console.error('No se pudieron guardar los recordatorios:', error);
  });
}

function eliminarRecordatorio(id) {
  // Cancela el temporizador activo de ese recordatorio, si lo había:
  // así no queda un setTimeout corriendo para algo ya borrado.
  const timerId = temporizadoresAviso.get(id);
  if (timerId !== undefined) {
    clearTimeout(timerId);
    temporizadoresAviso.delete(id);
  }

  recordatorios = recordatorios.filter((r) => r.id !== id);
  guardarRecordatorios();
  pintarRecordatorios();
}

formRecordatorio.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = inputRecordatorioTexto.value.trim();
  const fecha = inputRecordatorioFecha.value;
  if (!texto || !fecha) return;

  const nuevo = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    texto,
    fechaISO: new Date(fecha).toISOString(),
    avisado: false,
  };

  recordatorios.push(nuevo);
  guardarRecordatorios();
  pintarRecordatorios();
  programarAviso(nuevo);

  inputRecordatorioTexto.value = '';
  inputRecordatorioFecha.value = '';
});

function programarAviso(recordatorio) {
  const objetivo = new Date(recordatorio.fechaISO).getTime();

  // Defensa clave: si la fecha es inválida (NaN), NO programamos nada.
  // Sin este chequeo, setTimeout(NaN) dispara de inmediato y podría
  // repetirse en bucle. Mejor ignorarlo que comportarse raro.
  if (Number.isNaN(objetivo)) {
    console.warn('Recordatorio con fecha inválida, no se programa:', recordatorio);
    return;
  }

  // Si ya había un temporizador para este mismo id (ej. se reprograma
  // tras reiniciar la app), lo cancelamos para no duplicar el aviso.
  const previo = temporizadoresAviso.get(recordatorio.id);
  if (previo !== undefined) clearTimeout(previo);

  // Si ya pasó la fecha (ej. AIRAOS estaba cerrado), avisa igual, pero
  // sin esperas negativas raras.
  const espera = Math.max(objetivo - Date.now(), 0);

  const timerId = setTimeout(() => {
    temporizadoresAviso.delete(recordatorio.id);

    // Puede que ya lo hayan borrado manualmente antes de que llegara la hora.
    const sigueExistiendo = recordatorios.find((r) => r.id === recordatorio.id);
    if (!sigueExistiendo || sigueExistiendo.avisado) return;

    mostrarNotificacionSistema('AIRA te recuerda', recordatorio.texto);
    agregarMensaje(`⏰ Recordatorio: ${recordatorio.texto}`, 'aira');

    sigueExistiendo.avisado = true;
    guardarRecordatorios();
    pintarRecordatorios();
  }, espera);

  temporizadoresAviso.set(recordatorio.id, timerId);
}

let avisoNotificacionesMostrado = false;

function mostrarNotificacionSistema(titulo, cuerpo) {
  // Notification es una API web estándar; Electron la traduce a una
  // notificación nativa del sistema operativo (en Linux, vía el
  // demonio de notificaciones de tu escritorio — Cinnamon/MATE/etc.
  // ya traen uno por defecto).
  try {
    if (!('Notification' in window)) {
      avisarNotificacionNoDisponible(
        'Este entorno no soporta notificaciones del sistema. Te avisaré solo dentro del chat.'
      );
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(titulo, { body: cuerpo });
      return;
    }

    if (Notification.permission === 'denied') {
      avisarNotificacionNoDisponible(
        'Tienes las notificaciones bloqueadas, así que no puedo mostrarlas fuera de la app. ' +
        'Actívalas en tu sistema si quieres verlas como avisos del escritorio.'
      );
      return;
    }

    // Permiso aún sin decidir: lo pedimos y, si lo conceden, avisamos.
    Notification.requestPermission().then((permiso) => {
      if (permiso === 'granted') {
        new Notification(titulo, { body: cuerpo });
      } else {
        avisarNotificacionNoDisponible(
          'No me diste permiso para las notificaciones del sistema. Te avisaré solo dentro del chat.'
        );
      }
    }).catch((error) => {
      console.error('No se pudo pedir permiso de notificaciones:', error);
    });
  } catch (error) {
    console.error('No se pudo mostrar la notificación del sistema:', error);
  }
}

// Regla 3 del proyecto: avisar explícitamente, nunca fallar en silencio.
// Se muestra una sola vez por sesión para no llenar el chat de advertencias.
function avisarNotificacionNoDisponible(mensaje) {
  if (avisoNotificacionesMostrado) return;
  avisoNotificacionesMostrado = true;
  console.warn(mensaje);
  agregarMensaje(mensaje, 'aira', false);
}

// --- 8) Notas rápidas (Fase 3) --------------------------------------------
//
// Notas de texto libre, sin fecha, para apuntar algo sin convertirlo en
// recordatorio. Se guardan junto con el resto de la memoria (memoria.json).

const modalNotas = document.getElementById('modal-notas');
const listaNotasEl = document.getElementById('lista-notas');
const formNota = document.getElementById('form-nota');
const inputNotaTexto = document.getElementById('nota-texto');
const btnNotas = document.getElementById('btn-notas');

document.getElementById('btn-notas').addEventListener('click', () => {
  modalNotas.classList.remove('oculto');
});

document.getElementById('notas-cerrar').addEventListener('click', () => {
  modalNotas.classList.add('oculto');
});

function pintarNotas() {
  listaNotasEl.innerHTML = '';

  // Más recientes primero: una nota recién apuntada debe verse arriba.
  const ordenadas = [...notas].sort((a, b) => new Date(b.fechaISO) - new Date(a.fechaISO));

  for (const nota of ordenadas) {
    const item = document.createElement('div');
    item.className = 'nota-item';

    item.innerHTML = `
      <div class="nota-item__texto">
        <span>${escaparHtml(nota.texto)}</span>
        <span class="nota-item__fecha">${formatearFecha(nota.fechaISO)}</span>
      </div>
    `;

    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'nota-item__borrar';
    btnBorrar.textContent = '✕';
    btnBorrar.addEventListener('click', () => eliminarNota(nota.id));
    item.appendChild(btnBorrar);

    listaNotasEl.appendChild(item);
  }

  actualizarContadorNotas(notas.length);
}

function actualizarContadorNotas(cantidad) {
  if (!btnNotas) return;
  btnNotas.textContent = cantidad > 0 ? `📝 ${cantidad}` : '📝';
  btnNotas.title = cantidad > 0
    ? `${cantidad} nota(s) guardada(s)`
    : 'Notas rápidas';
}

async function guardarNotas() {
  await window.airaos.guardarMemoria({ historial, recordatorios, notas }).catch((error) => {
    console.error('No se pudieron guardar las notas:', error);
  });
}

function eliminarNota(id) {
  notas = notas.filter((n) => n.id !== id);
  guardarNotas();
  pintarNotas();
}

formNota.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = inputNotaTexto.value.trim();
  if (!texto) return;

  notas.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    texto,
    fechaISO: new Date().toISOString(),
  });

  guardarNotas();
  pintarNotas();
  inputNotaTexto.value = '';
});

// --- 9) Recordatorios por lenguaje natural (Fase 3) -----------------------
//
// Permite frases como:
//   "recuérdame llamar a mamá en 10 minutos"
//   "recuérdame comprar pan en 2 horas"
//   "recuérdame la reunión mañana a las 9"
//   "recuérdame pagar el recibo a las 18:30"
//
// Es un intérprete de reglas (no un modelo de IA): si no logra entender la
// fecha con seguridad, devuelve null y el mensaje sigue el flujo normal del
// chat. Preferimos NO crear un recordatorio a crearlo mal.

const PALABRAS_DISPARADORAS = [
  'recuérdame', 'recuerdame', 'recuérdame', 'avísame', 'avisame',
  'no me olvides', 'ponme un recordatorio', 'crea un recordatorio',
  'agrega un recordatorio', 'agregar recordatorio',
];

function interpretarOrdenDeRecordatorio(textoOriginal) {
  const texto = textoOriginal.toLowerCase().trim();

  const disparador = PALABRAS_DISPARADORAS.find((p) => texto.includes(p));
  if (!disparador) return null;

  // Quitamos la palabra disparadora y palabras de relleno para quedarnos
  // con lo que hay que recordar ("llamar a mamá").
  let asunto = textoOriginal.slice(textoOriginal.toLowerCase().indexOf(disparador) + disparador.length);

  const fecha = extraerFechaDeTexto(texto);
  if (!fecha) return null; // no entendimos cuándo: que responda la IA normal
  // Del asunto quitamos la parte de la fecha ("en 10 minutos", "mañana a las 9")
  // para que el recordatorio se lea limpio.
  // Ojo: NO cortamos por "el"/"por" a secas, porque forman parte del
  // asunto ("pagar EL recibo", "pasar POR el banco"). Solo cortamos por
  // las expresiones que introducen la fecha.
  // Sin "\\b" en los extremos a propósito: en JavaScript "\\b" no reconoce
  // las vocales acentuadas (á, é…) como carácter de palabra, así que
  // "mamá en 10 minutos" no cortaba y el asunto quedaba con la fecha pegada.
  asunto = asunto
    .replace(/\s+(en\s+\d|en\s+un|dentro de|a las|para las|mañana|manana|hoy).*$/i, '')
    .replace(/^[\s,:;.-]+/, '')
    .replace(/[\s,:;.-]+$/, '')
    .trim();

  if (!asunto) asunto = 'Algo pendiente';

  return { asunto, fecha };
}

// Devuelve un objeto Date, o null si no pudimos interpretar una fecha.
function extraerFechaDeTexto(texto) {
  const ahora = new Date();

  // 1) "en N minutos / horas / días"
  const enMinutos = texto.match(/\ben\s+(\d{1,4})\s*(minuto|minutos|min)\b/);
  if (enMinutos) {
    return new Date(ahora.getTime() + parseInt(enMinutos[1], 10) * 60 * 1000);
  }

  const enHoras = texto.match(/\ben\s+(\d{1,3})\s*(hora|horas|h)\b/);
  if (enHoras) {
    return new Date(ahora.getTime() + parseInt(enHoras[1], 10) * 60 * 60 * 1000);
  }

  const enDias = texto.match(/\ben\s+(\d{1,2})\s*(día|dias|días)\b/);
  if (enDias) {
    return new Date(ahora.getTime() + parseInt(enDias[1], 10) * 24 * 60 * 60 * 1000);
  }

  // 2) Hora concreta: "a las 9", "a las 18:30", "a las 9 de la noche"
  const hora = texto.match(/\ba\s+las\s+(\d{1,2})(?::(\d{2}))?\s*(de\s+la\s+(mañana|manana|tarde|noche))?/);
  if (hora) {
    let h = parseInt(hora[1], 10);
    const m = hora[2] ? parseInt(hora[2], 10) : 0;
    const franja = hora[3];

    // "9 de la noche" -> 21; "3 de la tarde" -> 15.
    if (franja && /tarde|noche/.test(franja) && h < 12) h += 12;

    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const objetivo = new Date(ahora);
      objetivo.setHours(h, m, 0, 0);

      // Si la hora indicada ya pasó hoy, entendemos que es mañana.
      if (objetivo.getTime() <= ahora.getTime()) {
        objetivo.setDate(objetivo.getDate() + 1);
      }
      return objetivo;
    }
  }

  // 3) "mañana" (sin hora) -> mañana a las 9:00, una hora razonable.
  if (/\bmañana\b|\bmanana\b/.test(texto)) {
    const objetivo = new Date(ahora);
    objetivo.setDate(objetivo.getDate() + 1);
    objetivo.setHours(9, 0, 0, 0);
    return objetivo;
  }

  return null;
}

// Crea el recordatorio, lo guarda, lo pinta y confirma en el chat.
function crearRecordatorioDesdeOrden({ asunto, fecha }) {
  const nuevo = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    texto: asunto,
    fechaISO: fecha.toISOString(),
    avisado: false,
  };

  recordatorios.push(nuevo);
  guardarRecordatorios();
  pintarRecordatorios();
  programarAviso(nuevo);

  agregarMensaje(
    `Listo, te lo recuerdo el ${formatearFecha(nuevo.fechaISO)}: "${asunto}".`,
    'aira'
  );
}

// --- 10) Temporizador + método Pomodoro (Fase 3) --------------------------
//
// Un temporizador de cuenta atrás. Además, el modo Pomodoro usa los tiempos
// clásicos: 25 min de enfoque, 5 min de pausa corta, 15 min de pausa larga.
// Solo hay UN temporizador activo a la vez (como un reloj de cocina real).

const DURACIONES_POMODORO = {
  enfoque: { segundos: 25 * 60, etiqueta: 'Enfoque' },
  pausa: { segundos: 5 * 60, etiqueta: 'Pausa corta' },
  'pausa-larga': { segundos: 15 * 60, etiqueta: 'Pausa larga' },
};

let temporizador = null; // { etiqueta, segundosTotales, segundosRestantes, restanteId }

const modalTemporizador = document.getElementById('modal-temporizador');
const relojEl = document.getElementById('temporizador-reloj');
const estadoTemporizadorEl = document.getElementById('temporizador-estado');
const formTemporizador = document.getElementById('form-temporizador');
const inputTemporizadorTexto = document.getElementById('temporizador-texto');
const btnTemporizador = document.getElementById('btn-temporizador');

document.getElementById('btn-temporizador').addEventListener('click', () => {
  modalTemporizador.classList.remove('oculto');
});

document.getElementById('temporizador-cerrar').addEventListener('click', () => {
  modalTemporizador.classList.add('oculto');
});

document.getElementById('temporizador-cancelar').addEventListener('click', () => {
  cancelarTemporizador();
});

document.getElementById('temporizador-pausar').addEventListener('click', () => {
  alternarPausaTemporizador();
});

// Botones rápidos de Pomodoro (25/5/15).
document.querySelectorAll('.pomodoro-modo').forEach((boton) => {
  boton.addEventListener('click', () => {
    iniciarPomodoro(boton.dataset.modo);
  });
});

// Temporizador libre escrito a mano: "estudiar 10 minutos", "descansar 2 min".
formTemporizador.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = inputTemporizadorTexto.value.trim();
  if (!texto) return;

  const segundos = extraerDuracionEnSegundos(texto);
  if (!segundos) {
    agregarMensaje(
      'No entendí cuánto tiempo. Escríbelo así: "estudiar 10 minutos" o "descansar 2 min".',
      'aira',
      false
    );
    return;
  }

  // El texto sin el número/uniad de tiempo queda como etiqueta del temporizador.
  const etiqueta = texto.replace(/\d+\s*(hora|horas|h|minuto|minutos|min|segundo|segundos|seg|s)\b/ig, '').trim()
    || 'Temporizador';

  iniciarTemporizador(etiqueta, segundos);
  inputTemporizadorTexto.value = '';
});

// "10 minutos", "2 min", "1 hora", "30 segundos" -> segundos (o null).
function extraerDuracionEnSegundos(texto) {
  const horas = texto.match(/(\d+)\s*(hora|horas|h)\b/i);
  if (horas) return parseInt(horas[1], 10) * 3600;

  const minutos = texto.match(/(\d+)\s*(minuto|minutos|min)\b/i);
  if (minutos) return parseInt(minutos[1], 10) * 60;

  const segundos = texto.match(/(\d+)\s*(segundo|segundos|seg|s)\b/i);
  if (segundos) return parseInt(segundos[1], 10);

  return null;
}

// Formatea segundos como MM:SS (o HH:MM:SS si pasa de una hora).
function formatearReloj(totalSegundos) {
  const s = Math.max(0, Math.floor(totalSegundos));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const dosDigitos = (n) => String(n).padStart(2, '0');
  return horas > 0
    ? `${horas}:${dosDigitos(minutos)}:${dosDigitos(seg)}`
    : `${dosDigitos(minutos)}:${dosDigitos(seg)}`;
}

function iniciarPomodoro(modo) {
  const config = DURACIONES_POMODORO[modo];
  if (!config) return;
  iniciarTemporizador(config.etiqueta, config.segundos);
}

function iniciarTemporizador(etiqueta, segundos) {
  // Si había uno activo, lo reemplazamos (un solo reloj a la vez).
  cancelarTemporizador();

  temporizador = {
    etiqueta,
    segundosTotales: segundos,
    segundosRestantes: segundos,
    pausado: false,
    restanteId: null,
  };

  pintarTemporizador();
  agregarMensaje(`⏱️ Temporizador iniciado: ${etiqueta} (${formatearReloj(segundos)}).`, 'aira', false);
  arrancarCuentaAtras();
}

function arrancarCuentaAtras() {
  if (!temporizador) return;

  temporizador.restanteId = setInterval(() => {
    if (!temporizador || temporizador.pausado) return;

    temporizador.segundosRestantes -= 1;
    pintarTemporizador();

    if (temporizador.segundosRestantes <= 0) {
      finalizarTemporizador();
    }
  }, 1000);
}

function alternarPausaTemporizador() {
  if (!temporizador) return;
  temporizador.pausado = !temporizador.pausado;
  pintarTemporizador();
}

function cancelarTemporizador() {
  if (temporizador && temporizador.restanteId) {
    clearInterval(temporizador.restanteId);
  }
  temporizador = null;
  pintarTemporizador();
}

function finalizarTemporizador() {
  const etiqueta = temporizador ? temporizador.etiqueta : 'Temporizador';
  if (temporizador && temporizador.restanteId) {
    clearInterval(temporizador.restanteId);
  }
  temporizador = null;
  pintarTemporizador();

  mostrarNotificacionSistema('AIRA — temporizador', `Se terminó: ${etiqueta}`);
  agregarMensaje(`⏱️ Se terminó el temporizador ${etiqueta}.`, 'aira');
}

function pintarTemporizador() {
  if (temporizador) {
    relojEl.textContent = formatearReloj(temporizador.segundosRestantes);
    const estado = temporizador.pausado ? 'en pausa' : 'en marcha';
    estadoTemporizadorEl.textContent = `${temporizador.etiqueta} — ${estado}.`;
    btnTemporizador.textContent = `⏱️ ${formatearReloj(temporizador.segundosRestantes)}`;
    btnTemporizador.title = `Temporizador: ${temporizador.etiqueta}`;
  } else {
    relojEl.textContent = '00:00';
    estadoTemporizadorEl.textContent = 'Sin temporizador activo.';
    btnTemporizador.textContent = '⏱️';
    btnTemporizador.title = 'Temporizador';
  }
}

// Frases como:
//   "temporizador de 10 minutos" / "pon un temporizador de 25 min"
//   "inicia un pomodoro" / "modo pomodoro"
//   "cancelar temporizador" / "para el temporizador"
// Devuelve { etiqueta, segundos } o null. Para "cancelar" devuelve un objeto
// especial { accion: 'cancelar' }.
function interpretarOrdenDeTemporizador(textoOriginal) {
  const texto = textoOriginal.toLowerCase();

  // Cancelar / parar.
  if (/\b(cancelar|para|parar|deten|detener|apaga)\b.*\b(temporizador|timer|pomodoro)\b/.test(texto)
      || /\b(temporizador|timer|pomodoro)\b.*\b(cancelar|parar|detener|apaga)\b/.test(texto)) {
    return { accion: 'cancelar' };
  }

  // Pomodoro directo.
  if (/\b(pomodoro)\b/.test(texto)) {
    return { accion: 'pomodoro' };
  }

  // "temporizador de N minutos" (u horas/segundos).
  const mencionaTimer = /\b(temporizador|timer|cuenta atras|cuenta atrás)\b/.test(texto);
  if (!mencionaTimer) return null;

  const segundos = extraerDuracionEnSegundos(texto);
  if (!segundos) return null;

  // Etiqueta: lo que queda tras quitar "pon un temporizador de", etc.
  const etiqueta = texto
    .replace(/\b(pon|ponme|inicia|iniciar|crea|crear|un|una|de|el|la|temporizador|timer|cuenta atras|cuenta atrás)\b/g, '')
    .replace(/\d+\s*(hora|horas|h|minuto|minutos|min|segundo|segundos|seg|s)\b/g, '')
    .replace(/\s+/g, '')
    .trim();

  return { etiqueta: etiqueta || 'Temporizador', segundos };
}

// --- 11) Selector de modelo de avatar (Fase 4) ----------------------------
//
// Permite cambiar entre los modelos 2D de AIRA. La elección se guarda en
// localStorage, así que se mantiene al cerrar y volver a abrir la app.

const modalAvatar = document.getElementById('modal-avatar');
const listaModelosEl = document.getElementById('lista-modelos');
const btnAvatar = document.getElementById('btn-avatar');

document.getElementById('btn-avatar').addEventListener('click', () => {
  pintarModelos();
  modalAvatar.classList.remove('oculto');
});

document.getElementById('avatar-cerrar').addEventListener('click', () => {
  modalAvatar.classList.add('oculto');
});

function pintarModelos() {
  listaModelosEl.innerHTML = '';

  for (const modelo of MODELOS_AVATAR) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'modelo-item';
    if (modelo.id === modeloAvatarActual) item.classList.add('modelo-item--activo');

    item.innerHTML = `
      <img class="modelo-item__miniatura" src="assets/avatar/${modelo.id}/flotando.jpg" alt="" />
      <span class="modelo-item__info">
        <span class="modelo-item__nombre">${escaparHtml(modelo.nombre)}</span>
        <span class="modelo-item__desc">${escaparHtml(modelo.descripcion)}</span>
      </span>
    `;

    item.addEventListener('click', () => seleccionarModelo(modelo.id));
    listaModelosEl.appendChild(item);
  }
}

function seleccionarModelo(id) {
  modeloAvatarActual = id;
  localStorage.setItem('airaos_modelo_avatar', id);
  pintarModelos();

  // Volvemos a la pose base con el modelo nuevo, para que el cambio se vea.
  mostrarPose('base');

  const nombre = MODELOS_AVATAR.find((m) => m.id === id)?.nombre || id;
  agregarMensaje(`Modelo cambiado a: ${nombre}.`, 'aira', false);
}

// --- 11) Memoria a largo plazo + consultas (Fase 4) -----------------------
//
// AIRA aprende hechos sobre ti y te los recuerda entre sesiones. Frases:
//   "recuerda que me gusta el café"        -> guarda un hecho
//   "aprende que trabajo de noche"        -> guarda un hecho
//   "olvida que me gusta el café"         -> borra un hecho
//   "qué sabes de mí" / "qué recuerdas"   -> lista los hechos
//   "qué tengo pendiente"                 -> lista recordatorios
//   "qué notas tengo"                     -> lista notas
//   "cómo va el temporizador"             -> estado del temporizador
//
// Es un intérprete de reglas: si la frase no encaja con claridad, devuelve
// null y el mensaje sigue el flujo normal del chat (incluida la IA).

const modalHechos = document.getElementById('modal-hechos');
const listaHechosEl = document.getElementById('lista-hechos');
const formHecho = document.getElementById('form-hecho');
const inputHechoTexto = document.getElementById('hecho-texto');
const btnHechos = document.getElementById('btn-hechos');

if (btnHechos) {
  btnHechos.addEventListener('click', () => {
    pintarHechos();
    modalHechos.classList.remove('oculto');
  });
  document.getElementById('hechos-cerrar').addEventListener('click', () => {
    modalHechos.classList.add('oculto');
  });
}

function pintarHechos() {
  if (!listaHechosEl) return;
  listaHechosEl.innerHTML = '';

  const ordenados = [...hechos].sort((a, b) => new Date(b.fechaISO) - new Date(a.fechaISO));
  for (const hecho of ordenados) {
    const item = document.createElement('div');
    item.className = 'hecho-item';
    item.innerHTML = `
      <div class="hecho-item__texto">
        <span>${escaparHtml(hecho.texto)}</span>
        <span class="hecho-item__fecha">${formatearFecha(hecho.fechaISO)}</span>
      </div>
    `;

    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'hecho-item__borrar';
    btnBorrar.textContent = '✕';
    btnBorrar.addEventListener('click', () => eliminarHecho(hecho.id));
    item.appendChild(btnBorrar);

    listaHechosEl.appendChild(item);
  }

  actualizarContadorHechos(hechos.length);
}

function actualizarContadorHechos(cantidad) {
  if (!btnHechos) return;
  btnHechos.textContent = cantidad > 0 ? `🧠 ${cantidad}` : '🧠';
  btnHechos.title = cantidad > 0
    ? `${cantidad} cosa(s) que AIRA recuerda de ti`
    : 'Lo que AIRA recuerda de ti';
}

async function guardarHechos() {
  await window.airaos.guardarMemoria({ historial, recordatorios, notas, hechos }).catch((error) => {
    console.error('No se pudieron guardar los hechos:', error);
  });
}

function eliminarHecho(id) {
  hechos = hechos.filter((h) => h.id !== id);
  guardarHechos();
  pintarHechos();
}

function agregarHecho(texto) {
  // Evitamos duplicados exactos (sin distinguir mayúsculas).
  const yaExiste = hechos.some((h) => h.texto.toLowerCase() === texto.toLowerCase());
  if (yaExiste) return false;

  hechos.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    texto,
    fechaISO: new Date().toISOString(),
  });
  guardarHechos();
  pintarHechos();
  return true;
}

if (formHecho) {
  formHecho.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = inputHechoTexto.value.trim();
    if (!texto) return;
    const guardado = agregarHecho(texto);
    agregarMensaje(
      guardado ? `Anotado, lo recordaré: "${texto}".` : `Eso ya lo tenía en cuenta: "${texto}".`,
      'aira',
      false
    );
    inputHechoTexto.value = '';
  });
}

// Devuelve una orden a resolver, o null si la frase no es de este tipo.
//   { accion: 'guardar', texto }
//   { accion: 'olvidar', texto }
//   { accion: 'listar-hechos' | 'listar-recordatorios' | 'listar-notas' | 'estado-temporizador' }
function interpretarOrdenDeMemoria(textoOriginal) {
  const texto = textoOriginal.toLowerCase().trim();

  // Guardar un hecho: "recuerda que...", "aprende que...", "ten en cuenta que..."
  const guardar = texto.match(/^(recuerda|aprende|ten en cuenta|anota)\s+(que\s+)?(.+)$/);
  if (guardar) {
    // Extraemos el texto del original respetando mayúsculas del asunto.
    const idx = textoOriginal.toLowerCase().indexOf(guardar[3]);
    const asunto = textoOriginal.slice(idx).trim().replace(/[.]+$/, '');
    if (asunto) return { accion: 'guardar', texto: asunto };
  }

  // Olvidar: "olvida que...", "olvida lo de...", "borra que..."
  const olvidar = texto.match(/^(olvida|olvidate de|olvíd|borra|elimina)\s+(que\s+|lo de\s+)?(.+)$/);
  if (olvidar) {
    const idx = textoOriginal.toLowerCase().indexOf(olvidar[3]);
    const asunto = textoOriginal.slice(idx).trim().replace(/[.]+$/, '');
    if (asunto) return { accion: 'olvidar', texto: asunto };
  }

  // Consultas. Sin "\b" en los extremos a propósito: en JavaScript "\b" no
  // reconoce las vocales acentuadas (í, á…) como carácter de palabra, así que
  // "qué sabes de mí" no coincidía con las fronteras de palabra.
  if (/qu[eé] sabes de m[íi]|qu[eé] recuerdas de m[íi]|qu[eé] has aprendido|mis recuerdos|lo que sabes de m[íi]/.test(texto)) {
    return { accion: 'listar-hechos' };
  }
  if (/qu[eé] tengo pendiente|qu[eé] recordatorios|mis recordatorios|qu[eé] me falta/.test(texto)) {
    return { accion: 'listar-recordatorios' };
  }
  if (/qu[eé] notas tengo|mis notas|muestra mis notas/.test(texto)) {
    return { accion: 'listar-notas' };
  }
  if (/c[oó]mo va el temporizador|estado del temporizador|c[oó]mo va el pomodoro|cu[aá]nto queda/.test(texto)) {
    return { accion: 'estado-temporizador' };
  }

  return null;
}

// Ejecuta la orden y responde en el chat.
function resolverOrdenDeMemoria(orden) {
  switch (orden.accion) {
    case 'guardar': {
      const guardado = agregarHecho(orden.texto);
      agregarMensaje(
        guardado ? `Anotado, lo recordaré: "${orden.texto}".` : `Eso ya lo tenía en cuenta.`,
        'aira'
      );
      break;
    }
    case 'olvidar': {
      const antes = hechos.length;
      hechos = hechos.filter((h) => h.texto.toLowerCase() !== orden.texto.toLowerCase());
      guardarHechos();
      pintarHechos();
      agregarMensaje(
        hechos.length < antes ? `Hecho, lo he olvidado: "${orden.texto}".` : `No tenía anotado eso, así que nada que olvidar.`,
        'aira'
      );
      break;
    }
    case 'listar-hechos': {
      agregarMensaje(hechos.length === 0
        ? 'Todavía no sé nada especial de ti. Puedes decirme "recuerda que..." y lo apuntaré.'
        : 'Esto es lo que recuerdo de ti:\n' + hechos.map((h) => `- ${h.texto}`).join('\n'),
        'aira');
      break;
    }
    case 'listar-recordatorios': {
      const pendientes = recordatorios.filter((r) => !r.avisado).sort((a, b) => new Date(a.fechaISO) - new Date(b.fechaISO));
      agregarMensaje(pendientes.length === 0
        ? 'No tienes recordatorios pendientes.'
        : 'Tienes pendiente:\n' + pendientes.map((r) => `- ${r.texto} (${formatearFecha(r.fechaISO)})`).join('\n'),
        'aira');
      break;
    }
    case 'listar-notas': {
      agregarMensaje(notas.length === 0
        ? 'No tienes notas guardadas.'
        : 'Tus notas:\n' + notas.slice(-10).map((n) => `- ${n.texto}`).join('\n'),
        'aira');
      break;
    }
    case 'estado-temporizador': {
      agregarMensaje(temporizador
        ? `Tu temporizador "${temporizador.etiqueta}" está ${temporizador.pausado ? 'en pausa' : 'en marcha'}, quedan ${formatearReloj(temporizador.segundosRestantes)}.`
        : 'No tienes ningún temporizador activo.',
        'aira');
      break;
    }
  }
}

// --- 12) Control de voz por lenguaje natural (Fase 5) ---------------------
//
// Frases como:
//   "habla más despacio" / "habla más rápido"
//   "voz más grave" / "voz más aguda"
//   "silénciate" / "deja de hablar" / "activa tu voz"
//   "qué voces tienes" / "cambia de voz"
// Devuelve { accion, ... } o null si la frase no es de este tipo.

function interpretarOrdenDeVoz(textoOriginal) {
  const texto = textoOriginal.toLowerCase().trim();

  if (/silencio|sil[eé]nciate|c[aá]llate|deja de hablar|no hables|m[uú]tate|enmudece/.test(texto)) {
    return { accion: 'silenciar' };
  }
  if (/activa tu voz|vuelve a hablar|habla de nuevo|quita el silencio|desm[uú]tate/.test(texto)) {
    return { accion: 'activar' };
  }
  if (/qu[eé] voces|qu[eé] voz tienes|lista de voces|voces disponibles|cambia de voz|cambiar de voz/.test(texto)) {
    return { accion: 'listar' };
  }
  if (/m[aá]s despacio|habla lento|habla despacio|m[aá]s lento|reduce la velocidad/.test(texto)) {
    return { accion: 'velocidad', delta: -0.2 };
  }
  if (/m[aá]s r[aá]pido|habla r[aá]pido|acelera|sube la velocidad/.test(texto)) {
    return { accion: 'velocidad', delta: 0.2 };
  }
  if (/voz m[aá]s grave|m[aá]s grave|tono m[aá]s bajo/.test(texto)) {
    return { accion: 'tono', delta: -0.2 };
  }
  if (/voz m[aá]s aguda|m[aá]s aguda|tono m[aá]s alto/.test(texto)) {
    return { accion: 'tono', delta: 0.2 };
  }

  return null;
}

function resolverOrdenDeVoz(orden) {
  switch (orden.accion) {
    case 'silenciar': {
      vozActivada = false;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      agregarMensaje('Vale, me callo. Dime "activa tu voz" cuando quieras que hable otra vez.', 'aira', false);
      break;
    }
    case 'activar': {
      vozActivada = true;
      agregarMensaje('Listo, vuelvo a hablar.', 'aira');
      break;
    }
    case 'listar': {
      // Las voces pueden cargarse de forma asíncrona; leemos las actuales.
      const voces = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];
      const enEspanol = voces.filter((v) => v.lang.toLowerCase().startsWith('es'));
      if (voces.length === 0) {
        agregarMensaje('Tu sistema no tiene voces instaladas todavía, así que no tengo voces que ofrecerte.', 'aira');
      } else {
        agregarMensaje(
          `Tengo ${voces.length} voz(es). En español: ` +
          (enEspanol.length > 0 ? enEspanol.map((v) => v.name).join(', ') : 'ninguna') +
          '. Puedes cambiarla desde el botón 🔊.',
          'aira'
        );
      }
      break;
    }
    case 'velocidad': {
      PREF_VOZ.velocidad = Math.min(2, Math.max(0.5, PREF_VOZ.velocidad + orden.delta));
      localStorage.setItem('airaos_voz_velocidad', String(PREF_VOZ.velocidad));
      agregarMensaje(`Velocidad de voz a ${PREF_VOZ.velocidad.toFixed(1)}x.`, 'aira');
      break;
    }
    case 'tono': {
      PREF_VOZ.tono = Math.min(2, Math.max(0.5, PREF_VOZ.tono + orden.delta));
      localStorage.setItem('airaos_voz_tono', String(PREF_VOZ.tono));
      agregarMensaje(`Tono de voz a ${PREF_VOZ.tono.toFixed(1)}.`, 'aira');
      break;
    }
  }
}

// --- 13) Optimización del equipo (Fase 5) ---------------------------------
//
// AIRA mira el equipo donde está instalada (CPU, núcleos, memoria) y da
// recomendaciones para que ella y el sistema vayan más fluidos.
//
// IMPORTANTE (regla 3 del): AIRA NO cambia nada del sistema por su
// cuenta — solo informa y recomienda. Nada de tocar archivos del SO.

const modalOptimizar = document.getElementById('modal-optimizar');
const diagnosticoEl = document.getElementById('optimizar-diagnostico');
const consejosEl = document.getElementById('optimizar-consejos');

const btnOptimizar = document.getElementById('btn-optimizar');
if (btnOptimizar) {
  btnOptimizar.addEventListener('click', () => {
    abrirPanelDeOptimizacion();
  });
}

const btnOptimizarCerrar = document.getElementById('optimizar-cerrar');
if (btnOptimizarCerrar) {
  btnOptimizarCerrar.addEventListener('click', () => {
    modalOptimizar.classList.add('oculto');
  });
}

async function abrirPanelDeOptimizacion() {
  modalOptimizar.classList.remove('oculto');
  diagnosticoEl.textContent = 'Analizando tu equipo…';
  consejosEl.innerHTML = '';

  let info = null;
  try {
    info = await window.airaos.infoSistema();
  } catch (error) {
    console.error('No se pudo leer la información del sistema:', error);
  }

  if (!info || !info.ok) {
    diagnosticoEl.textContent =
      'No pude leer la información de tu equipo. ' +
      (info && info.error ? `Detalle: ${info.error}` : 'Inténtalo de nuevo.');
    return;
  }

  pintarDiagnostico(info);
  pintarConsejos(info);
}

function formatearBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 GB';
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(1)} GB`;
}

function pintarDiagnostico(info) {
  const enUso = info.memoriaTotalBytes - info.memoriaLibreBytes;
  const porcentajeUso = Math.round((enUso / info.memoriaTotalBytes) * 100);

  const filas = [
    ['Plataforma', `${info.plataforma} (${info.arquitectura})`],
    ['Procesador', info.modeloCpu],
    ['Núcleos', String(info.nucleos)],
    ['Memoria total', formatearBytes(info.memoriaTotalBytes)],
    ['Memoria libre', `${formatearBytes(info.memoriaLibreBytes)} (${100 - porcentajeUso}%)`],
    ['Uso de memoria', `${porcentajeUso}%`],
    ['Electron / Chrome', `${info.versionElectron} / ${info.versionChrome}`],
    ['Node', info.versionNode],
  ];

  diagnosticoEl.innerHTML = filas
    .map(([etiqueta, valor]) => `
      <div class="optimizar-fila">
        <span class="optimizar-fila__etiqueta">${escaparHtml(etiqueta)}</span>
        <span class="optimizar-fila__valor">${escaparHtml(valor)}</span>
      </div>
    `)
    .join('');
}

// Genera recomendaciones según lo que se haya detectado.
function pintarConsejos(info) {
  const consejos = generarConsejos(info);
  if (consejos.length === 0) {
    consejosEl.innerHTML = '<p class="optimizar-ok">Tu equipo va bien para AIRAOS. No veo nada que optimizar.</p>';
    return;
  }

  consejosEl.innerHTML = '<h3>Recomendaciones</h3>' + consejos
    .map((c) => `<div class="optimizar-consejo">${escaparHtml(c)}</div>`)
    .join('');
}

function generarConsejos(info) {
  const consejos = [];

  const totalGb = info.memoriaTotalBytes / (1024 ** 3);
  const libreGb = info.memoriaLibreBytes / (1024 ** 3);
  const porcentajeUso = Math.round(((info.memoriaTotalBytes - info.memoriaLibreBytes) / info.memoriaTotalBytes) * 100);

  if (totalGb < 4) {
    consejos.push(
      'Tu equipo tiene poca memoria en total (' + formatearBytes(info.memoriaTotalBytes) + '). ' +
      'Cierra otras apps pesadas mientras usas AIRAOS.'
    );
  }
  if (porcentajeUso >= 85) {
    consejos.push(
      'La memoria está muy usada ahora mismo (' + porcentajeUso + '%). ' +
      'Cerrar pestañas o programas que no uses ayudará bastante.'
    );
  }

  if (info.nucleos <= 2) {
    consejos.push(
      'Tu procesador tiene ' + info.nucleos + ' núcleo(s). ' +
      'Para tareas pesadas (como el avatar 3D de fases futuras), ve con calma.'
    );
  }

  // Si las voces de sistema no están, es una mejora concreta para la voz de AIRA.
  const sinVoces = ('speechSynthesis' in window) && window.speechSynthesis.getVoices().length === 0;
  if (sinVoces) {
    consejos.push(
      'No tienes voces de sistema instaladas, así que mi voz no suena. ' +
      'En Linux: sudo apt install espeak-ng speech-dispatcher'
    );
  }

  // Si ya hay muchas conversaciones guardadas, avisar es útil.
  if (historial.length > 200) {
    consejos.push(
      'Guardamos ya ' + historial.length + ' mensajes en mi memoria. Si quieres,' +
      ' puedo empezar a resumir conversaciones antiguas para ir más ligera.'
    );
  }

  return consejos;
}

// Versión para el chat: responde con un resumen del equipo y las recomendaciones
// que más importan, sin abrir el panel.
async function diagnosticarEquipoEnChat() {
  let info = null;
  try {
    info = await window.airaos.infoSistema();
  } catch (error) {
    console.error('No se pudo leer la información del sistema:', error);
  }

  if (!info || !info.ok) {
    agregarMensaje(
      'No pude leer la información de tu equipo' +
      (info && info.error ? ` (detalle: ${info.error})` : '') + '.',
      'aira'
    );
    return;
  }

  const porcentajeUso = Math.round(
    ((info.memoriaTotalBytes - info.memoriaLibreBytes) / info.memoriaTotalBytes) * 100
  );

  let respuesta =
    'Así va tu equipo:\n' +
    `- Procesador: ${info.modeloCpu} (${info.nucleos} núcleos)\n` +
    `- Memoria: ${formatearBytes(info.memoriaLibreBytes)} libres de ${formatearBytes(info.memoriaTotalBytes)} (${porcentajeUso}% en uso)\n` +
    `- Sistema: ${info.plataforma} ${info.arquitectura}`;

  const consejos = generarConsejos(info);
  respuesta += consejos.length > 0
    ? '\n\nRecomendaciones:\n' + consejos.map((c) => `- ${c}`).join('\n')
    : '\n\nTu equipo va bien para AIRAOS; no veo nada que optimizar.';

  agregarMensaje(respuesta, 'aira');
}

// --- 14) Control de medios por voz (Fase 7) --------------------------------
//
// AIRAOS no tiene reproductor propio: controla el que ya tengas abierto
// (Spotify, navegador, VLC) usando herramientas estándar de Linux. Si no
// están instaladas, te lo dice exactamente en vez de fallar en silencio.

function interpretarOrdenDeMedia(textoOriginal) {
  const texto = textoOriginal.toLowerCase();

  if (/(activa|pon).*(modo )?silencio|silenc(ia|ie|iate|iarte)|mutea|quita el sonido/.test(texto)) {
    return { accion: 'silenciar', mensaje: 'Silenciando el sistema.' };
  }
  if (/(quita|desactiva).*silencio|activa (el )?sonido|deja de silenciar/.test(texto)) {
    return { accion: 'activar-sonido', mensaje: 'Sonido activado de nuevo.' };
  }
  if (/sube.*(volumen)|más fuerte|más alto el volumen/.test(texto)) {
    return { accion: 'volumen-subir', mensaje: 'Subiendo el volumen.' };
  }
  if (/baja.*(volumen)|más bajo el volumen/.test(texto)) {
    return { accion: 'volumen-bajar', mensaje: 'Bajando el volumen.' };
  }
  if (/(siguiente|avanza|cambia de) canci[oó]n|siguiente canci[oó]n|next/.test(texto)) {
    return { accion: 'siguiente', mensaje: 'Pasando a la siguiente canción.' };
  }
  if (/(anterior|atr[aá]s) canci[oó]n|canci[oó]n anterior/.test(texto)) {
    return { accion: 'anterior', mensaje: 'Volviendo a la canción anterior.' };
  }
  if (/(pausa|pon en pausa|dale play|reanuda|reproduce) (la )?m[uú]sica|play.pause/.test(texto)) {
    return { accion: 'play-pause', mensaje: 'Listo.' };
  }

  return null;
}

async function resolverOrdenDeMedia(orden) {
  const resultado = await window.airaos.controlarMedia(orden.accion);

  if (resultado.ok) {
    agregarMensaje(orden.mensaje, 'aira');
    return;
  }

  // No fallar en silencio: decir exactamente qué falta.
  const necesitaPlayerctl = ['siguiente', 'anterior', 'play-pause'].includes(orden.accion);
  const herramienta = necesitaPlayerctl ? 'playerctl' : 'pactl (paquete pulseaudio-utils)';
  agregarMensaje(
    `No pude hacerlo: ${resultado.error} ` +
    `Instálalo con: sudo apt install ${necesitaPlayerctl ? 'playerctl' : 'pulseaudio-utils'}`,
    'aira'
  );
}

// --- 15) Generación de imágenes (Fase 7) -----------------------------------
//
// Usa el mismo proveedor/API key de Gemini que ya tienes en Configuración,
// con el modelo de imágenes (gemini-3.1-flash-lite-image). Si no hay API
// key configurada, se avisa en vez de fingir que generó algo.

function interpretarOrdenDeImagen(textoOriginal) {
  const patrones = [
    /^(genera|hazme|hazte|dibuja|cr[eé]a)(me)?\s+una\s+imagen\s+de\s+(.+)/i,
    /^(genera|dibuja)\s+(.+)/i,
  ];
  for (const patron of patrones) {
    const coincidencia = textoOriginal.match(patron);
    if (coincidencia) return coincidencia[coincidencia.length - 1].trim();
  }
  return null;
}

async function generarImagenEnChat(promptImagen) {
  const config = obtenerConfig();

  if (!config.apiKey) {
    agregarMensaje(
      'Para generar imágenes necesito una API key configurada (botón ⚙ arriba). ' +
      'Con la misma de Gemini ya sirve.',
      'aira'
    );
    return;
  }

  agregarMensaje(`Generando: "${promptImagen}"…`, 'aira', false);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${config.apiKey}`;
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptImagen }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });

    if (!respuesta.ok) throw new Error(`El servicio respondió con estado ${respuesta.status}`);

    const datos = await respuesta.json();
    const partes = datos.candidates?.[0]?.content?.parts || [];
    const parteImagen = partes.find((p) => p.inlineData);

    if (!parteImagen) throw new Error('La respuesta no incluyó ninguna imagen.');

    const { mimeType, data } = parteImagen.inlineData;
    const dataUrl = `data:${mimeType};base64,${data}`;

    agregarImagenMensaje(dataUrl);

    const extension = mimeType.split('/')[1] || 'png';
    const guardado = await window.airaos.guardarImagen({ base64: data, extension });
    if (guardado.ok) {
      agregarMensaje(`Guardada en: ${guardado.ruta}`, 'aira', false);
    }
  } catch (error) {
    console.error('Error generando imagen:', error);
    agregarMensaje(`No pude generar la imagen: ${error.message}`, 'aira');
  }
}

function agregarImagenMensaje(dataUrl) {
  const burbuja = document.createElement('div');
  burbuja.className = 'mensaje mensaje--aira mensaje--imagen';

  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = 'Imagen generada por AIRA';
  img.className = 'mensaje-imagen';

  burbuja.appendChild(img);
  mensajesEl.appendChild(burbuja);
  mensajesEl.scrollTop = mensajesEl.scrollHeight;

  // Guardamos una referencia liviana en el historial (no el base64 completo,
  // para no inflar memoria.json) — solo que hubo una imagen aquí.
  historial.push({ de: 'aira', texto: '[Imagen generada]', fecha: Date.now() });
  window.airaos.guardarMemoria({ historial, recordatorios }).catch(() => {});
}
