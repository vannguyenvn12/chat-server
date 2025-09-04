// from-text-to-docx.js
const fs = require("fs");
const path = require("path");
const { exportDocsIcaviet } = require("./export-icaviet-docx"); // dùng file ở Bước 1

function parseInterviewText(raw) {
  // Chuẩn hóa
  const lines = raw.split(/\r?\n/).map(s => s.trim());
  const nonEmpty = (arr) => arr.filter(Boolean);

  // Lấy case + tên KH
  // Ví dụ: "Mục 2 – Bộ câu hỏi hoàn chỉnh cho hồ sơ 2023CR127101 – CAO BA DŨNG"
  let ma_ten = null, khach_hang = null, dien = null;
  for (const l of lines) {
    const m = l.match(/h[oô] sơ\s+([A-Z0-9]+)\s*[-–]\s*(.+)$/i);
    if (m) { ma_ten = m[1].trim(); khach_hang = m[2].trim(); break; }
  }
  // Ví dụ: "(Diện CR1 – công dân Mỹ ...)"
  for (const l of lines) {
    const d = l.match(/\(.*?Diện\s+([A-Z0-9]+)\b/i);
    if (d) { dien = d[1].trim(); break; }
  }

  // Tìm mốc I / II / III
  const idxI = lines.findIndex(l => /^I\./.test(l));
  const idxII = lines.findIndex(l => /^II\./.test(l));
  const idxIII = lines.findIndex(l => /^III\./.test(l));

  if (idxI === -1 || idxII === -1 || idxIII === -1) {
    throw new Error("Không tìm thấy đủ 3 mục I/II/III trong văn bản.");
  }

  // --- I. SV ---
  let svBlock = lines.slice(idxI + 1, idxII);
  // Bỏ dòng mô tả trong ngoặc (vd: "(Ngắn gọn,...)")
  svBlock = svBlock.filter(l => l && !/^\(.*\)$/.test(l));
  const sv_list = nonEmpty(svBlock);

  // --- II. PV (có nhóm) ---
  const pvBlock = lines.slice(idxII + 1, idxIII).filter(Boolean);

  const pv_groups = [];
  let cur = null;
  const reGroup = /^(Nh[oó]m|Nhom)\s*\d+\s*[-–]\s*(.+)$/i;

  for (const l of pvBlock) {
    const mg = l.match(reGroup);
    if (mg) {
      cur = { group: l, items: [] };
      pv_groups.push(cur);
      continue;
    }
    if (!cur) {
      // Nếu chưa gặp "Nhóm ..." mà có câu -> gom vào nhóm "Khác"
      cur = { group: "Nhóm khác", items: [] };
      pv_groups.push(cur);
    }
    cur.items.push(l);
  }

  // --- III. Lưu ý ---
  const notesBlock = lines.slice(idxIII + 1);
  const luu_y_kh = nonEmpty(notesBlock);

  return { ma_ten, khach_hang, dien, sv_list, pv_list: pv_groups, luu_y_kh };
}

async function main() {
  const inputPath = path.join(__dirname,"input.txt");
  if (!fs.existsSync(inputPath)) {
    throw new Error("Chưa có input.txt. Hãy tạo file input.txt và dán nội dung ChatGPT vào.");
  }
  const raw = fs.readFileSync(inputPath, "utf8");
  const data = parseInterviewText(raw);

  const out = path.join(__dirname, "ICAVIET_PV_THAMKHAO.docx");
  const result = await exportDocsIcaviet({
    outputPath: out,
    sv_list: data.sv_list,
    pv_list: data.pv_list,       // đã ở dạng nhóm → addPV() sẽ hiểu
    luu_y_kh: data.luu_y_kh,
    logo_path: "logo_icaviet.png",
    dien: data.dien,
    khach_hang: data.khach_hang,
    ma_ten: data.ma_ten,
  });

  console.log("✅ Đã xuất file:", result);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { parseInterviewText };
