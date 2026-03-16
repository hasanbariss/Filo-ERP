const fs = require('fs');
const lines = fs.readFileSync('filoyonetim.html', 'utf8').split('\n');
let d = 0;
let results = [];
for (let i = 1540; i <= 1722; i++) {
    const l = lines[i] || '';
    const o = (l.match(/<div\b[^>]*>/g) || []).length;
    const c = (l.match(/<\/div>/g) || []).length;
    d += o - c;
    results.push((i + 1) + ' open: ' + o + ' close: ' + c + ' depth: ' + d + ' | ' + l.trim());
}
fs.writeFileSync('depth-cari.txt', results.join('\n'));
console.log('Depth at end of module-cari:', d);
