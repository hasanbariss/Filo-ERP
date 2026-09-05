import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const webDir = join(projectRoot, 'www');

const webFiles = [
  'filoyonetim.html',
  'puantaj.html',
  'yakit_raporu.html',
  'yakit-raporu.css',
  'style.css',
  'ios-mobile.css',
  'design-system.css',
  'web-premium.css',
  'web-executive.css',
  'fleet-bulk-edit.css',
  'auth-v2.css',
  'ui-final-pass.css',
  'manifest.json',
  'service-worker.js',
  'ornek_puantaj_sablonu.xlsx',
  'app-fixes.js',
  'sidebar-flyout.js',
  'sidebar-flyout.css',
  'ios-mobile.js',
  'cache-manager.js',
  'config.js',
  'company-branding.js',
  'hakedis-calculations.js',
  'teklif-management.js',
  'fuel-analytics.js',
  'fuel-analytics-ui.js',
  'fleet-bulk-edit.js',
  'fleet-scope.js',
  'maintenance-workspace.js',
  'maintenance-tracking.js',
  'maintenance-planner.js',
  'erp-workspace-core.js',
  'erp-workspace-data.js',
  'erp-workspace.js',
  'erp-workspace.css',
  'report-analytics.js',
  'report-comparison-ui.js',
  'turkish-month-select.js',
  'personnel-operations.js',
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
  'vehicle-deletion.js',
  'feedback-ui.css',
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
