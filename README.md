# AIRAOS

AIRAOS es un asistente personal de escritorio en Electron, con memoria local,
avatar 2D/3D, voz, burbuja flotante y herramientas del sistema. El desarrollo
se organiza por fases pequeñas: cada fase debe arrancar y poder diagnosticarse
antes de añadir la siguiente.

## Cómo correrlo en tu PC (Linux Mint)

1. Instala Node.js si no lo tienes:
   ```
   sudo apt update
   sudo apt install nodejs npm
   ```
   En instalaciones mínimas de Debian/Ubuntu, Electron también puede necesitar
   sus librerías gráficas:
   ```
   sudo apt install libatk1.0-0t64 libnss3 libgtk-3-0t64 libgbm1 libasound2t64 xvfb
   ```
   Verifica que quedó instalado:
   ```
   node -v
   npm -v
   ```

2. Entra a la carpeta del proyecto y descarga la dependencia de Electron:
   ```
   cd AIRAOS
   npm install
   ```
   (esto puede tardar un par de minutos la primera vez, descarga Electron)

3. Ejecuta la app:
   ```
   npm start
   ```

   En un contenedor o servidor sin pantalla puedes probar Electron con:
   ```bash
   npm run start:virtual
   ```

4. Comprueba el entorno cuando algo no arranque:
   ```
   npm run doctor
   ```

Debería abrirse una ventana morado oscuro con el logo de AIRAOS
ensamblándose y el texto "Iniciando núcleo…" que cambia después de
un par de segundos.

## Cerebro local

El archivo `.gguf` incluido es el peso del modelo, no un motor de inferencia.
AIRAOS se conecta de forma local a un runtime compatible, sin enviar la
conversación a Internet:

### Ollama

