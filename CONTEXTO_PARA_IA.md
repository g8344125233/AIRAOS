# CONTEXTO DEL PROYECTO — pega esto al inicio de cualquier chat con una IA de código (CodeGPT, Continue, Copilot, etc.) antes de pedirle cambios

Estoy desarrollando **AIRAOS**, una app de escritorio (Electron) con un asistente de IA llamado AIRA, con avatar visual. El proyecto sigue un documento de visión completo que puedes pedirme si lo necesitas (`AIRAOS_Vision_y_Roadmap.md`), pero aquí va el resumen operativo:

## Stack (NO cambiar de lenguaje sin avisarme)
- Interfaz: **HTML + CSS + JavaScript puro** (sin frameworks como React).
- Empaquetado de escritorio: **Electron**.
- NO uses Python. NO uses React/Vue. NO reescribas en otro lenguaje aunque parezca "más fácil": el proyecto está construido intencionalmente en HTML/JS/Electron.
- Más adelante habrá un módulo en **C++** para rendimiento e IA local — no es parte del código actual todavía.

## Estructura de archivos actual
```
airaos-skeleton/
├── main.js              → proceso principal de Electron (crea ventanas, IPC, memoria en disco)
├── preload.js            → puente seguro entre main.js y el HTML (window.airaos.*)
├── package.json
├── setup_assets.sh        → copia las imágenes del avatar desde ~/Documentos/AIRAOS/models
└── src/
    ├── index.html         → ventana principal (splash + chat + avatar)
    ├── avatar.html        → avatar libre a pantalla completa (mascota de escritorio)
    ├── avatar-renderer.js   → máquina de estados del avatar (caminar/correr/saltar/bailar)
    ├── bubble.html         → burbuja flotante (ventana aparte, siempre encima)
    ├── bubble-renderer.js
    ├── renderer.js         → toda la lógica: chat, avatar, memoria, voz, configuración
    ├── styles.css
    └── assets/
        ├── avatar/default/  → 7 poses del chibi 2D (flotando, pensando, saludo, etc.)
        └── models/           → aira_default.vrm (para usar en una fase futura, aún no integrado)
```

## Qué ya está implementado (probado y funcionando)
- Fase 0: splash screen con logo de 4 círculos morado/gris.
- Fase 1: chat de texto con respuestas de prueba, avatar que cambia de pose según el estado (pensando/saludo/reposo), burbuja flotante estilo Siri con degradado de colores rotando.
- Fase 2: memoria persistente en disco (la conversación sobrevive a cerrar la app), panel de configuración (⚙) para pegar una API key real de Gemini y salir del modo de prueba, texto a voz (con aviso si Linux no tiene voces instaladas), botón de micrófono (con manejo de error si el reconocimiento de voz falla, cosa común en Electron/Linux).

## En qué fase vamos ahora
**Fase 3 — Productividad** — completada (recordatorios, notas rápidas, temporizador/Pomodoro,
y todo por lenguaje natural).

**Fase 4 — Integración real con IA y personalidad** — completada (personalidad, contexto de
conversación, memoria de hechos a largo plazo y consultas por chat).

**Fase 5 — Voz y optimización del equipo** — en curso (selector de voces estilo Siri/Gemini;
AIRA analiza y recomienda mejoras para el equipo donde se instala).

**Fase — Avatar libre (mascota de escritorio)** — Fase 1 completada. El avatar tiene su
propia ventana transparente y se mueve por TODA la pantalla.

### Qué incluye la Fase 3 (temporizador + Pomodoro)
- Panel ⏱️ en el encabezado con cuenta atrás (reloj MM:SS), pausar/reanudar y cancelar.
- Botones rápidos con el método Pomodoro clásico: 🎯 Enfoque 25m, ☕ Pausa 5m,
  🌿 Pausa larga 15m.
- Temporizador libre escrito en el panel ("estudiar 10 minutos", "1 hora", "30 segundos").
- Por lenguaje natural en el chat: "pon un temporizador de 10 minutos",
  "inicia un pomodoro", "cancelar temporizador".
