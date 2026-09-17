#!/usr/bin/env node

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Document, Packer, Paragraph } = require('docx');
const { PDFDocument } = require('pdf-lib');
const XLSX = require('xlsx');
const PptxGenJS = require('pptxgenjs');

async function ejecutar() {
  const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), 'airaos-exportadores-'));
  const texto = 'Documento de prueba AIRAOS\n\nContenido generado offline.';
  const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph(texto)] }] }));
  await fs.writeFile(path.join(carpeta, 'prueba.docx'), docx);

  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('AIRAOS');
  await fs.writeFile(path.join(carpeta, 'prueba.pdf'), await pdf.save());

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['AIRAOS'], ['prueba']]), 'AIRAOS');
  await fs.writeFile(path.join(carpeta, 'prueba.xlsx'), XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }));

  const presentacion = new PptxGenJS();
  presentacion.addSlide().addText('AIRAOS');
  await presentacion.writeFile({ fileName: path.join(carpeta, 'prueba.pptx') });

  const firmas = {
    docx: 'PK',
    pdf: '%PDF',
    xlsx: 'PK',
    pptx: 'PK',
  };
  for (const [extension, firma] of Object.entries(firmas)) {
    const buffer = await fs.readFile(path.join(carpeta, `prueba.${extension}`));
    if (buffer.subarray(0, firma.length).toString() !== firma) {
      throw new Error(`Firma inválida para ${extension}`);
    }
  }
  await fs.rm(carpeta, { recursive: true, force: true });
  console.log('Exportadores DOCX/PDF/XLSX/PPTX: OK');
}

ejecutar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
