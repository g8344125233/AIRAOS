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
