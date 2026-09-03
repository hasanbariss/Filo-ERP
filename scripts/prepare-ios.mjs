import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const webDir = join(projectRoot, 'www');

const webFiles = [
  'filoyonetim.html',
  'puantaj.html',
  'yakit_raporu.html',
  'style.css',
  'ios-mobile.css',
  'design-system.css',
  'manifest.json',
  'service-worker.js',
  'ornek_puantaj_sablonu.xlsx',
  'app-fixes.js',
  'ios-mobile.js',
  'cache-manager.js',
  'config.js',
  'company-branding.js',
  'hakedis-calculations.js',
  'teklif-management.js',
  'fuel-analytics.js',
  'fuel-analytics-ui.js',
  'dashboard-funcs.js',
  'data-services.js',
  'dikkan-import.js',
  'evrak-arsivi.js',
  'excel-logic.js',
  'export-manager.js',
  'import-calendar.js',
  'import-manager.js',
  'is-emirleri.js',
  'keyboard-shortcuts.js',
  'manisa-fabrika-import.js',
  'operasyon-merkezi.js',
  'pdf-fonts.js',
  'puantaj.js',
  'rota-logic.js',
  'swipe-gestures.js',
  'toast-manager.js',
  'ui-manager.js',
  'whatsapp-reporter.js',
  'yakit_raporu.js'
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of webFiles) {
  await cp(join(projectRoot, file), join(webDir, file));
}

await cp(join(projectRoot, 'icons'), join(webDir, 'icons'), { recursive: true });
await cp(join(projectRoot, 'filoyonetim.html'), join(webDir, 'index.html'));

const output = await readdir(webDir);
console.log(`iOS web paketi hazırlandı: ${output.length} öğe`);
