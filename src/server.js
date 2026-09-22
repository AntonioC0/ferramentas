const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { compressPdf, profiles } = require('./compressor');
const { convertPdfToWord, convertWordToPdf } = require('./converter');

const app = express();
const port = Number(process.env.PORT) || 3000;
const maxFileSize = (Number(process.env.MAX_FILE_SIZE_MB) || 100) * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFileSize, files: 1 } });

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function safeDownloadName(originalName) {
  const base = path.basename(originalName, path.extname(originalName))
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'arquivo';
  return `${base}-comprimido.pdf`;
}

function safeConvertedName(originalName, suffix, extension) {
  const base = path.basename(originalName, path.extname(originalName))
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'arquivo';
  return `${base}-${suffix}${extension}`;
}

function isPdf(file) {
  return file.buffer.subarray(0, 5).toString() === '%PDF-';
}

function isDocx(file) {
  return path.extname(file.originalname).toLowerCase() === '.docx'
    && file.buffer.subarray(0, 2).toString() === 'PK';
}

app.get('/api/health', (_request, response) => response.json({ ok: true }));

app.post('/api/compress', upload.single('pdf'), async (request, response, next) => {
  let workDir;
  try {
    if (!request.file) return response.status(400).json({ error: 'Selecione um arquivo PDF.' });
    if (!Object.hasOwn(profiles, request.body.level)) return response.status(400).json({ error: 'Nível de compressão inválido.' });
    if (request.file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      return response.status(415).json({ error: 'O arquivo enviado não é um PDF válido.' });
    }

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comprime-pdf-'));
    const token = crypto.randomUUID();
    const inputPath = path.join(workDir, `${token}-entrada.pdf`);
    const outputPath = path.join(workDir, `${token}-saida.pdf`);
    await fs.writeFile(inputPath, request.file.buffer, { mode: 0o600 });
    await compressPdf(inputPath, outputPath, request.body.level);

    const output = await fs.readFile(outputPath);
    if (output.subarray(0, 5).toString() !== '%PDF-') throw new Error('O compressor não gerou um PDF válido.');

    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeDownloadName(request.file.originalname)}"`,
      'Content-Length': output.length,
      'X-Original-Size': request.file.size,
      'X-Compressed-Size': output.length,
      'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': 'Content-Disposition, X-Original-Size, X-Compressed-Size'
    });
    response.send(output);
  } catch (error) {
    next(error);
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

app.post('/api/convert', upload.single('file'), async (request, response, next) => {
  let workDir;
  try {
    if (!request.file) return response.status(400).json({ error: 'Selecione um arquivo para converter.' });
    const direction = request.body.direction;
    if (!['pdf-to-word', 'word-to-pdf'].includes(direction)) {
      return response.status(400).json({ error: 'Tipo de conversão inválido.' });
    }
    if (direction === 'pdf-to-word' && !isPdf(request.file)) {
      return response.status(415).json({ error: 'Selecione um arquivo PDF válido.' });
    }
    if (direction === 'word-to-pdf' && !isDocx(request.file)) {
      return response.status(415).json({ error: 'Selecione um arquivo Word (.docx) válido.' });
    }

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'converte-arquivo-'));
    const token = crypto.randomUUID();
    const inputExtension = direction === 'pdf-to-word' ? '.pdf' : '.docx';
    const outputExtension = direction === 'pdf-to-word' ? '.docx' : '.pdf';
    const inputPath = path.join(workDir, `${token}-entrada${inputExtension}`);
    const outputPath = path.join(workDir, `${token}-saida${outputExtension}`);
    await fs.writeFile(inputPath, request.file.buffer, { mode: 0o600 });

    if (direction === 'pdf-to-word') await convertPdfToWord(inputPath, outputPath);
    else await convertWordToPdf(inputPath, outputPath);

    const output = await fs.readFile(outputPath);
    const expectedHeader = direction === 'pdf-to-word' ? 'PK' : '%PDF-';
    if (output.subarray(0, expectedHeader.length).toString() !== expectedHeader) {
      throw new Error('A conversão não gerou um arquivo válido.');
    }
    const isWord = direction === 'pdf-to-word';
    response.set({
      'Content-Type': isWord
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeConvertedName(request.file.originalname, 'convertido', outputExtension)}"`,
      'Content-Length': output.length,
      'Cache-Control': 'no-store'
    });
    response.send(output);
  } catch (error) {
    error.publicMessage = error.message === 'Ghostscript não encontrado no servidor.'
      ? error.message
      : 'Não foi possível converter o arquivo. Verifique se ele não está corrompido ou protegido.';
    next(error);
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: `O PDF ultrapassa o limite de ${Math.round(maxFileSize / 1024 / 1024)} MB.` });
  }
  console.error(error);
  const publicMessage = error.publicMessage || (error.message === 'Ghostscript não encontrado no servidor.'
    ? error.message
    : 'Não foi possível comprimir o PDF. Verifique se o arquivo não está corrompido ou protegido.');
  response.status(500).json({ error: publicMessage });
});

app.listen(port, () => console.log(`ComprimePDF disponível em http://localhost:${port}`));
