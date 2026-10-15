// c8 writes file paths relative to services/redirect/ (and with a backslash on Windows);
// SonarQube scans from the project root, so make them services/redirect/src/... with forward slashes.
const fs = require('node:fs');
const path = require('node:path');

const BACKSLASH = String.fromCodePoint(92);
const file = path.join(__dirname, '..', 'coverage', 'lcov.info');
const fixed = fs
  .readFileSync(file, 'utf8')
  .replace(/^SF:(.*)$/gm, (_, p) => `SF:services/redirect/${p.replaceAll(BACKSLASH, '/')}`);
fs.writeFileSync(file, fixed);
console.log('lcov paths prepared for SonarQube');
