(() => {
  const memoriaKey = 'airaos_mobile_memoria';
  const callbacksVoz = [];
  const leer = () => { try { return JSON.parse(localStorage.getItem(memoriaKey) || 'null'); } catch { return null; } };
  const escribir = (datos) => { localStorage.setItem(memoriaKey, JSON.stringify(datos)); return Promise.resolve(true); };
  const avisar = (estado) => callbacksVoz.forEach((callback) => callback(estado));
  window.airaos = {
    version: '0.10.0-android',
    toggleMainWindow: () => {},
    guardarMemoria: escribir,
    cargarMemoria: () => Promise.resolve(leer()),
    preguntarCerebroLocal: async ({ endpoint, modelo, mensajes }) => {
      try {
        const respuesta = await fetch(endpoint.replace(/\/$/, '') + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelo, messages: mensajes, stream: false }) });
        const datos = await respuesta.json();
        return respuesta.ok ? { ok: true, texto: datos.choices?.[0]?.message?.content || 'El modelo no devolvió texto.' } : { ok: false, error: 'El servidor local respondió con estado ' + respuesta.status + '.' };
      } catch { return { ok: false, error: 'No pude conectar con el modelo local desde Android.' }; }
    },
    estadoCerebroLocal: () => Promise.resolve({ ok: true, disponible: false, modelos: [], error: 'Configura un servidor local accesible desde el teléfono.' }),
    infoSistema: () => Promise.resolve({ ok: true, plataforma: 'android', arquitectura: 'webview', nucleos: navigator.hardwareConcurrency || 1, modeloCpu: 'Android', memoriaTotalBytes: 0, memoriaLibreBytes: 0, versionElectron: 'n/a', versionChrome: navigator.userAgent }),
    avisarEstadoVoz: avisar,
    alCambiarEstadoVoz: (callback) => callbacksVoz.push(callback),
    guardarEstiloBurbuja: () => {},
    alCambiarEstiloBurbuja: () => {},
    controlarMedia: () => Promise.resolve({ ok: false, error: 'El control MPRIS pertenece a la integración nativa Android pendiente.' }),
    listarMusica: () => Promise.resolve({ ok: false, archivos: [], error: 'Elige archivos desde el selector Android en la próxima integración nativa.' }),
    rutaArchivoMusica: () => Promise.resolve({ ok: false }),
    descargarMedia: () => Promise.resolve({ ok: false, error: 'El descargador Android requiere el módulo nativo y permisos de almacenamiento.' }),
    guardarImagen: async ({ base64, extension }) => { const enlace = document.createElement('a'); enlace.href = 'data:image/' + extension + ';base64,' + base64; enlace.download = 'aira-' + Date.now() + '.' + extension; enlace.click(); return { ok: true, ruta: enlace.download }; },
    guardarDocumento: async ({ titulo, formato, contenido }) => window.airaos.exportarDocumento({ titulo, formato, contenido }),
    exportarDocumento: async ({ titulo, formato, contenido }) => { const blob = new Blob([contenido], { type: formato === 'html' ? 'text/html' : 'text/plain' }); const enlace = document.createElement('a'); enlace.href = URL.createObjectURL(blob); enlace.download = (titulo || 'documento-aira') + '.' + formato; enlace.click(); return { ok: true, ruta: enlace.download, formato }; },
    auditarSeguridad: () => Promise.resolve({ ok: true, plataforma: 'android', firewall: { estado: 'gestionado por Android' }, puertos: { estado: 'no disponible en WebView' }, antivirus: { estado: 'delegado a Play Protect' }, nota: 'Auditoría limitada en modo web.' }),
    avatarRatonEncima: () => {}, avatarRegion: () => {}, avatarArrastreInicio: () => {}, avatarArrastreMover: () => {}, avatarArrastreFin: () => {}, avatarClic: () => {}, avatarEstaOcupada: () => Promise.resolve(false), avatarVisibilidad: () => {},
  };
})();
