/**
 * export-manager.js
 * Utilty functions for exporting data to Excel and PDF formats.
 */

window.exportTableToExcel = function (tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error("Table not found:", tableId);
        return;
    }

    // Create worksheet
    const wb = XLSX.utils.table_to_book(table, { sheet: "Data" });

    // Download
    XLSX.writeFile(wb, `${filename || 'export'}.xlsx`);
};

window.exportTableToPDF = function (tableId, title) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');

    // Register fonts if available (Turkish support)
    if (typeof window.registerPdfFonts === 'function') {
        window.registerPdfFonts(doc);
    }

    const table = document.getElementById(tableId);
    if (!table) {
        console.error("Table not found:", tableId);
        return;
    }

    doc.setFontSize(18);
    doc.text(title || 'Rapor', 40, 40);
    doc.setFontSize(11);
    doc.setTextColor(100);

    // AutoTable plugin
    doc.autoTable({
        html: `#${tableId}`,
        startY: 60,
        styles: {
            fontSize: 8,
            cellPadding: 3,
            font: 'helvetica', // Fallback, will be overridden if custom font set
        },
        headStyles: {
            fillColor: [13, 15, 17], // IDEOL dark theme
            textColor: [255, 255, 255]
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        },
        margin: { top: 60 },
        // Use custom font for Turkish
        didParseCell: function (data) {
            if (typeof window.pdfFontRoboto !== 'undefined') {
                data.cell.styles.font = 'Roboto';
            }
        }
    });

    doc.save(`${title || 'export'}.pdf`);
};

window.exportTaseronData = function () {
    const activeTab = document.querySelector('[id^="taseron-content-"]:not(.hidden)');
    if (!activeTab) return;

    const id = activeTab.id.replace('taseron-content-', '');
    if (id === 'liste') window.exportTableToExcel('taseron-table', 'Taseron_Listesi');
    if (id === 'hakedis') window.exportTableToExcel('taseron-hakedis-table', 'Taseron_Hakedis');
    if (id === 'sefer') window.exportTableToExcel('taseron-sefer-table', 'Taseron_Seferler');
};

// Global format currency for exports/ui
window.formatCurrency = function (value) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};
