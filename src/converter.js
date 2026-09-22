const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

const pythonCommand = () => process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'py' : 'python3');

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

async function convertPdfToWord(inputPath, outputPath) {
  await run(
    pythonCommand(),
    ['-c', 'from pdf2docx import Converter; import sys; converter = Converter(sys.argv[1]); converter.convert(sys.argv[2]); converter.close()', inputPath, outputPath],
    'Python com o conversor pdf2docx não foi encontrado no servidor.'
  );
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