- El botón ⏱️ muestra el tiempo restante (ej. "⏱️ 24:59").
- Al terminar: notificación del sistema + mensaje en el chat. Solo hay UN temporizador
  activo a la vez (como un reloj real); arrancar otro reemplaza al anterior.

### Qué incluye la Fase 4 (contexto + personalidad)
- **Personalidad de AIRA**: se le envía al modelo una instrucción de sistema que la define
  como asistente cercana, cálida, directa y en español (antes respondía sin personalidad).
- **Contexto real de la conversación**: antes se enviaba SOLO el último mensaje al modelo;
  ahora se envían los últimos 20 turnos para que tenga memoria de lo hablado. Se garantiza
  que el primer turno sea del usuario (requisito de la API de Gemini) y sin duplicar el mensaje.
- **Tu nombre (opcional)**: campo nuevo en Configuración (⚙).

### Qué incluye la Fase 5 (voz: elegir entre voces, estilo Siri/Gemini)
- **Panel de voz 🔊**: elegir la voz de AIRA entre las que tiene el sistema, agrupadas
  en "Español" y "Otros idiomas". Botón "Probar" para oírla antes de guardar.
- **Velocidad y tono** ajustables con deslizadores, y guardados en localStorage.
- **Control de voz por chat**: "habla más despacio", "habla más rápido", "voz más grave",
  "voz más aguda", "silénciate", "activa tu voz", "qué voces tienes".
- **Aviso claro si Linux no tiene voces**, con la guía de instalación
  (`sudo apt install espeak-ng speech-dispatcher`) en vez de fallar en silencio.
- Detalle técnico: en Chromium/Electron `getVoices()` puede devolver vacío la primera vez
  y llenarse después; se escucha el evento `voiceschanged` para refrescar el selector.

### Qué incluye la Fase 5 (AIRA optimiza el equipo donde se instala)
- **Panel 🛠️ "Optimizar este equipo"**: muestra plataforma, CPU, núcleos, memoria total
  y libre, % de uso y versiones de Electron/Chrome/Node.
- **Recomendaciones automáticas** según el equipo (poca memoria, muchos núcleos o pocos,
  sin voces instaladas, historial muy grande).
- Por chat: "optimiza mi equipo", "cómo va mi pc", "diagnóstico del equipo".
- Los datos se leen con módulos de Node (`os`) y de Electron (`process.getSystemMemoryInfo`)
  vía IPC (`sistema:info`), sin comandos externos ni dependencias nuevas.
- **IMPORTANTE (privacidad y seguridad)**: AIRA NO modifica nada del sistema por su cuenta;
  solo informa y recomienda. Es información de máquina, no personal, y no sale del equipo.

### Qué incluye la Fase 4 (memoria a largo plazo y consultas)
- **Memoria de hechos** (panel 🧠): AIRA aprende cosas de ti y las recuerda entre sesiones.
  - Por chat: "recuerda que me gusta el café", "aprende que trabajo de noche",
    "olvida que me gusta el café".
  - Panel 🧠 para verlos/borrarlos a mano; el botón muestra cuántos recuerda (ej. "🧠 3").
  - Se guardan en `memoria.json`, bajo la clave `hechos`.
- **Consultas por chat** (AIRA responde al instante, sin gastar API):
  - "qué sabes de mí" / "qué recuerdas de mí" -> lista los hechos.
  - "qué tengo pendiente" -> lista los recordatorios.
  - "qué notas tengo" -> lista las notas.
  - "cómo va el temporizador" -> estado y tiempo restante.
- **Contexto del día para el modelo**: al hablar con la IA, ahora también se le envía la
  fecha/hora actual, los recordatorios pendientes, los hechos aprendidos, el temporizador
  activo y las notas recientes. Así responde "¿qué tengo pendiente hoy?" sin inventarse nada.
- Avisos: verificado con las funciones reales (parser y contexto). La llamada a Gemini en
  sí no se puede probar sin una API key real. Ojo técnico repetido: en JavaScript `\b` no
  reconoce vocales acentuadas (í, á…), por eso las comparaciones de frases con acentos no
  usan `\b` en los extremos (si no, "qué sabes de mí" no coincidía).

