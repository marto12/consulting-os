import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const clientDir = path.resolve(root, 'client');

console.log('Building frontend with Vite...');
execSync('npx vite build', {
  cwd: clientDir,
  stdio: 'inherit',
});
console.log('Frontend build complete.');
