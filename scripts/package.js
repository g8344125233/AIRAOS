#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

for (const nombre of ['AIRAOS-1.0.0-source.zip', 'AIRAOS-1.0.0-completo.zip']) {
  const destino = path.join(dist, nombre);
  try { fs.rmSync(destino); } catch {}
}

const excluirBase = [
  './node_modules/*',
  './.git/*',
  './.shots_tmp/*',
  './dist/*',
  './android/.gradle/*',
  './android/build/*',
  './android/app/build/*',
  './android/capacitor-cordova-android-plugins/build/*',
];
const excluirLigero = [...excluirBase, '*.gguf'];

function crear(nombre, exclusiones) {
  execFileSync('zip', ['-qr', path.join(dist, nombre), '.', ...exclusiones.flatMap((patron) => ['-x', patron])], {
    cwd: root,
    stdio: 'inherit',
  });
}

crear('AIRAOS-1.0.0-source.zip', excluirLigero);
crear('AIRAOS-1.0.0-completo.zip', excluirBase);
console.log('Paquetes creados en dist/');
