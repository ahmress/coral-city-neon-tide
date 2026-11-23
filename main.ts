// main.ts — Coral City: Neon Tide, entry point for the make.fun gate.
// Stages the playable game and its screenshots into the output directory,
// then writes the dossier the scorer expects, using the vendored library
// so the bytes match what the gate computes from the same tree.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is exactly two trees side by side: game/ and screenshots/.
mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The dossier is a pure function of what was staged. The caps mirror the
// bounty's gate: only text_max_bytes shapes the bytes, the rest refuse
// where the scorer would refuse.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`coral-city: staged game + screenshots, dossier ${dossier.length} bytes -> ${outDir}`);
console.log('coral-city: play it by serving game/ as static files and opening index.html');
