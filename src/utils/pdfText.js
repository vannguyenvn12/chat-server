const fs = require("fs/promises");
const pdfParse = require("pdf-parse");

/** Trích text từ 1 file PDF trên disk */
async function extractPdfText(filePath) {
    const buf = await fs.readFile(filePath);
    const data = await pdfParse(buf);
    // data.text có thể rất dài; tùy ý cắt ngắn
    return (data.text || "").trim();
}

module.exports = { extractPdfText };