### Qué incluye la Fase 3 (notas rápidas)
- Panel 📝 en el encabezado: escribir una nota de texto libre y verlas listadas (más
  recientes primero), borrar cada una con ✕.
- El botón muestra el número de notas guardadas (ej. "📝 3").
- Se guardan en el mismo `memoria.json`, bajo la clave `notas`.

### Qué incluye la Fase 3 (recordatorios por lenguaje natural)
- Escribir en el chat cosas como:
  - "recuérdame llamar a mamá en 10 minutos"
  - "recuérdame comprar pan en 2 horas"
  - "recuérdame la reunión mañana"
  - "recuérdame pagar el recibo a las 18:30"
  - "recuérdame tomar agua a las 3 de la tarde"
- AIRA lo interpreta sola (sin gastar API de IA), crea el recordatorio y confirma en el chat.
- Es un intérprete de reglas: si no entiende bien la fecha, devuelve null y el mensaje
  sigue el chat normal. Prefiere NO crear un recordatorio a crearlo mal.
- Ojo técnico documentado: en JavaScript, `\b` no reconoce vocales acentuadas (á, é…)
  como carácter de palabra; por eso el recorte del asunto no usa `\b` en los extremos
  (si no, "mamá en 10 minutos" dejaba la fecha pegada al asunto).

### Qué incluye la Fase 3 (recordatorios)
- Panel 📅 en el encabezado: agregar recordatorio (texto + fecha/hora), listar los
  pendientes ordenados por fecha, y borrar cada uno con ✕.
- El botón 📅 muestra el número de pendientes (ej. "📅 3") para verlo sin abrir el panel.
- Persisten en el mismo `memoria.json` que el chat, bajo la clave `recordatorios`.
- Al llegar la hora: notificación nativa del sistema + mensaje en el chat.
- Al reabrir AIRAOS, los recordatorios pendientes se reprograman solos (los vencidos
  avisan de inmediato, sin esperas negativas).
- Robustez: fechas inválidas se ignoran (no rompen la interfaz ni disparan en bucle);
  borrar un recordatorio cancela su temporizador; si las notificaciones están
  bloqueadas o no existen, AIRA avisa en el chat en vez de fallar en silencio.

## Nota de entorno (importante para correr la app en esta máquina)
`npm start` falla con `ipcMain is undefined` si la sesión tiene `ELECTRON_RUN_AS_NODE=1`
(la fuerza el toolkit del editor). Usar el script que ya existe:
```
npm run start:limpio
```
Si además el proceso GPU crashea (`GPU process launch failed: error_code=1002`,
`MESA-INTEL: Bay Trail Vulkan support is incomplete`), añadir `--in-process-gpu --disable-gpu`:
```
env -u ELECTRON_RUN_AS_NODE -u ELECTRON_NO_ATTACH_CONSOLE ./node_modules/electron/dist/electron . --no-sandbox --disable-gpu --disable-gpu-compositing --in-process-gpu --enable-logging
```
En esta máquina el arranque gráfico es **intermitente** (a veces sale
`Renderer process launch-failed`, por los drivers MESA Bay Trail). No es fallo del código.
Por eso la verificación de código se hace con un **DOM simulado en Node** que ejecuta
`src/renderer.js` completo y prueba sus funciones reales (parsers, reloj, instrucción de
sistema, contexto de Gemini). Eso es reproducible y no depende de la GPU.
Nota: `--disable-gpu` a secas NO basta aquí; sin `--in-process-gpu` el proceso GPU
sigue crasheando y la app aborta antes de dibujar la ventana.

## Fase — Avatar libre por toda la pantalla (mascota de escritorio)
Implementado (Fase 1 de esta fase):
- **Nueva ventana `avatarWindow`** en `main.js`: frameless, transparente, alwaysOnTop,
  skipTaskbar, del tamaño del `workArea`, con `focusable: false` (no roba el foco) y
  `setIgnoreMouseEvents(true, { forward: true })` por defecto.
- **Click-through dinámico**: `src/avatar-renderer.js` compara el cursor con el rect del
  avatar (mousemove) y avisa por IPC (`avatar:mouse-over`); main.js activa/desactiva
  `setIgnoreMouseEvents`. Solo se puede interactuar cuando el cursor está sobre el avatar.
