const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'dist');
const dest = path.join(__dirname, '..', 'dist');

if (fs.existsSync(src)) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });

  // Also ensure dest/vgarss has all root files
  const vgarssDest = path.join(dest, 'vgarss');
  fs.mkdirSync(vgarssDest, { recursive: true });
  const entries = fs.readdirSync(dest);
  for (const entry of entries) {
    if (entry === 'vgarss') continue;
    fs.cpSync(path.join(dest, entry), path.join(vgarssDest, entry), { recursive: true });
  }

  console.log(`Successfully synced frontend/dist -> dist and prepared dist/vgarss`);
} else {
  console.error(`Source directory not found: ${src}`);
  process.exit(1);
}
