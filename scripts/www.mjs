// Copies the web app into www/ for the Android (Capacitor) build.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const p of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons', 'vendor', 'textures']) cpSync(p, `www/${p}`, { recursive: true });
console.log('www/ hazır');
