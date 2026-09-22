const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGhostscriptArgs } = require('../src/compressor');

test('gera argumentos de compressão recomendada', () => {
  const args = buildGhostscriptArgs('/tmp/in.pdf', '/tmp/out.pdf', 'ebook');
  assert.ok(args.includes('-dPDFSETTINGS=/ebook'));
  assert.ok(args.includes('-dColorImageResolution=120'));
  assert.ok(args.includes('-sOutputFile=/tmp/out.pdf'));
  assert.equal(args.at(-1), '/tmp/in.pdf');
});

test('usa ebook para nível desconhecido', () => {
  const args = buildGhostscriptArgs('a.pdf', 'b.pdf', 'outro');
  assert.ok(args.includes('-dPDFSETTINGS=/ebook'));
});
