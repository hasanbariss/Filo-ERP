const xlsx=require('xlsx');
const wb=xlsx.readFile('ornek_puantaj_sablonu.xlsx');
const ws=wb.Sheets[wb.SheetNames[0]];
const data=xlsx.utils.sheet_to_json(ws, {header:1, defval:''});
console.log('Headers (Row 1):', JSON.stringify(data[0]));
console.log('Row 2:', JSON.stringify(data[1]));
console.log('Row 3:', JSON.stringify(data[2]));
