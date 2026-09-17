#!/bin/bash
# setup_assets.sh
# Copia y renombra las imágenes del chibi "Default 2D" y los archivos VRM
# desde tu carpeta AIRAOS/models hacia el proyecto airaos-skeleton,
# con los nombres exactos que el código espera.
#
# Uso:
#   cd ~/Documentos/airaos-skeleton
#   bash setup_assets.sh

ORIGEN="$HOME/Documentos/AIRAOS/models"
DESTINO_AVATAR="./src/assets/avatar/default"
DESTINO_MODELOS="./src/assets/models"

echo "Copiando poses del chibi Default 2D..."

mkdir -p "$DESTINO_AVATAR"
mkdir -p "$DESTINO_MODELOS"

# NOTA: "Aira default.jpg" es la hoja de contacto con las 6 poses juntas,
# no una pose usable — por eso NO se copia como base.jpg. El código ya no
# espera un archivo base.jpg; usa flotando.jpg como reposo/idle.
cp "$ORIGEN/Chibi/2. Modelo Default 2D/Aira default dinamica.jpg"   "$DESTINO_AVATAR/dinamica.jpg"
cp "$ORIGEN/Chibi/2. Modelo Default 2D/Aira default flotando.jpg"  "$DESTINO_AVATAR/flotando.jpg"
cp "$ORIGEN/Chibi/2. Modelo Default 2D/Aira default odjetando.jpg"  "$DESTINO_AVATAR/odjetando.jpg"
cp "$ORIGEN/Chibi/2. Modelo Default 2D/Aira default pensando.jpg"   "$DESTINO_AVATAR/pensando.jpg"
cp "$ORIGEN/Chibi/2. Modelo Default 2D/Aira default saludo.jpg"     "$DESTINO_AVATAR/saludo.jpg"
cp "$ORIGEN/Chibi/2. Modelo Default 2D/Aira default suspension.jpg" "$DESTINO_AVATAR/suspension.jpg"

# --- Fase 4: los demás modelos 2D, cada uno en su propia carpeta -----------
# Normalizamos los nombres de pose para que la app pueda usarlos igual que
# el modelo Default (que ya está en ../avatar/default/).
copy_pose() {  # $1 = carpeta origen, $2 = nombre de pose destino, $3.. = candidatos
  local carpeta="$1"; shift
  local nombre="$1"; shift
  for candidato in "$@"; do
    if [ -f "$ORIGEN/Chibi/$carpeta/$candidato" ]; then
      cp "$ORIGEN/Chibi/$carpeta/$candidato" "$DESTINO_AVATAR/../$CARPETA_DESTINO/$nombre.jpg"
      return 0
    fi
  done
  return 0  # si no existe esa pose en este modelo, simplemente se omite
}

copiar_modelo() {  # $1 = carpeta origen, $2 = nombre destino
  CARPETA_DESTINO="$2"
  mkdir -p "$DESTINO_AVATAR/../$CARPETA_DESTINO"
  # "base" no se copia: en estas carpetas también es la hoja de contacto
  # con todas las poses juntas, no una pose usable (ver nota arriba).
  copy_pose "$1" saludo      "Aira pijama saludo.jpg" "Aira primavera saludo.jpg" "Aira vestido amarillo saludo.jpg" "Aira vestido amarillo saludando.jpg" "Aira modelo cyber saludando.jpg" "Aira gotica saludando.jpg"
  copy_pose "$1" pensando    "Aira pijama pensando.jpg" "Aira primavera pensando.jpg" "Aira vestido amarillo pensando.jpg" "Aira cyber pensando.jpg" "Aira gotica pensando.jpg"
  copy_pose "$1" flotando    "Aira pijama flotando.jpeg" "Aira primavera flotando.jpg" "Aira vestido amarillo flotando.jpg" "Aira modelo cyber flotando.jpg" "Aira gotica flotando.jpg"
  copy_pose "$1" suspension  "Aira pijama suspendida.jpg" "Aira primavera suspension.jpg" "Aira vestido amarillo suspension.jpg" "Aira cyber suspension.jpg" "Aira gotica suspension.jpg"
  copy_pose "$1" odjetando   "Aira pijama odjetando.jpg" "Aira primavera odjetando.jpg" "Aira cyber odjetando.jpg" "Aira gotica odjetando.jpg"
}

echo "Copiando los demás modelos 2D (Fase 4)..."
copiar_modelo "1. Modelo Pijama 2D"                   "pijama"
copiar_modelo "3. Modelo Primavera 2D"                "primavera"
copiar_modelo "4. Modelo Elegante (Amarillo y Negro) 2D" "elegante"
copiar_modelo "5. Modelo Cyber Tecnológica 2D"        "cyber"
copiar_modelo "6. Modelo Gótico 2D"                   "gotico"

echo "Copiando modelo VRM (para usarlo más adelante, en la Fase 5)..."
cp "$ORIGEN/aira_default.vrm" "$DESTINO_MODELOS/aira_default.vrm"

echo ""
echo "Listo. Archivos copiados a:"
echo "  $DESTINO_AVATAR/"
echo "  $DESTINO_MODELOS/"
echo ""
echo "Ahora corre: npm start"
