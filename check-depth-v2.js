const fs = require('fs');
const html = fs.readFileSync('filoyonetim.html', 'utf8');
const lines = html.split('\n');

let d = 0;
let results = [];

for (let i = 1540; i <= 1722; i++) {
    const l = lines[i] || '';
    const o = (l.match(/<div\b/ig) || []).length;
    const c = (l.match(/<\/div>/ig) || []).length;
    d += o - c;
    results.push((i + 1) + ' open: ' + o + ' close: ' + c + ' depth: ' + d + ' | ' + l.trim());
}

fs.writeFileSync('depth-cari-fixed.txt', results.join('\n'));
console.log('Depth at end of module-cari:', d);
