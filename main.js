// main.js
// Proceso principal de Electron. Ahora maneja DOS ventanas:
//  - mainWindow: la app completa (avatar + chat).
//  - bubbleWindow: la burbuja flotante estilo Siri, siempre encima,
//    que muestra/oculta la ventana principal al hacer clic.

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { Document, HeadingLevel, Packer, Paragraph, TextRun } = require('docx');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const XLSX = require('xlsx');
const PptxGenJS = require('pptxgenjs');

// Defensa contra un problema real y confuso de entorno:
// si la sesión trae ELECTRON_RUN_AS_NODE=1 (lo fuerza el toolkit del editor),
// Electron arranca como Node puro: "app", "BrowserWindow" e "ipcMain" llegan
// como undefined y el programa revienta más abajo con un críptico
// "Cannot read properties of undefined (reading 'handle')".
// Es mejor decirlo claro y salir, que fallar con un error que no explica nada.
if (!app || !BrowserWindow || !ipcMain) {
  console.error(
    '\nAIRAOS no pudo arrancar como Electron.\n' +
    'Parece que la variable ELECTRON_RUN_AS_NODE está activa en tu sesión,\n' +
    'lo que hace que Electron corra como Node normal (sin ventanas).\n\n' +
    'Solución:  npm run start:limpio\n'
  );
  process.exit(1);
}

let mainWindow = null;
let bubbleWindow = null;
// Ventana del avatar de pantalla completa (Fase: avatar con vida propia).
let avatarWindow = null;
// Última región (rect) donde está dibujado el avatar dentro de su ventana.
// La reporta el propio renderer del avatar; la usa la lógica de clics.
let regionAvatar = null;

// Archivo donde se guarda la memoria de AIRA (historial de chat).
// app.getPath('userData') es una carpeta propia de la app, separada
// del código fuente — sobrevive a reinstalaciones y updates.
const ARCHIVO_MEMORIA = () => path.join(app.getPath('userData'), 'memoria.json');

async function guardarMemoria(datos) {
  await fs.writeFile(ARCHIVO_MEMORIA(), JSON.stringify(datos, null, 2), 'utf-8');
  return true;
}

async function cargarMemoria() {
  try {
    const contenido = await fs.readFile(ARCHIVO_MEMORIA(), 'utf-8');
    return JSON.parse(contenido);
  } catch {
    // Si el archivo no existe todavía (primera vez que se abre AIRAOS),
    // no es un error real: simplemente no hay memoria previa.
    return null;
  }
}

ipcMain.handle('memoria:guardar', (_evento, datos) => guardarMemoria(datos));
ipcMain.handle('memoria:cargar', () => cargarMemoria());

