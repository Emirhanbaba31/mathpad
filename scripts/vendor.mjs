// Copies third-party libraries and fonts from node_modules into vendor/ so the app works offline and inside the installer.
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const nm = p => join('node_modules', p);
const out = 'vendor';
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });

const copy = (from, to) => {
  if (!existsSync(nm(from))) throw new Error('Eksik: ' + from + ' (önce npm install)');
  cpSync(nm(from), join(out, to), { recursive: true });
};
copy('mathjs/lib/browser/math.js', 'math.js');
copy('katex/dist/katex.min.js', 'katex/katex.min.js');
copy('katex/dist/katex.min.css', 'katex/katex.min.css');
copy('katex/dist/fonts', 'katex/fonts');
copy('pdfjs-dist/build/pdf.min.js', 'pdf.min.js');
copy('pdfjs-dist/build/pdf.worker.min.js', 'pdf.worker.min.js');
copy('jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js');
// Anthropic SDK (for the astronaut tutor) bundled into one browser ES module
import { buildSync } from 'esbuild';
buildSync({ entryPoints: [nm('@anthropic-ai/sdk/index.mjs')], bundle: true, format: 'esm', minify: true, platform: 'browser', outfile: join(out, 'anthropic.mjs'), logLevel: 'error' });
// three.js + bloom post-processing (WebGL solar system) as one browser ES module
buildSync({
  stdin: {
    contents: `export * from 'three';
export { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
export { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
export { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';`,
    resolveDir: process.cwd(),
  },
  bundle: true, format: 'esm', minify: true, platform: 'browser', outfile: join(out, 'three.mjs'), logLevel: 'error',
});

// Fonts: only latin + latin-ext (Turkish) woff2 files, one stylesheet.
const fonts = [['space-grotesk', 'Space Grotesk', [400, 500, 600, 700]], ['jetbrains-mono', 'JetBrains Mono', [400, 500]]];
let css = '';
for (const [pkg, family, weights] of fonts) {
  for (const w of weights) for (const sub of ['latin-ext', 'latin']) {
    const file = `${pkg}-${sub}-${w}-normal.woff2`;
    copy(`@fontsource/${pkg}/files/${file}`, `fonts/${file}`);
    const range = readFileSync(nm(`@fontsource/${pkg}/${sub}-${w}.css`), 'utf8').match(/unicode-range:[^;]+;/)?.[0] ?? '';
    css += `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${w};src:url(./${file}) format('woff2');${range}}\n`;
  }
}
writeFileSync(join(out, 'fonts', 'fonts.css'), css);
console.log('vendor/ hazır');
