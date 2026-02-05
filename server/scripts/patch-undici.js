/**
 * If cheerio's dependency undici is missing lib/core/errors.js (broken install),
 * copy our patch so scans work. Run after npm install.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const undiciRoot = path.join(__dirname, '../node_modules/undici');
const undiciErrorsPath = path.join(undiciRoot, 'lib/core/errors.js');
const patchPath = path.join(__dirname, 'undici-errors.js');

if (!fs.existsSync(undiciRoot) || !fs.existsSync(patchPath)) process.exit(0);
if (fs.existsSync(undiciErrorsPath)) process.exit(0);

try {
  const patch = fs.readFileSync(patchPath, 'utf8');
  fs.mkdirSync(path.dirname(undiciErrorsPath), { recursive: true });
  fs.writeFileSync(undiciErrorsPath, patch);
  console.log('Patched undici (missing errors.js).');
} catch (e) {
  console.warn('Could not patch undici:', e.message);
}
