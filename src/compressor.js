const { spawn } = require('node:child_process');

const profiles = {
  screen: { pdfSettings: '/screen', dpi: 72 },
  ebook: { pdfSettings: '/ebook', dpi: 120 },
  printer: { pdfSettings: '/printer', dpi: 200 }
};

function buildGhostscriptArgs(inputPath, outputPath, level = 'ebook') {
  const profile = profiles[level] || profiles.ebook;

  return [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${profile.pdfSettings}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-dSAFER',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dDownsampleColorImages=true',
    '-dDownsampleGrayImages=true',
    '-dDownsampleMonoImages=true',
    `-dColorImageResolution=${profile.dpi}`,
    `-dGrayImageResolution=${profile.dpi}`,
    `-dMonoImageResolution=${Math.max(profile.dpi, 150)}`,
    `-sOutputFile=${outputPath}`,
    inputPath
  ];
}

function compressPdf(inputPath, outputPath, level) {
  return new Promise((resolve, reject) => {
    const command = process.env.GS_COMMAND || (process.platform === 'win32' ? 'gswin64c' : 'gs');
    const processHandle = spawn(command, buildGhostscriptArgs(inputPath, outputPath, level), {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let errorOutput = '';
    processHandle.stderr.on('data', chunk => { errorOutput += chunk.toString(); });
    processHandle.on('error', error => {
      if (error.code === 'ENOENT') {
        reject(new Error('Ghostscript não encontrado no servidor.'));
      } else {
        reject(error);
      }
    });
    processHandle.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(errorOutput.trim() || `Ghostscript encerrou com o código ${code}.`));
    });
  });
}

module.exports = { buildGhostscriptArgs, compressPdf, profiles };
