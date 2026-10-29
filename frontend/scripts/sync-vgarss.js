import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');
const vgarssDir = path.join(distDir, 'vgarss');

if (fs.existsSync(distDir)) {
  fs.mkdirSync(vgarssDir, { recursive: true });

  const entries = fs.readdirSync(distDir);
  for (const entry of entries) {
    if (entry === 'vgarss') continue;
    const srcPath = path.join(distDir, entry);
    const destPath = path.join(vgarssDir, entry);
    fs.cpSync(srcPath, destPath, { recursive: true });
  }
  console.log('Successfully mirrored dist -> dist/vgarss for dual-path hosting');
} else {
  console.warn('distDir does not exist yet:', distDir);
}
