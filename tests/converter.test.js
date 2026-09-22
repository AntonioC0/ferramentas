const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Document, Packer, Paragraph } = require('docx');
const PDFDocument = require('pdfkit');
const { convertPdfToWord, convertWordToPdf } = require('../src/converter');

function createPdf(outputPath, text) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const document = new PDFDocument();
    output.on('finish', resolve);
    output.on('error', reject);
    document.pipe(output);
    document.text(text);
    document.end();
  });
}

test('converte Word para PDF', async () => {
  const workDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'conversor-teste-'));
  try {
    const input = path.join(workDir, 'entrada.docx');
    const output = path.join(workDir, 'saida.pdf');
    const document = new Document({ sections: [{ children: [new Paragraph({ text: 'Conteúdo de teste.' })] }] });
    await fsPromises.writeFile(input, await Packer.toBuffer(document));
    await convertWordToPdf(input, output);
    assert.equal((await fsPromises.readFile(output)).subarray(0, 5).toString(), '%PDF-');
  } finally {
    await fsPromises.rm(workDir, { recursive: true, force: true });
  }
});

test('converte PDF para Word', async () => {
  const workDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'conversor-teste-'));
  try {
    const input = path.join(workDir, 'entrada.pdf');
    const output = path.join(workDir, 'saida.docx');
    await createPdf(input, 'Conteúdo de teste.');
    await convertPdfToWord(input, output);
    assert.equal((await fsPromises.readFile(output)).subarray(0, 2).toString(), 'PK');
  } finally {
    await fsPromises.rm(workDir, { recursive: true, force: true });
  }
});