- **Máquina de estados** en `src/avatar-renderer.js`: reposo → caminando → reposo →
  a veces corriendo (~1 de 4) → a veces saltando → reposo. Todos los tiempos de espera
  son aleatorios (nunca fijos). Respeta los bordes de la pantalla.
- **Simulación honesta de movimiento**: flipbook de 2 cuadros (flotando/dinamica cada
  ~280 ms andando, ~160 ms corriendo), flip con `scaleX(-1)` según dirección, interpolación
  exponencial suave de posición. El salto es un arco parabólico (sin) + squash & stretch
  (variables CSS `--salto-y` / `--salto-escala`). Con solo 6 fotos por outfit el paso se
  ve "a saltitos": la mejora real es pedir más fotos intermedias de transición.
- **Ocupada**: si AIRA está hablando/escuchando, el avatar se queda en reposo. Se consulta
  con sondeo IPC (`avatar:ocupada`, que lee `window.__airaOcupada()` de la ventana
  principal vía executeJavaScript) + la señal inmediata `voz:estado` que main.js ya
  retransmite a la nueva ventana.
- **Interacción**: clic (poco movimiento del mouse) → pose de saludo + abre/enfoca la
  ventana principal; arrastrar (mousedown + mousemove) → recoloca la ventana con
  `avatar:arrastre-inicio/mover/fin` y `setPosition` en main.js.
- **Outfit activo**: lee `airaos_modelo_avatar` del localStorage compartido (evento
  `storage` + sondeo cada 5 s de respaldo). Reutiliza la misma cadena de respaldo de
  poses de `renderer.js`.
- Archivos nuevos: `src/avatar.html`, `src/avatar-renderer.js`. Cambios quirúrgicos en
  `main.js`, `preload.js` y una línea en `src/renderer.js` (`window.__airaOcupada`).

## Fase 4 — Multimedia (música + generación de imágenes) — implementada

### Reproductor de música local
- Panel 🎵: lista audios de `~/Música` (mp3, ogg, wav, flac, m4a, opus, webm),
  play/pausa, anterior/siguiente, progreso, volumen, lista en bucle.
- Por chat: "pon música" (aleatoria), "para la música". Sin gastar API.
- IPC nuevos en `main.js`: `musica:listar`, `musica:ruta-archivo`.
- El avatar libre baila mientras suena música (estado 'bailando' por el canal
  `voz:estado` → `avatar-renderer.js` reutiliza CORRIENDO como baile).

### Generador de imágenes (ver cómo funcionan los modelos)
- Botón 🖼️ "Estudio de imagen" en el encabezado + por chat: "dibuja un gato astronauta".
- Motor ONLINE (Pollinations.ai, sin API key): el prompt genera una imagen que se
  muestra en el chat como data:URL. AVISO HONESTO: el prompt sale a internet;
  NO es generación local.
- Motor LOCAL (Automatic1111 puerto 7860): IMPLEMENTADO con detección automática
  (ping a /sdapi/v1/sd-models con timeout de 1.5 s → txt2img). Si el servidor no está,
  cae al online sin error. Requiere instalar SD Web UI por tu cuenta (necesita GPU o
  mucha RAM — en esta máquina Bay Trail no va a correr).
- Botón "💾 Guardar" en cada imagen generada (usa el IPC imagen:guardar que ya existía;
  guarda PNG en userData/imagenes).

### Descargador (Fase 4)
- Por chat: "descargar <url>" (audio mp3 → ~/Música) y "descargar video <url>"
  (vídeo → ~/Descargas). Requiere yt-dlp instalado; si falta, AIRA da el comando
  exacto de instalación. IPC `descargar:media` en main.js (execFile con timeout 10 min).
- AVISO: usar solo con contenido que tengas derecho a descargar.

### Panel del avatar dentro de la app
- Ahora se OCULTA cuando el avatar libre está activo (configurable en ⚙ →
  "Avatar libre": Activado/Desactivado; guardado en `airaos_avatar_libre`, por
  defecto activado). Así no se ve dos veces.

