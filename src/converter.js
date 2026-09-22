const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { Document, Packer, Paragraph, ImageRun } = require('docx');

const ghostscriptCommand = () => process.env.GS_COMMAND || (process.platform === 'win32' ? 'gswin64c' : 'gs');

function libreOfficeCommand() {
  if (process.env.LIBREOFFICE_COMMAND) return process.env.LIBREOFFICE_COMMAND;
  const windowsPath = 'C:\\Program Files\\LibreOffice\\program\\soffice.com';
  if (process.platform === 'win32' && fs.existsSync(windowsPath)) return windowsPath;
  return process.platform === 'win32' ? 'soffice.com' : 'soffice';
}

function run(command, args, notFoundMessage) {
  return new Promise((resolve, reject) => {
    const processHandle = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    processHandle.stderr.on('data', chunk => { errorOutput += chunk.toString(); });
    processHandle.on('error', error => reject(error.code === 'ENOENT' ? new Error(notFoundMessage) : error));
    processHandle.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(errorOutput.trim() || `${path.basename(command)} encerrou com o código ${code}.`));
    });
  });
}

function pngDimensions(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Não foi possível renderizar uma página do PDF.');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function convertPdfToWord(inputPath, outputPath) {
  const imagesDir = path.join(path.dirname(outputPath), 'paginas');
  await fsPromises.mkdir(imagesDir, { mode: 0o700 });
  await run(ghostscriptCommand(), [
    '-sDEVICE=png16m', '-r300', '-dNOPAUSE', '-dQUIET', '-dBATCH', '-dSAFER',
    `-sOutputFile=${path.join(imagesDir, 'pagina-%04d.png')}`, inputPath
  ], 'Ghostscript não encontrado no servidor.');

  const pages = (await fsPromises.readdir(imagesDir)).filter(file => file.endsWith('.png')).sort();
  if (!pages.length) throw new Error('O PDF não possui páginas que possam ser convertidas.');
  const sections = await Promise.all(pages.map(async page => {
    const image = await fsPromises.readFile(path.join(imagesDir, page));
    const { width, height } = pngDimensions(image);
    const widthTwips = Math.round((width / 300) * 1440);
    const heightTwips = Math.round((height / 300) * 1440);
    return {
      properties: { page: { size: { width: widthTwips, height: heightTwips }, margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
      children: [new Paragraph({ spacing: { before: 0, after: 0, line: 0 }, children: [new ImageRun({ data: image, type: 'png', transformation: { width: Math.round((width / 300) * 96), height: Math.round((height / 300) * 96) } })] })]
    };
  }));
  await fsPromises.writeFile(outputPath, await Packer.toBuffer(new Document({ sections })), { mode: 0o600 });
}

async function convertWordToPdf(inputPath, outputPath) {
  const workDir = path.dirname(outputPath);
  const profileDir = path.join(workDir, `libreoffice-${Date.now()}`);
  await fsPromises.mkdir(profileDir, { mode: 0o700 });
  try {
    await run(libreOfficeCommand(), [
      '--headless', '--nologo', '--nodefault', '--nolockcheck',
      `-env:UserInstallation=${new URL(`file:///${profileDir.replace(/\\/g, '/')}`).href}`,
      '--convert-to', 'pdf:writer_pdf_Export', '--outdir', workDir, inputPath
    ], 'LibreOffice não encontrado no servidor. Instale o LibreOffice para converter Word em PDF.');
    const generatedPath = path.join(workDir, `${path.basename(inputPath, path.extname(inputPath))}.pdf`);
    if (!fs.existsSync(generatedPath)) throw new Error('O LibreOffice não gerou o PDF.');
    await fsPromises.rename(generatedPath, outputPath);
  } finally {
    await fsPromises.rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { convertPdfToWord, convertWordToPdf };
