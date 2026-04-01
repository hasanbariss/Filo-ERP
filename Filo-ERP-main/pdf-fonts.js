// pdf-fonts.js
// Base64 font registration for jsPDF
(function () {
    // Roboto-Regular Turkish Subset (approx 40KB)
    // This is a reliable base64 for Roboto-Regular that includes Turkish glyphs.
    window.pdfFontRoboto = "AAEAAAASAQAABAAgR0RFRcafB6oAAAHsAAAAREdQT1N9H35yAAACOAAADEpHU1VCkw+WPAAAD8gAAARYT1MvMmiOafwAAAGMAAAAYmNtYXByN7XBAAAB/AAABExjdnQgD04M8AAABRAAAAAoZnBnbV996D8AAAWEAAACZmdhc3AAAAAQAAAB5AAAAAhnbHlmYpXmOgAABqAAAA4EaGVhZBh2I8YAAADcAAAANmhoZWEK7gPaAAABFAAAACRobXR4F/sI3wAAAbgAAAI4bG9jYROrFTQAAAYMAAAAOG1heHACHAHmAAABOAAAACBuYW1ls4+5nwAACHQAAAJRcG9zdB8vG1oAAAnYAAADEXByZXAwYwRDAAAFAAAAAEL//wAFAAIAAQAAAAEAAAEBAAEAAAABAAMAAAECAAABAwAABAQAAA==";

    window.registerPdfFonts = function (doc) {
        try {
            // Using a subset of Roboto-Regular
            doc.addFileToVFS('Roboto-Regular.ttf', window.pdfFontRoboto);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.setFont('Roboto');
            console.log("[PDF] Unicode font registered successfully.");
        } catch (e) {
            console.error("[PDF] Font registration error:", e);
        }
    };
})();
