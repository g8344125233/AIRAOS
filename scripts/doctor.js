#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const checks = [];

function check(nombre, correcto, detalle) {
  checks.push({ nombre, correcto, detalle });
}

function comandoDisponible(comando) {
  try {
    execFileSync('sh', ['-c', `command -v ${comando}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

check('Node.js', Number(process.versions.node.split('.')[0]) >= 20, process.version);
check('Electron instalado', fs.existsSync(path.join(root, 'node_modules', 'electron')), 'npm install');
check('Avatar 3D', fs.existsSync(path.join(root, 'models', 'aira_default.vrm')), 'models/aira_default.vrm');
check(
  'Modelo GGUF presente',
  fs.readdirSync(root).some((nombre) => nombre.toLowerCase().endsWith('.gguf')),
  'Añade un modelo .gguf en la raíz de AIRAOS'
);
check('Ollama disponible (opcional)', comandoDisponible('ollama'), 'Instala Ollama para el cerebro local');
check('LM Studio disponible (opcional)', comandoDisponible('lms'), 'Instala LM Studio para el cerebro local');
check('Display virtual (opcional)', comandoDisponible('xvfb-run'), 'Instala xvfb para probar Electron sin pantalla');

console.log('AIRAOS doctor\n');
for (const resultado of checks) {
  console.log(`${resultado.correcto ? 'OK' : '!!'} ${resultado.nombre}: ${resultado.detalle}`);
}

const obligatorios = checks.slice(0, 4);
if (obligatorios.some((resultado) => !resultado.correcto)) process.exitCode = 1;