// --- Cerebro local ---------------------------------------------------------
// AIRAOS no ejecuta un GGUF directamente: necesita un runtime como Ollama o
// LM Studio. Mantener esta llamada en el proceso principal evita exponer
// detalles de red y permite reutilizar el mismo contrato desde futuras UI.
ipcMain.handle('ia:chat-local', async (_evento, datos = {}) => {
  const endpoint = String(datos.endpoint || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const modelo = String(datos.modelo || 'qwen2.5:1.5b').trim();
  const mensajes = Array.isArray(datos.mensajes) ? datos.mensajes.slice(-24) : [];

  if (!/^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(endpoint)) {
    return { ok: false, error: 'El cerebro local solo puede usar un servidor en 127.0.0.1.' };
  }
  if (!modelo || mensajes.length === 0) {
    return { ok: false, error: 'Faltan el modelo o los mensajes para consultar el cerebro local.' };
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 120000);
  try {
    const esOllama = endpoint.includes(':11434');
    const respuesta = await fetch(
      esOllama ? `${endpoint}/api/chat` : `${endpoint}/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controlador.signal,
        body: JSON.stringify(esOllama
          ? { model: modelo, messages, stream: false }
          : { model: modelo, messages, temperature: 0.7, stream: false }),
      }
    );

    if (!respuesta.ok) {
      return { ok: false, error: `El servidor local respondió con estado ${respuesta.status}.` };
    }
    const datosRespuesta = await respuesta.json();
    const texto = esOllama
      ? datosRespuesta.message?.content
      : datosRespuesta.choices?.[0]?.message?.content;
    return texto
      ? { ok: true, texto: String(texto) }
      : { ok: false, error: 'El servidor local no devolvió texto.' };
  } catch (error) {
    const errorTexto = error?.name === 'AbortError'
      ? 'El cerebro local tardó demasiado en responder.'
      : 'No pude conectar con el cerebro local. Abre Ollama o LM Studio y verifica el modelo.';
    return { ok: false, error: errorTexto };
  } finally {
    clearTimeout(temporizador);
  }
});

ipcMain.handle('ia:estado-local', async (_evento, datos = {}) => {
  const endpoint = String(datos.endpoint || 'http://127.0.0.1:11434').replace(/\/$/, '');
  if (!/^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(endpoint)) {
    return { ok: false, disponible: false, modelos: [], error: 'El servidor local debe estar en 127.0.0.1.' };
  }
  try {
    const esOllama = endpoint.includes(':11434');
    const respuesta = await fetch(esOllama ? `${endpoint}/api/tags` : `${endpoint}/v1/models`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!respuesta.ok) return { ok: false, disponible: false, modelos: [], error: `Estado ${respuesta.status}.` };
    const datosRespuesta = await respuesta.json();
    const modelos = esOllama
      ? (datosRespuesta.models || []).map((modelo) => modelo.name)
      : (datosRespuesta.data || []).map((modelo) => modelo.id);
    return { ok: true, disponible: true, modelos };
  } catch {
    return { ok: true, disponible: false, modelos: [], error: 'El servidor local no está iniciado.' };
  }
});

// --- Diagnóstico del equipo (Fase 5: AIRA optimiza su dispositivo) -------
//
// Todo se lee del propio sistema con módulos de Node (os) y de Electron
// (process.getSystemMemoryInfo), sin comandos externos ni dependencias.
// Es información de MÁQUINA, no personal: no sale de tu equipo.
const os = require('node:os');

// --- Control de medios (Fase 7): canciones y volumen por voz --------------
//
// AIRAOS no tiene reproductor propio: le habla al que ya tengas abierto
// (Spotify, navegador, VLC...) a través de herramientas estándar de Linux:
//  - playerctl: siguiente/anterior/pausa (protocolo MPRIS)
//  - pactl: volumen y silencio del sistema (PulseAudio/PipeWire)
// Si no están instaladas, se avisa exactamente qué instalar — nunca falla
// en silencio.
const { execFile } = require('node:child_process');

function ejecutar(comando, args) {
  return new Promise((resolve) => {
    execFile(comando, args, (error, stdout, stderr) => {
      if (error) {
        const noEncontrado = error.code === 'ENOENT';
        resolve({
          ok: false,
          error: noEncontrado
            ? `"${comando}" no está instalado en tu sistema.`
            : String(stderr || error.message),
        });
        return;
      }
      resolve({ ok: true, salida: stdout.trim() });
    });
  });
}

const ACCIONES_MEDIA = {
  'play-pause': () => ejecutar('playerctl', ['play-pause']),
  'siguiente': () => ejecutar('playerctl', ['next']),
  'anterior': () => ejecutar('playerctl', ['previous']),
  'volumen-subir': () => ejecutar('pactl', ['set-sink-volume', '@DEFAULT_SINK@', '+10%']),
  'volumen-bajar': () => ejecutar('pactl', ['set-sink-volume', '@DEFAULT_SINK@', '-10%']),
  'silenciar': () => ejecutar('pactl', ['set-sink-mute', '@DEFAULT_SINK@', '1']),
  'activar-sonido': () => ejecutar('pactl', ['set-sink-mute', '@DEFAULT_SINK@', '0']),
};

ipcMain.handle('media:control', async (_evento, accion) => {
  const funcion = ACCIONES_MEDIA[accion];
  if (!funcion) return { ok: false, error: `Acción de media desconocida: ${accion}` };
  return funcion();
});

// --- Música local (Fase 4: reproductor) -----------------------------------
//
// AIRA no trae canciones: lee los archivos de audio que ya tengas en tu
// carpeta de Música (o una ruta personalizada guardada por el usuario).
// Es integración, no duplicación — misma idea que con playerctl.
// AVISO: si la carpeta no existe o no hay archivos compatibles, el renderer
// lo muestra con un aviso claro; no se inventan canciones.
const EXTENSIONES_AUDIO = new Set(['.mp3', '.ogg', '.wav', '.flac', '.m4a', '.opus', '.webm']);

function carpetaMusica() {
  // Ruta personalizada guardada en memoria.json, o la estándar de Linux.
  return configMusica.ruta || path.join(app.getPath('home'), 'Música');
}

let configMusica = { ruta: '' };

ipcMain.handle('musica:listar', async () => {
  try {
    const carpeta = carpetaMusica();
    const nombres = await fs.readdir(carpeta);
    const audios = nombres
      .filter((n) => EXTENSIONES_AUDIO.has(path.extname(n).toLowerCase()))
      .sort();
    return { ok: true, carpeta, archivos: audios };
  } catch (error) {
    const codigo = error && error.code;
    return {
      ok: false,
      carpeta: carpetaMusica(),
      error: codigo === 'ENOENT'
        ? 'No encontré tu carpeta de Música. Créala o elige otra ruta en el panel 🎵.'
        : String(error && error.message ? error.message : error),
    };
  }
});

ipcMain.handle('musica:ruta', (_evento, nuevaRuta) => {
  try {
    configMusica.ruta = String(nuevaRuta || '').trim();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
});

// Devuelve la ruta absoluta de un archivo de la carpeta de música, para que
// el renderer la cargue como file://. Sin esto, un nombre suelto no sirve.
ipcMain.handle('musica:ruta-archivo', (_evento, nombre) => {
  try {
    const ruta = path.join(carpetaMusica(), path.basename(String(nombre)));
    return { ok: true, ruta };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
});

// --- Descargador de video/audio (Fase 4 pendiente → implementado) ----------
//
// Requiere yt-dlp instalado en el sistema. NO viene con AIRAOS: si falta, se
// avisa con el comando exacto para instalarlo (regla 3 del proyecto).
// Por defecto descarga solo el AUDIO (para el reproductor 🎵); con
// "descargar video <url>" baja el vídeo a ~/Descargas.
// AVISO: úsalo solo con contenido que tengas derecho a descargar.

ipcMain.handle('descargar:media', (_evento, { url, modo }) => {
  const esVideo = modo === 'video';
  const carpetaDestino = esVideo
    ? path.join(app.getPath('home'), 'Descargas')
    : carpetaMusica();
  const args = [
    '--no-playlist',
    '-o', path.join(carpetaDestino, '%(title)s.%(ext)s'),
  ];
  if (!esVideo) args.push('-x', '--audio-format', 'mp3');
  args.push(String(url || ''));

  return new Promise((resolver) => {
    execFile('yt-dlp', args, { timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        const noEncontrado = error.code === 'ENOENT';
        resolver({
          ok: false,
          error: noEncontrado
            ? 'yt-dlp no está instalado. En Linux: sudo apt install yt-dlp (o pip install yt-dlp).'
            : String(stderr || error.message).slice(-500),
        });
        return;
      }
      resolver({ ok: true, carpeta: carpetaDestino, salida: String(stdout).slice(-300) });
    });
  });
});

// --- Guardar imágenes generadas por IA -------------------------------------

ipcMain.handle('imagen:guardar', async (_evento, { base64, extension }) => {
  try {
    const carpeta = path.join(app.getPath('userData'), 'imagenes');
    await fs.mkdir(carpeta, { recursive: true });
    const nombreArchivo = `aira-${Date.now()}.${extension || 'png'}`;
    const rutaCompleta = path.join(carpeta, nombreArchivo);
    await fs.writeFile(rutaCompleta, Buffer.from(base64, 'base64'));
    return { ok: true, ruta: rutaCompleta };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
});

ipcMain.handle('documento:guardar', async (_evento, datos = {}) => {
  try {
    const carpeta = path.join(app.getPath('documents'), 'AIRAOS');
    await fs.mkdir(carpeta, { recursive: true });
    const titulo = String(datos.titulo || 'documento-aira')
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'documento-aira';
    const formato = ['md', 'html', 'txt'].includes(datos.formato) ? datos.formato : 'md';
    const ruta = path.join(carpeta, `${titulo}.${formato}`);
    const contenido = String(datos.contenido || '');
    await fs.writeFile(ruta, contenido, 'utf-8');
    return { ok: true, ruta, formato };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

function lineasDocumento(contenido) {
  return String(contenido || '').split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
}

function nombreDocumento(titulo, formato) {
  const limpio = String(titulo || 'documento-aira')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 80) || 'documento-aira';
  return `${limpio}.${formato}`;
}

ipcMain.handle('documento:exportar', async (_evento, datos = {}) => {
  const formato = String(datos.formato || 'md').toLowerCase();
  const formatos = new Set(['md', 'html', 'txt', 'docx', 'pdf', 'xlsx', 'pptx']);
  if (!formatos.has(formato)) return { ok: false, error: `Formato no soportado: ${formato}` };

  try {
    const carpeta = path.join(app.getPath('documents'), 'AIRAOS');
    await fs.mkdir(carpeta, { recursive: true });
    const titulo = String(datos.titulo || 'Documento AIRAOS');
    const contenido = String(datos.contenido || '');
    const lineas = lineasDocumento(contenido);
    const ruta = path.join(carpeta, nombreDocumento(titulo, formato));

    if (formato === 'md' || formato === 'txt' || formato === 'html') {
      const salida = formato === 'html'
        ? `<!doctype html><html lang="es"><meta charset="utf-8"><title>${titulo}</title><body><pre>${contenido.replace(/[&<>]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[caracter]))}</pre></body></html>`
        : contenido;
      await fs.writeFile(ruta, salida, 'utf-8');
    } else if (formato === 'docx') {
      const parrafos = lineas.map((linea) => {
        const esTitulo = linea.startsWith('#');
        return new Paragraph({
          text: linea.replace(/^#+\s*/, ''),
          heading: esTitulo ? HeadingLevel.HEADING_2 : undefined,
          spacing: { after: 160 },
        });
      });
      const documento = new Document({ sections: [{ children: [
        new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
        ...parrafos,
      ] }] });
      await fs.writeFile(ruta, await Packer.toBuffer(documento));
    } else if (formato === 'pdf') {
      const pdf = await PDFDocument.create();
      const fuente = await pdf.embedFont(StandardFonts.Helvetica);
      let pagina = pdf.addPage([595, 842]);
      let y = 790;
      for (const linea of [titulo, ...lineas]) {
        for (const fragmento of String(linea).match(/.{1,88}(?:\s|$)/g) || [linea]) {
          if (y < 54) { pagina = pdf.addPage([595, 842]); y = 790; }
          pagina.drawText(fragmento.trim(), { x: 42, y, size: linea === titulo ? 18 : 11, font: fuente, color: rgb(0.12, 0.08, 0.2) });
          y -= linea === titulo ? 28 : 17;
        }
      }
      await fs.writeFile(ruta, await pdf.save());
    } else if (formato === 'xlsx') {
      const libro = XLSX.utils.book_new();
      const hoja = XLSX.utils.aoa_to_sheet([[titulo], ...lineas.map((linea, indice) => [indice + 1, linea])]);
      XLSX.utils.book_append_sheet(libro, hoja, 'AIRAOS');
      await fs.writeFile(ruta, XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }));
    } else if (formato === 'pptx') {
      const presentacion = new PptxGenJS();
      presentacion.author = 'AIRAOS';
      let diapositiva = presentacion.addSlide();
      diapositiva.addText(titulo, { x: 0.7, y: 0.5, w: 11.5, h: 0.6, fontSize: 25, bold: true, color: '39215F' });
      diapositiva.addText(lineas.slice(0, 12).join('\n'), { x: 0.8, y: 1.4, w: 11, h: 5.2, fontSize: 18, breakLine: false, color: '25202D', margin: 0.08 });
      await presentacion.writeFile({ fileName: ruta });
    }
    return { ok: true, ruta, formato };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('sistema:info', () => {
  try {
    const cpus = os.cpus() || [];
    const memoriaTotal = os.totalmem();
    const memoriaLibre = os.freem();

    let memoriaSistema = null;
    try {
      // getSystemMemoryInfo da la memoria real del equipo (no solo la del proceso).
      memoriaSistema = process.getSystemMemoryInfo();
    } catch {
      memoriaSistema = null; // en algunos entornos no está disponible
    }

    return {
      ok: true,
      plataforma: process.platform,
      arquitectura: process.arch,
      nucleos: cpus.length,
      modeloCpu: cpus[0] ? cpus[0].model.trim() : 'desconocido',
      memoriaTotalBytes: memoriaTotal,
      memoriaLibreBytes: memoriaLibre,
      memoriaSistema, // { total, free, ... } en kilobytes, o null
      uptimeSegundos: os.uptime(),
      versionElectron: process.versions.electron,
      versionNode: process.versions.node,
      versionChrome: process.versions.chrome,
    };
  } catch (error) {
    // Regla 2 del proyecto: nunca asumir que todo va a funcionar.
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
});

ipcMain.handle('seguridad:auditar', async () => {
  const plataforma = process.platform;
  const resultado = {
    ok: true,
    plataforma,
    firewall: { estado: 'desconocido', detalle: '' },
    puertos: { estado: 'no comprobado', detalle: '' },
    antivirus: { estado: 'no instalado', detalle: 'ClamAV no está disponible.' },
    nota: 'Auditoría de solo lectura. No modifica archivos ni reglas del sistema.',
  };

  if (plataforma === 'linux') {
    const firewall = await ejecutar('ufw', ['status']);
    resultado.firewall = firewall.ok
      ? { estado: /Status: active/i.test(firewall.salida) ? 'activo' : 'inactivo', detalle: firewall.salida }
      : { estado: 'no disponible', detalle: firewall.error };

    const puertos = await ejecutar('ss', ['-lnt']);
    resultado.puertos = puertos.ok
      ? { estado: 'revisado', detalle: puertos.salida.split('\n').slice(0, 18).join('\n') }
      : { estado: 'no disponible', detalle: puertos.error };

    const clamav = await ejecutar('clamscan', ['--version']);
    if (clamav.ok) resultado.antivirus = { estado: 'instalado', detalle: clamav.salida };
  }

  return resultado;
});

function crearVentanaPrincipal() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    backgroundColor: '#14101F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  // mainWindow.webContents.openDevTools();
}

function crearBurbuja() {
  // Posiciona la burbuja en el borde derecho de la pantalla, a media altura.
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const TAMANO = 72;

  bubbleWindow = new BrowserWindow({
    width: TAMANO,
    height: TAMANO,
    x: width - TAMANO - 24,
    y: 220,
    frame: false,        // sin bordes de ventana
    transparent: true,   // fondo transparente, solo se ve el círculo
    alwaysOnTop: true,   // siempre encima de otras apps
    resizable: false,
    skipTaskbar: true,   // no aparece en la barra de tareas
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  bubbleWindow.loadFile(path.join(__dirname, 'src', 'bubble.html'));
}

// --- Ventana del avatar libre (mascota de escritorio) ----------------------
//
// Una ventana transparente del tamaño de TODA la zona de trabajo, siempre
// encima, que NO roba clics: por defecto ignora el mouse (setIgnoreMouseEvents
// con forward:true) y solo se "activa" cuando el cursor está sobre el avatar
// (lo decide el renderer comparando la posición del mouse con su rect).
//
// AVISO honesto: setIgnoreMouseEvents(true, { forward: true }) depende del
// gestor de ventanas. En X11 funciona; en Wayland con ciertos compositores
// el "forward" puede no entregar mousemove. Si el avatar no reacciona al
// cursor en tu escritorio, es esto, no el código.

function crearAvatarVentana() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  avatarWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false, // no roba el foco de la app que estés usando
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  avatarWindow.loadFile(path.join(__dirname, 'src', 'avatar.html'));
  try {
    avatarWindow.setIgnoreMouseEvents(true, { forward: true });
  } catch (error) {
    console.warn('setIgnoreMouseEvents no disponible:', error);
  }
}

ipcMain.on('avatar:visibilidad', (_evento, visible) => {
  if (!avatarWindow || avatarWindow.isDestroyed()) return;
  if (visible) avatarWindow.showInactive();
  else avatarWindow.hide();
});

// El renderer del avatar avisa si el cursor está (o no) sobre él.
ipcMain.on('avatar:mouse-over', (_evento, encima) => {
  if (!avatarWindow || avatarWindow.isDestroyed()) return;
  try {
    avatarWindow.setIgnoreMouseEvents(!encima, { forward: true });
  } catch {}
});

// El renderer reporta su rect (relativo a su ventana) para depuración y para
// saber dónde está el avatar sin adivinarlo en el proceso principal.
ipcMain.on('avatar:region', (_evento, rect) => {
  regionAvatar = rect;
});

// Arrastre manual: el renderer manda coordenadas de pantalla del cursor.
// Guardamos el offset entre el cursor y la esquina de la ventana al empezar,
// y movemos la ventana manteniendo ese offset (como arrastrar de verdad).
let offsetArrastre = null;

ipcMain.on('avatar:arrastre-inicio', (_evento, punto) => {
  if (!avatarWindow || avatarWindow.isDestroyed()) return;
  try {
    const [x, y] = avatarWindow.getPosition();
    offsetArrastre = { dx: punto.x - x, dy: punto.y - y };
  } catch {
    offsetArrastre = null;
  }
});

ipcMain.on('avatar:arrastre-mover', (_evento, punto) => {
  if (!avatarWindow || avatarWindow.isDestroyed() || !offsetArrastre) return;
  try {
    avatarWindow.setPosition(punto.x - offsetArrastre.dx, punto.y - offsetArrastre.dy);
  } catch {}
});

ipcMain.on('avatar:arrastre-fin', () => {
  offsetArrastre = null;
});

// Clic sobre el avatar: abre/enfoca la ventana principal (igual que la burbuja).
ipcMain.on('avatar:clic', () => {
  if (!mainWindow) return;
  try {
    mainWindow.show();
    mainWindow.focus();
  } catch {}
});

// ¿Está AIRA "ocupada" (hablando/escuchando/pensando)? El renderer principal
// expone window.__airaOcupada(); lo consultamos con executeJavaScript.
// Consultar (sondeo) en vez de notificar evita tocar los 15 sitios donde
// renderer.js cambia la variable `ocupada` — edición quirúrgica.
ipcMain.handle('avatar:ocupada', async () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const valor = await mainWindow.webContents.executeJavaScript(
      'typeof window.__airaOcupada === "function" ? window.__airaOcupada() : false',
      true
    );
    return Boolean(valor);
  } catch {
    return false;
  }
});

// Cuando la burbuja (o la ventana principal) pide alternar visibilidad:
ipcMain.on('toggle-main-window', () => {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});

// La ventana principal avisa "estoy hablando" / "estoy escuchando" / "reposo",
// y lo retransmitimos a la ventana de la burbuja para que reaccione.
ipcMain.on('voz:estado', (_evento, estado) => {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('voz:estado', estado);
  }
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    avatarWindow.webContents.send('voz:estado', estado);
  }
});

// Igual para el color/estilo elegido de la burbuja.
ipcMain.on('burbuja:estilo', (_evento, estilo) => {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('burbuja:estilo', estilo);
  }
});

app.whenReady().then(() => {
  crearVentanaPrincipal();
  crearBurbuja();
  crearAvatarVentana();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      crearVentanaPrincipal();
      crearBurbuja();
      crearAvatarVentana();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