Instala Ollama desde [ollama.com](https://ollama.com), inicia el servicio y
descarga un modelo pequeño:

```bash
ollama pull qwen2.5:1.5b
ollama serve
```

En AIRAOS abre Configuración, selecciona **Ollama local**, deja la URL
`http://127.0.0.1:11434` y escribe el nombre exacto del modelo instalado.

### LM Studio

Carga un modelo compatible en LM Studio, inicia su servidor local OpenAI y usa
`http://127.0.0.1:1234` en AIRAOS. El campo **Modelo local** debe coincidir con
el identificador que expone LM Studio.

El adaptador solo acepta `127.0.0.1` deliberadamente: evita convertir el
servidor local en un servicio de red abierto. Si no hay runtime, AIRAOS sigue
funcionando con respuestas de prueba o Gemini.

### Instalación bajo demanda

AIRAOS no incluye runtimes ni pesos grandes en cada instalación. La secuencia
recomendada es:

1. Instalar AIRAOS y ejecutar `npm run doctor`.
2. Instalar Ollama o LM Studio solo si se desea IA local.
3. Descargar un modelo pequeño con conexión, por ejemplo `ollama pull qwen2.5:1.5b`.
4. Arrancar el runtime y seleccionar el modelo desde Configuración.

La conversación, memoria, avatar 2D, música local y controles básicos siguen
disponibles sin conexión. El panel de Configuración muestra si el servidor está
apagado, si el modelo no está instalado o si ya está listo.

## Paquetes descargables

Genera los paquetes con:

```bash
npm run package:zip
```

- `dist/AIRAOS-0.10.0-source.zip`: código, assets y dependencias declaradas, sin `node_modules` ni el GGUF pesado.
- `dist/AIRAOS-0.10.0-completo.zip`: incluye también el modelo GGUF local.

El APK se construye como debug en este entorno con el SDK local. El proyecto Android de referencia no se usa
como APK de AIRAOS para evitar mezclar código o identidad de otro proyecto.

Con el SDK instalado, el build reproducible es:

```bash
export JAVA_HOME=/usr/local/sdkman/candidates/java/21.0.12+1-ms
export ANDROID_SDK_ROOT=/workspaces/AIRAOS/android-sdk
export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/build-tools/36.0.0:$JAVA_HOME/bin:$PATH
npm run android:build
```

El APK debug se genera en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Avatar 2D y 3D

La ventana flotante admite estos comandos en el chat o por voz:

```text
activate 2d
activate 3d
desactivate 2d
desactivate avatar
ponme el outfit pijama
cambia a cyber
```

El avatar 2D usa los cuatro frames disponibles de cada outfit, sincronizados
con el movimiento suave y la dirección de marcha. El avatar 3D carga
`models/aira_default.vrm` con Three.js y `three-vrm`; si el modelo no puede
cargarse, vuelve automáticamente a 2D. La caminata procedural actual es una
base segura: para animación esquelética completa el VRM debe incluir clips de
animación o habrá que añadirlos al asset.

El clima todavía no selecciona outfits automáticamente porque AIRAOS aún no
tiene un proveedor de ubicación/clima configurado. El cambio manual por voz y
el selector visual sí quedan disponibles.

## Capacidades y límites actuales

- Música: reproduce archivos locales y controla reproductores del sistema mediante `playerctl`/`pactl` cuando están instalados.
- Multimedia: `yt-dlp` es opcional y solo se usa cuando el usuario lo instala.
- Imágenes: puede usar un generador local compatible o un proveedor online configurado.
- Documentos: puedes decir `crea un documento sobre ...`, y AIRA lo redacta y guarda localmente en Markdown, HTML, TXT, DOCX, PDF, XLSX o PPTX. La prueba reproducible es `npm run test:exportadores`.
- Reparación: AIRAOS ya tiene fallback de proveedor, fallback 3D a 2D y `npm run doctor`; no modifica archivos del sistema ni se actualiza por sí solo sin consentimiento.
- Seguridad: `audita seguridad`, `antivirus` o `revisa puertos` ejecuta una auditoría defensiva de solo lectura; no es un antivirus completo ni bloquea ataques automáticamente.
- Sensores: `activa sensores` solicita permiso y lee movimiento/orientación cuando el dispositivo y el navegador los exponen. En PC normalmente no habrá sensores móviles.
- Bloqueo del teléfono: AIRAOS no puede saltarse PIN, rostro o huella. Una futura app Android podrá solicitar una acción al sistema con sus permisos oficiales y confirmación del usuario.

## Roadmap actual

1. Fundación Electron, memoria, cerebro local, avatar 2D/3D, voz, música, imágenes y exportadores documentales: implementada y validada.
2. Sensores web y auditoría defensiva: implementados con consentimiento y solo lectura.
3. Gestos de cámara: pendiente de integrar MediaPipe/visión local como dependencia opcional.
4. Android/APK: pendiente de crear el módulo nativo Capacitor/Kotlin y declarar permisos oficiales.
5. Antivirus completo y protección antiintrusión: se mantiene como integración con herramientas del sistema, no como promesa de antivirus propio.

## Estructura útil para colaborar

- `main.js` → controla la ventana del sistema operativo (se abre, se cierra).
- `preload.js` → el puente seguro entre Electron y la interfaz.
- `src/index.html` → lo que ves en pantalla.
- `src/styles.css` → colores y animación del logo.
- `src/renderer.js` → interfaz, memoria y herramientas de conversación.
- `scripts/doctor.js` → comprobación rápida de requisitos y assets.
- `models/` y `src/assets/` → modelos y recursos visuales, separados del código.

## Próximos pasos

1. Probar el cerebro local con Ollama o LM Studio.
2. Extraer la memoria y los proveedores a módulos compartidos para Electron y Capacitor.
3. Añadir pruebas del contrato de proveedores antes de integrar Android.
4. Integrar `three-vrm` después de estabilizar la experiencia 2D y el contrato de avatar.

La referencia `jenny-android-ai-agent-main` se conserva como material de
arquitectura. No se copia código automáticamente; su licencia AGPL-3.0 debe
revisarse antes de reutilizar cualquier implementación.
