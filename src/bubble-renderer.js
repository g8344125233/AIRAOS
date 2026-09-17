// bubble-renderer.js
// Al hacer clic, muestra/oculta la ventana principal. Además, reacciona
// visualmente cuando AIRA habla o escucha, y puede recolorearse.

const burbuja = document.getElementById('burbuja');

burbuja.addEventListener('click', () => {
  window.airaos.toggleMainWindow();
});

// La ventana principal avisa el estado ('hablando' | 'escuchando' | 'reposo').
window.airaos.alCambiarEstadoVoz((estado) => {
  burbuja.classList.toggle('hablando', estado === 'hablando');
  burbuja.classList.toggle('escuchando', estado === 'escuchando');
  // 'bailando' y 'reposo' => modo idle: late lento y tenue, no distrae.
  burbuja.classList.toggle('idle', estado === 'reposo' || estado === 'bailando');
});

// Estilo/color de la burbuja, elegido desde la configuración de la ventana
// principal. `estilo` es un objeto { color1..color5 } en formato hexadecimal.
window.airaos.alCambiarEstiloBurbuja((estilo) => {
  if (!estilo) return;
  const raiz = document.documentElement.style;
  if (estilo.color1) raiz.setProperty('--color-1', estilo.color1);
  if (estilo.color2) raiz.setProperty('--color-2', estilo.color2);
  if (estilo.color3) raiz.setProperty('--color-3', estilo.color3);
  if (estilo.color4) raiz.setProperty('--color-4', estilo.color4);
  if (estilo.color5) raiz.setProperty('--color-5', estilo.color5);
});

// Ondulación ligada al volumen mientras AIRA habla (Fase 2): analizamos la
// señal de audio real del TTS y escamos el orbe en consecuencia. Si no hay
// audio disponible (por ejemplo, camino "sin voces" de Linux), simplemente
// no se escala — la animación base sigue funcionando igual.
(function () {
  let contextoAudio = null;
  let analizador = null;
  let datos = null;
  let conectado = false;

  function conectarAlAudio() {
    try {
      if (conectado) return;
      // Todos los <audio> de la app TTS viven en la ventana principal, no
      // aquí; creamos un Analyser y lo enganchamos al MediaStream del
      // elemento de audio si la API lo permite. Si falla, no pasa nada:
      // la burbuja ya tiene su animación base.
      const audios = window.audioPlayers || [];
      for (const audio of audios) {
        if (!contextoAudio) {
          contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
        }
        const fuente = contextoAudio.createMediaElementSource(audio);
        analizador = contextoAudio.createAnalyser();
        analizador.fftSize = 256;
        datos = new Uint8Array(analizador.frequencyBinCount);
        fuente.connect(analizador);
        conectado = true;
        break;
      }
    } catch { /* sin análisis de volumen disponible */ }
  }

  function animar() {
    if (conectado && analizador && datos) {
      analizador.getByteFrequencyData(datos);
      let suma = 0;
      for (let i = 0; i < datos.length; i++) suma += datos[i];
      const promedio = suma / datos.length / 255; // 0..1
      if (burbuja.classList.contains('hablando')) {
        const escala = 1 + promedio * 0.25;
        burbuja.style.setProperty('--escala-audio', escala.toFixed(3));
      } else {
        burbuja.style.setProperty('--escala-audio', '1');
      }
    }
    requestAnimationFrame(animar);
  }

  // Intentamos conectar cada vez que AIRA empiece a hablar.
  window.airaos.alCambiarEstadoVoz((estado) => {
    if (estado === 'hablando') conectarAlAudio();
  });

  requestAnimationFrame(animar);
})();
