const fs = require('fs');
const year = "2026";
const ay = 3;
const daysInMonth = new Date(year, ay, 0).getDate();

const aracId = "uuid-1234";
const aracPlaka = "45ANZ193";

let thHtml = '<tr><th class="px-3 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0]" style="width: 130px; min-width: 130px;">ARAÇ (V/T)</th>';
for (let i = 1; i <= daysInMonth; i++) {
    thHtml += `<th class="p-0 py-2.5 text-center text-[11px] font-semibold text-slate-600 border-l border-b border-slate-200" style="width: 38px; min-width: 38px; max-width: 38px;">${i}</th>`;
}
thHtml += '<th class="px-0 py-2.5 text-center text-[10px] font-bold text-slate-600 border-l border-b border-slate-200 uppercase tracking-wider sticky right-0 bg-slate-50 z-10 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;">TOP</th></tr>';

let tblHtml = '';
let rowVardiyaTotal = 0;
let rowTekTotal = 0;
const bgPlaka = 'bg-white';

tblHtml += `<tr class="hover:bg-blue-50/40 transition-colors">`;
tblHtml += `<td class="px-3 py-1.5 text-[11px] font-medium text-slate-800 sticky left-0 ${bgPlaka} z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] leading-tight" style="width: 130px; min-width: 130px;" rowspan="2">
                <div class="font-bold text-slate-900 break-all" title="${aracPlaka}">${aracPlaka}</div>
                <div class="text-[9px] text-slate-500 mt-1.5 flex justify-between pr-1"><span>Vardiya:</span></div>
                <div class="text-[9px] text-slate-500 mt-1 flex justify-between pr-1"><span>Tek Sfr:</span></div>
            </td>`;

for (let i = 1; i <= daysInMonth; i++) {
    const safeVal = '';
    const bgClass = 'bg-transparent text-slate-700';
    const inpid = `cell-${aracId}-vardiya-${i}`;

    tblHtml += `<td class="p-0 border-l border-b border-slate-200 align-middle" style="width: 38px; min-width: 38px; max-width: 38px;">
                <input type="text" id="${inpid}" value="${safeVal}"
                class="w-full text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-500 focus:bg-white p-0 m-0 border-none ${bgClass} transition-all"
                style="height: 26px; line-height: 26px;">
            </td>`;
}
tblHtml += `<td class="px-0 py-0 text-center text-[11px] font-bold text-slate-700 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;">${rowVardiyaTotal}</td>`;
tblHtml += `</tr>`;

tblHtml += `<tr class="hover:bg-orange-50/40 transition-colors">`;
for (let i = 1; i <= daysInMonth; i++) {
    const safeVal = '';
    const bgClass = 'bg-transparent text-slate-700';
    const inpid = `cell-${aracId}-tek-${i}`;

    tblHtml += `<td class="p-0 border-l border-b border-slate-200 align-middle" style="width: 38px; min-width: 38px; max-width: 38px;">
                <input type="text" id="${inpid}" value="${safeVal}"
                class="w-full text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-500 focus:bg-white p-0 m-0 border-none ${bgClass} transition-all"
                style="height: 26px; line-height: 26px;">
            </td>`;
}
tblHtml += `<td class="px-0 py-0 text-center text-[11px] font-bold text-slate-700 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;">${rowTekTotal}</td>`;
tblHtml += `</tr>`;

const fullHtml = `
<html>
<head>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="p-8">
    <div class="flex-1 overflow-auto bg-slate-100 p-4 md:p-6" id="grid-container">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-w-max mx-auto">
            <table class="w-full text-left border-collapse" id="excel-table" style="table-layout: fixed;">
                <thead class="bg-slate-50 select-none">${thHtml}</thead>
                <tbody class="divide-y divide-slate-100">${tblHtml}</tbody>
            </table>
        </div>
    </div>
</body>
</html>
`;
fs.writeFileSync('C:\\Users\\hhasa\\OneDrive\\Desktop\\Filo-ERP\\test-grid.html', fullHtml);
console.log("Written to test-grid.html");