### Verificación real (esta máquina)
- `node --check` OK en los 4 archivos JS.
- Arranque real 40 s sin errores de JavaScript con:
  `env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron --no-sandbox .`
  (código 124 = timeout del test, no crash). Las flags `--disable-gpu` dieron
  "bad option" en este binario: se omitieron. Es del entorno, no del código.
- Generación online verificada fuera de la app: Pollinations respondió 200 con un
  JPEG real para un prompt de prueba (curl). La llamada dentro de la app usa el
  mismo endpoint.
- El avatar vuelve a reposo de inmediato cuando la música se pausa (flag `bailando`
  en avatar-renderer.js), no espera al timeout del estado.
- Pendiente menor: letras de canciones y reproductor de vídeo (`<video>`).

- Pendiente / siguiente paso: decidir si el avatar del panel dentro de la ventana principal
  se oculta cuando está activa esta ventana (ahora mismo aparecen los dos). Y en Wayland
  el `forward: true` de setIgnoreMouseEvents puede no entregar mousemove según el
  compositor — verificado solo en esta máquina (X11).
  Otro pendiente Fase 4: descargador de video/audio (yt-dlp), vídeo real (`<video>`) y
  letras de canciones.
Cuando entremos en la fase de los avatares (después de la Fase 3, y sin adelantar la
Fase 5 VRM 3D según la regla 4), el objetivo es un avatar que **se mueva de forma
animada y fluida por la pantalla, alternando entre los modelos 2D y 3D**. La referencia
de estilo es el avatar del proyecto **Jenny**: se desplaza animado por la pantalla en
vez de quedarse fijo en su panel. Relacionado con lo que ya hay:
- Ya existen 7 poses 2D por modelo en `src/assets/avatar/default/` y los modelos 2D
  completos en `models/Chibi/` (pijama, default, primavera, elegante, cyber, gótico).
- Ya existe `models/outfits/*.vrm` y `models/aira_default.vrm` (3D) — sin integrar.
- La transición 2D ↔ 3D y el movimiento por pantalla serán el corazón de esa fase.
- El movimiento por pantalla YA está resuelto (ver "Fase — Avatar libre" más arriba);
  falta la transición 2D ↔ 3D.

## Fase 4 — Multimedia (reproductor de música local) — implementada
- **Panel 🎵** en la ventana principal: lista los archivos de audio (mp3, ogg,
  wav, flac, m4a, opus, webm) de la carpeta de Música del usuario
  (`~/Música` en Linux). No trae canciones propias: integra lo que ya tengas.
- Reproductor con play/pausa, anterior/siguiente, barra de progreso,
  volumen, tiempo transcurrido/total, y lista en bucle (al acabar una pista
  pasa a la siguiente).
- Por chat: "pon música" (elige una al azar y suena), "para la música".
  Resuelto sin gastar API, igual que recordatorios/temporizadores.
- **El avatar libre baila mientras suena música**: el reproductor emite el
  estado 'bailando' por el canal `voz:estado` ya existente, y
  `avatar-renderer.js` lo usa para moverse rápido (flipbook acelerado).
  No es coreografía real — un flipbook acelerado, honestamente.
- Cambios: `main.js` (IPC `musica:listar`, `musica:ruta-archivo`), `preload.js`,
  `index.html` (botón 🎵 + panel), `styles.css`, `renderer.js` (sección 14),
  `avatar-renderer.js` (estado 'bailando').
- PENDIENTE (siguiente paso de Fase 4): descargador de video/audio (estilo
  Snaptube) — requiere herramientas externas (yt-dlp) y toca red y legalidad;
  decidir antes de implementar. También: vídeo real (reproductor con
  `<video>`) y letras de canciones.

## Reglas para cualquier IA que edite este proyecto
1. No reescribas archivos completos si solo hay que cambiar una función — edita quirúrgicamente.
2. Cualquier función nueva debe tener manejo de errores (try/catch), no asumir que todo va a funcionar.
3. Si algo depende de un servicio externo (voz, APIs), avisar explícitamente si podría no funcionar en Linux/Electron, no fallar en silencio.
4. Seguir el roadmap de fases — no adelantar Fase 5 (avatar 3D VRM) ni Fase 6 (antivirus/seguridad) todavía.
