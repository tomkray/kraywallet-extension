import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- DEBUG: Current Directory Structure ---');
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);

try {
    const rootFiles = fs.readdirSync('.');
    console.log('Root files:', rootFiles);
} catch (e) {
    console.error('Error reading root:', e.message);
}

try {
    const serverFiles = fs.readdirSync('./server');
    console.log('Server files:', serverFiles);
} catch (e) {
    console.error('Error reading server directory:', e.message);
}

console.log('--- DEBUG: Attempting to require server/index.js ---');
try {
    await import('./server/index.js');
    console.log('SUCCESS: server/index.js loaded!');
} catch (e) {
    console.error('FAILURE: Could not load server/index.js:', e);
}
