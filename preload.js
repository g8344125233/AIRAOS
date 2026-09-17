// preload.js
// Puente seguro entre el HTML (main window y bubble) y Node/Electron.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('airaos', {
  version: '0.10.0',

  toggleMainWindow: () => ipcRenderer.send('toggle-main-window'),

  // Memoria persistente (historial de chat guardado en disco).
  guardarMemoria: (datos) => ipcRenderer.invoke('memoria:guardar', datos),
  cargarMemoria: () => ipcRenderer.invoke('memoria:cargar'),
  preguntarCerebroLocal: (datos) => ipcRenderer.invoke('ia:chat-local', datos),
  estadoCerebroLocal: (datos) => ipcRenderer.invoke('ia:estado-local', datos),

  // Diagnóstico del equipo (Fase 5): núcleos, CPU, memoria, versiones.
  infoSistema: () => ipcRenderer.invoke('sistema:info'),
  auditarSeguridad: () => ipcRenderer.invoke('seguridad:auditar'),

  // Estado de voz (Fase 6): la ventana principal avisa cuando AIRA
  // habla o escucha, y la burbuja lo escucha para reaccionar visualmente.
  avisarEstadoVoz: (estado) => ipcRenderer.send('voz:estado', estado),
  alCambiarEstadoVoz: (callback) => ipcRenderer.on('voz:estado', (_evento, estado) => callback(estado)),

  // Color/estilo de la burbuja, configurable desde la ventana principal.
  guardarEstiloBurbuja: (estilo) => ipcRenderer.send('burbuja:estilo', estilo),
  alCambiarEstiloBurbuja: (callback) => ipcRenderer.on('burbuja:estilo', (_evento, estilo) => callback(estilo)),

  // Control de medios (Fase 7): canciones y volumen, vía playerctl/pactl.
  controlarMedia: (accion) => ipcRenderer.invoke('media:control', accion),

  // Música local (Fase 4): listar y abrir archivos de la carpeta de Música.
  listarMusica: () => ipcRenderer.invoke('musica:listar'),
  rutaArchivoMusica: (nombre) => ipcRenderer.invoke('musica:ruta-archivo', nombre),

  // Descargador (Fase 4): baja audio/vídeo con yt-dlp si está instalado.
  descargarMedia: (datos) => ipcRenderer.invoke('descargar:media', datos),

  // Guardar una imagen generada (base64) como archivo real en disco.
  guardarImagen: (datos) => ipcRenderer.invoke('imagen:guardar', datos),
  guardarDocumento: (datos) => ipcRenderer.invoke('documento:guardar', datos),
  exportarDocumento: (datos) => ipcRenderer.invoke('documento:exportar', datos),

  // --- Avatar libre (mascota de escritorio) --------------------------------
  // Solo los usa la ventana avatarWindow; la burbuja y la principal los ignoran.
  avatarRatonEncima: (encima) => ipcRenderer.send('avatar:mouse-over', encima),
  avatarRegion: (rect) => ipcRenderer.send('avatar:region', rect),
  avatarArrastreInicio: (punto) => ipcRenderer.send('avatar:arrastre-inicio', punto),
  avatarArrastreMover: (punto) => ipcRenderer.send('avatar:arrastre-mover', punto),
  avatarArrastreFin: () => ipcRenderer.send('avatar:arrastre-fin'),
  avatarClic: () => ipcRenderer.send('avatar:clic'),
  avatarEstaOcupada: () => ipcRenderer.invoke('avatar:ocupada'),
  avatarVisibilidad: (visible) => ipcRenderer.send('avatar:visibilidad', Boolean(visible)),
});
