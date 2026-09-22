const portalView = document.querySelector('#portal-view');
const compressorView = document.querySelector('#compressor-view');
const converterView = document.querySelector('#converter-view');

const formatBytes = bytes => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 2 : 0)} ${units[index]}`;
};

function showPage() {
  const page = window.location.hash;
  const isCompressor = page === '#comprimir-pdf';
  const isConverter = page === '#converter-arquivos';
  portalView.hidden = isCompressor || isConverter;
  compressorView.hidden = !isCompressor;
  converterView.hidden = !isConverter;
  if (isCompressor || isConverter) window.scrollTo({ top: 0, behavior: 'auto' });
}

function downloadName(response, fallback) {
  return (response.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || fallback;
}

const form = document.querySelector('#compress-form');
const input = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const fileCard = document.querySelector('#file-card');
const fileName = document.querySelector('#file-name');
const fileSize = document.querySelector('#file-size');
const removeButton = document.querySelector('#remove-file');
const qualityOptions = document.querySelector('#quality-options');
const compressButton = document.querySelector('#compress-button');
const progress = document.querySelector('#progress');
const result = document.querySelector('#result');
const resultSummary = document.querySelector('#result-summary');
const downloadButton = document.querySelector('#download-button');
const newFileButton = document.querySelector('#new-file');
const errorMessage = document.querySelector('#error-message');
let selectedFile = null;
let downloadUrl = null;

function showCompressionError(message) { errorMessage.textContent = message; errorMessage.hidden = false; }
function hideCompressionError() { errorMessage.hidden = true; errorMessage.textContent = ''; }
function setFile(file) {
  hideCompressionError();
  if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) return showCompressionError('Selecione um arquivo no formato PDF.');
  if (file.size > 100 * 1024 * 1024) return showCompressionError('O PDF ultrapassa o limite de 100 MB.');
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  dropZone.hidden = true;
  fileCard.hidden = false;
  qualityOptions.hidden = false;
  compressButton.hidden = false;
}
function resetCompression() {
  selectedFile = null;
  input.value = '';
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = null;
  fileCard.hidden = true;
  qualityOptions.hidden = true;
  compressButton.hidden = true;
  progress.hidden = true;
  result.hidden = true;
  dropZone.hidden = false;
  hideCompressionError();
}
input.addEventListener('change', () => setFile(input.files[0]));
removeButton.addEventListener('click', resetCompression);
newFileButton.addEventListener('click', resetCompression);
['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', event => setFile(event.dataTransfer.files[0]));
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedFile) return showCompressionError('Selecione um arquivo PDF.');
  hideCompressionError();
  fileCard.hidden = true;
  qualityOptions.hidden = true;
  compressButton.hidden = true;
  progress.hidden = false;
  const body = new FormData();
  body.append('pdf', selectedFile);
  body.append('level', new FormData(form).get('level'));
  try {
    const response = await fetch('/api/compress', { method: 'POST', body });
    if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || 'Falha ao comprimir o PDF.'); }
    const blob = await response.blob();
    const original = Number(response.headers.get('X-Original-Size')) || selectedFile.size;
    const compressed = Number(response.headers.get('X-Compressed-Size')) || blob.size;
    const reduction = Math.max(0, Math.round((1 - compressed / original) * 100));
    downloadUrl = URL.createObjectURL(blob);
    downloadButton.href = downloadUrl;
    downloadButton.download = downloadName(response, 'arquivo-comprimido.pdf');
    resultSummary.textContent = reduction > 0 ? `${formatBytes(original)} → ${formatBytes(compressed)} · ${reduction}% menor` : `${formatBytes(compressed)} · o arquivo já estava otimizado`;
    progress.hidden = true;
    result.hidden = false;
  } catch (error) {
    progress.hidden = true;
    fileCard.hidden = false;
    qualityOptions.hidden = false;
    compressButton.hidden = false;
    showCompressionError(error.message);
  }
});

const convertForm = document.querySelector('#convert-form');
const convertInput = document.querySelector('#convert-file-input');
const convertDropZone = document.querySelector('#convert-drop-zone');
const convertDropTitle = document.querySelector('#convert-drop-title');
const convertFileCard = document.querySelector('#convert-file-card');
const convertFileBadge = document.querySelector('#convert-file-badge');
const convertFileName = document.querySelector('#convert-file-name');
const convertFileSize = document.querySelector('#convert-file-size');
const convertRemoveButton = document.querySelector('#convert-remove-file');
const convertButton = document.querySelector('#convert-button');
const convertButtonLabel = document.querySelector('#convert-button-label');
const convertProgress = document.querySelector('#convert-progress');
const convertProgressTitle = document.querySelector('#convert-progress-title');
const convertResult = document.querySelector('#convert-result');
const convertResultSummary = document.querySelector('#convert-result-summary');
const convertDownloadButton = document.querySelector('#convert-download-button');
const convertNewFileButton = document.querySelector('#convert-new-file');
const convertErrorMessage = document.querySelector('#convert-error-message');
const directionInputs = document.querySelectorAll('input[name="direction"]');
let convertSelectedFile = null;
let convertDownloadUrl = null;

function conversionDirection() { return new FormData(convertForm).get('direction'); }
function showConvertError(message) { convertErrorMessage.textContent = message; convertErrorMessage.hidden = false; }
function hideConvertError() { convertErrorMessage.hidden = true; convertErrorMessage.textContent = ''; }
function resetConversion() {
  convertSelectedFile = null;
  convertInput.value = '';
  if (convertDownloadUrl) URL.revokeObjectURL(convertDownloadUrl);
  convertDownloadUrl = null;
  convertFileCard.hidden = true;
  convertButton.hidden = true;
  convertProgress.hidden = true;
  convertResult.hidden = true;
  convertDropZone.hidden = false;
  hideConvertError();
}
function updateConversionDirection() {
  resetConversion();
  const isPdfToWord = conversionDirection() === 'pdf-to-word';
  convertInput.accept = isPdfToWord ? 'application/pdf,.pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx';
  convertDropTitle.textContent = isPdfToWord ? 'Selecione um arquivo PDF' : 'Selecione um arquivo Word (.docx)';
  convertButtonLabel.textContent = isPdfToWord ? 'Converter para Word' : 'Converter para PDF';
  convertProgressTitle.textContent = isPdfToWord ? 'Convertendo PDF para Word…' : 'Convertendo Word para PDF…';
}
function setConvertFile(file) {
  hideConvertError();
  const isPdfToWord = conversionDirection() === 'pdf-to-word';
  const valid = isPdfToWord
    ? file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    : file && file.name.toLowerCase().endsWith('.docx');
  if (!valid) return showConvertError(isPdfToWord ? 'Selecione um arquivo no formato PDF.' : 'Selecione um arquivo Word no formato .docx.');
  if (file.size > 100 * 1024 * 1024) return showConvertError('O arquivo ultrapassa o limite de 100 MB.');
  convertSelectedFile = file;
  convertFileName.textContent = file.name;
  convertFileSize.textContent = formatBytes(file.size);
  convertFileBadge.textContent = isPdfToWord ? 'PDF' : 'WORD';
  convertDropZone.hidden = true;
  convertFileCard.hidden = false;
  convertButton.hidden = false;
}
directionInputs.forEach(inputElement => inputElement.addEventListener('change', updateConversionDirection));
convertInput.addEventListener('change', () => setConvertFile(convertInput.files[0]));
convertRemoveButton.addEventListener('click', resetConversion);
convertNewFileButton.addEventListener('click', resetConversion);
['dragenter', 'dragover'].forEach(eventName => convertDropZone.addEventListener(eventName, event => { event.preventDefault(); convertDropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(eventName => convertDropZone.addEventListener(eventName, event => { event.preventDefault(); convertDropZone.classList.remove('dragging'); }));
convertDropZone.addEventListener('drop', event => setConvertFile(event.dataTransfer.files[0]));
convertForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!convertSelectedFile) return showConvertError('Selecione um arquivo para converter.');
  hideConvertError();
  convertFileCard.hidden = true;
  convertButton.hidden = true;
  convertProgress.hidden = false;
  const direction = conversionDirection();
  const body = new FormData();
  body.append('file', convertSelectedFile);
  body.append('direction', direction);
  try {
    const response = await fetch('/api/convert', { method: 'POST', body });
    if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || 'Falha ao converter o arquivo.'); }
    const blob = await response.blob();
    convertDownloadUrl = URL.createObjectURL(blob);
    convertDownloadButton.href = convertDownloadUrl;
    convertDownloadButton.download = downloadName(response, direction === 'pdf-to-word' ? 'arquivo-convertido.docx' : 'arquivo-convertido.pdf');
    convertResultSummary.textContent = `${convertSelectedFile.name} → ${direction === 'pdf-to-word' ? 'Word (.docx)' : 'PDF'} · ${formatBytes(blob.size)}`;
    convertProgress.hidden = true;
    convertResult.hidden = false;
  } catch (error) {
    convertProgress.hidden = true;
    convertFileCard.hidden = false;
    convertButton.hidden = false;
    showConvertError(error.message);
  }
});

window.addEventListener('hashchange', showPage);
updateConversionDirection();
showPage();
document.querySelector('#year').textContent = new Date().getFullYear();
