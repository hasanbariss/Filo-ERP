const fs = require('fs');
const lines = fs.readFileSync('filoyonetim.html', 'utf8').split('\n');
let d = 0;
let results = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    const opens = (line.match(/<div\b[^>]*>/g) || []).length;
    let closes = (line.match(/<\/div>/g) || []).length;

    d += opens - closes;

    if (d < 0) {
        results.push('EXTRA CLOSING DIV AT LINE ' + (i + 1) + ': ' + line.trim() + ' (Depth before: ' + (d + closes - opens) + ')');
        d = 0; // reset to continue
    }
}
console.log(results.join('\n'));
