// export-icaviet-docx.js
// Compatible with "docx" ^9.5.1 – build all nodes first, then create Document once.

const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  BorderStyle,
  Footer,
  ImageRun,              // ✅ use ImageRun instead of Media.addImage
  convertMillimetersToTwip,
  SimpleField,
} = require("docx");

// ---------- Constants / helpers ----------
const TNR = "Times New Roman";
const BLACK = "000000";
const RED = "E22437";

const tnrRun = (text, opts = {}) =>
  new TextRun({
    text,
    font: TNR,
    size: opts.size ?? 26, // 13pt * 2
    color: opts.color ?? BLACK,
    bold: !!opts.bold,
    italics: !!opts.italics,
  });

function tnr13Runs(...texts) {
  return texts.map(
    (t) =>
      new TextRun({
        text: t,
        font: TNR,
        size: 26,
        color: BLACK,
      })
  );
}

function paragraphTNR13(text, opts = {}) {
  return new Paragraph({
    children: typeof text === "string" ? tnr13Runs(text) : text,
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: {
      before: opts.spaceBefore ?? 0,
      after: opts.spaceAfter ?? 0,
      line: opts.line ?? 360, // ~1.5
    },
  });
}

function headingMain(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240, line: 360 },
  });
}
function headingSub(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 160, line: 360 },
  });
}

function titleByDien(dien) {
  const d = String(dien || "").trim().toUpperCase();
  let s = "";
  if (["CR1", "IR1", "F2A"].includes(d)) s = "DÀNH CHO DIỆN VỢ CHỒNG";
  else if (d === "K1") s = "DÀNH CHO DIỆN HÔN PHU/HÔN THÊ";
  return `CÂU HỎI PHỎNG VẤN THAM KHẢO ${s}`.trim();
}

function resolveLogoPath(logoPath) {
  if (!logoPath) return null;
  const candidates = [
    logoPath,
    path.join(process.cwd(), path.basename(logoPath)),
    path.join(__dirname, path.basename(logoPath)),
  ];
  for (const p of candidates) {
    try {
      if (path.isAbsolute(p) && fs.existsSync(p)) return p;
      if (fs.existsSync(p)) return path.resolve(p);
    } catch (_) {}
  }
  return null;
}

// ---------- Blocks (build node arrays) ----------
function buildBannerNodes(logoPath) {
  const col1Percent = 40;
  const col2Percent = 60;
  const gutterTwip = 200;

  const logoCellParas = [];
  const resolved = resolveLogoPath(logoPath);
  if (resolved) {
    const data = fs.readFileSync(resolved);
    // ImageRun transformation uses pixels. Chọn chiều rộng “vừa phải” ~ 260px, để docx tự co chiều cao theo ảnh.
    const img = new ImageRun({
      data,
      transformation: { width: 260, height: 80 }, // chỉnh tùy logo của bạn
    });
    logoCellParas.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [img] }));
  } else {
    logoCellParas.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [tnrRun("[Logo ICAVIET]")] }));
  }

  const infoLines = [
    { t: "ICAVIET IMMIGRATION LLC", bold: true, size: 32 },
    { t: "Business License (UBI): 20222576711", size: 24 },
    { t: "Add: 300 E. 2nd Street Ste 1510, Reno, NV 89501", size: 24 },
    { t: "Email: info@icaviet.com     Website: icaviet.com", size: 24 },
    { t: "Phone: 253 343 5988 (US) - 0909 145 125 (VN)", size: 24 },
  ];
  const infoRuns = infoLines.map((line, idx) =>
    new TextRun({
      text: line.t + (idx < infoLines.length - 1 ? "\n" : ""),
      font: TNR,
      size: line.size,
      bold: !!line.bold,
      color: BLACK,
    })
  );
  const infoCellParas = [new Paragraph({ children: infoRuns, alignment: AlignmentType.LEFT })];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: logoCellParas,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: col1Percent, type: WidthType.PERCENTAGE },
            margins: { right: gutterTwip },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
          new TableCell({
            children: infoCellParas,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: col2Percent, type: WidthType.PERCENTAGE },
            margins: { left: gutterTwip },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
        ],
      }),
    ],
  });

  return [table, new Paragraph({})];
}

function buildCustomerAndFixedNotesNodes(ma_ten, khach_hang) {
  const nodes = [];
  if (ma_ten || khach_hang) {
    const value =
      ma_ten && khach_hang
        ? `${String(ma_ten).trim()} – ${String(khach_hang).trim()}`
        : ma_ten
        ? String(ma_ten).trim()
        : String(khach_hang).trim();

    nodes.push(
      new Paragraph({
        children: [tnrRun("Khách hàng: ", { bold: true }), tnrRun(value)],
        spacing: { after: 0, line: 312 },
      })
    );
    nodes.push(new Paragraph({ spacing: { after: 0, line: 240 } }));
  }

  nodes.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Ghi chú/Notes:",
          bold: true,
          italics: true,
          underline: {},
          font: TNR,
          size: 28,
        }),
      ],
    })
  );

  nodes.push(
    new Paragraph({
      children: [
        tnrRun(
          "Các câu hỏi phỏng vấn dưới đây được soạn riêng cho cho trường hợp của anh/chị, vì vậy anh/chị không nên chia sẻ lên mạng xã hội để đảm bảo thông tin cá nhân. Ngoài ra, anh/chị cần đặc biệt lưu ý:",
          { italics: true }
        ),
      ],
      spacing: { line: 360 },
    })
  );

  [
    "Những câu hỏi dưới đây và gợi ý kèm theo (nếu có) chỉ mang tính chất tham khảo.",
    "Lãnh sự quán có thể hỏi bất cứ phần nào liên quan đến hồ sơ nên anh/chị cần xem lại tổng thể trước khi đi phỏng vấn.",
    "Các câu trả lời tại buổi phỏng vấn phải trung thực, chính xác và thống nhất (giữa người bảo lãnh và người được bảo lãnh).",
    "Những câu hỏi nào không nghe rõ thì nên hỏi lại Viên chức Lãnh sự quán, tránh trả lời lạc đề/sai ý hay thiếu ý.",
  ].forEach((b) =>
    nodes.push(
      new Paragraph({
        children: [tnrRun(b, { italics: true })],
        bullet: { level: 0 },
        spacing: { line: 360 },
      })
    )
  );

  return nodes;
}

function buildSVNodes(svList) {
  if (!svList || !svList.length) return [];
  const out = [headingSub("I. Danh sách câu hỏi sơ vấn tham khảo")];
  svList.forEach((q, i) =>
    out.push(paragraphTNR13(`${i + 1}. ${q}`, { spaceAfter: 160, line: 312 }))
  );
  return out;
}

function buildPVNodes(pvInput) {
  if (!pvInput || !pvInput.length) return [];
  const out = [headingSub("II. Danh sách câu hỏi phỏng vấn tham khảo")];

  const isGrouped =
    pvInput.some((it) => typeof it === "object" && it && "group" in it);
  let counter = 0;

  const renderQuestion = (q, probe = null) => {
    counter++;
    const runs = [];
    const verify1 = /^\[\s*Câu\s*kiểm\s*chứng\s*\]\s*(.+)$/i.exec(q);
    const verify2 = /^\[\s*Cau\s*kiem\s*chung\s*\]\s*(.+)$/i.exec(q);
    const isVerify = !!(verify1 || verify2);
    const bodyTxt = isVerify ? (verify1?.[1] || verify2?.[1] || "").trim() : q;

    runs.push(tnrRun(`${counter}. `));
    if (isVerify) {
      runs.push(
        tnrRun("Câu kiểm chứng: ", { bold: true, italics: true, color: RED })
      );
      runs.push(tnrRun(bodyTxt, { italics: true }));
    } else {
      runs.push(tnrRun(bodyTxt));
    }
    if (probe) {
      runs.push(tnrRun("  →  "));
      runs.push(tnrRun(probe, { italics: true }));
    }
    out.push(new Paragraph({ children: runs, spacing: { after: 160, line: 312 } }));
  };

  if (isGrouped) {
    pvInput.forEach((group) => {
      out.push(
        new Paragraph({
          children: [tnrRun(String(group.group || "").trim(), { bold: true })],
          spacing: { before: 120, after: 80, line: 312 },
        })
      );
      (group.items || []).forEach((it) => {
        if (Array.isArray(it))
          renderQuestion(String(it[0] ?? ""), it[1] != null ? String(it[1]) : null);
        else if (typeof it === "object" && it)
          renderQuestion(String(it.q || it.question || it.text || ""));
        else renderQuestion(String(it || ""));
      });
    });
  } else {
    pvInput.forEach((it) => {
      if (Array.isArray(it))
        renderQuestion(String(it[0] ?? ""), it[1] != null ? String(it[1]) : null);
      else if (typeof it === "object" && it)
        renderQuestion(String(it.q || it.question || it.text || ""));
      else renderQuestion(String(it || ""));
    });
  }

  return out;
}

function normalizeNotes(notesInput) {
  const result = [];
  if (!notesInput) return result;
  if (typeof notesInput === "string") {
    const lines = notesInput.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    for (const ln of lines) result.push([ln, []]);
    return result;
  }
  if (Array.isArray(notesInput)) {
    for (const it of notesInput) {
      if (typeof it === "string") result.push([it.trim(), []]);
      else if (Array.isArray(it) && it.length >= 1) {
        const main = String(it[0]).trim();
        const subsRaw = it[1];
        const subs = Array.isArray(subsRaw) ? subsRaw.map((s) => String(s).trim()).filter(Boolean) : [];
        result.push([main, subs]);
      } else if (typeof it === "object" && it) {
        const main = String(it.text || it.title || it.note || "").trim();
        let subsRaw = it.subs || it.children || it.items || [];
        const subs = Array.isArray(subsRaw) ? subsRaw.map((s) => String(s).trim()).filter(Boolean) : [];
        if (main) result.push([main, subs]);
      } else {
        result.push([String(it).trim(), []]);
      }
    }
    return result;
  }
  return [[String(notesInput).trim(), []]];
}

function buildStructuredNotesNodes(notesInput) {
  const structured = normalizeNotes(notesInput);
  if (!structured.length) return [];

  const hasAnySubs = structured.some(([, subs]) => subs && subs.length);
  const out = [headingSub("III. Lưu ý trước khi tham gia phỏng vấn")];

  structured.forEach(([main, subs], idx) => {
    out.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${idx + 1}. ${main}`,
            font: TNR,
            size: 26,
            bold: !!hasAnySubs,
            color: BLACK,
          }),
        ],
        spacing: { after: 40, line: 312 },
      })
    );
    if (subs && subs.length) {
      subs.forEach((s) =>
        out.push(
          new Paragraph({
            children: tnr13Runs(s),
            bullet: { level: 0 },
            spacing: { after: 40, line: 312 },
          })
        )
      );
    }
  });

  out.push(new Paragraph({ spacing: { after: 120 } }));
  return out;
}

function buildFooter() {
  const year = new Date().getFullYear();
  const center = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0, line: 276 },
    children: [
      new TextRun({
        text: `© ${year} ICAVIET Immigration LLC. All rights reserved.\n`,
        font: TNR,
        size: 22,
        color: BLACK,
      }),
      new TextRun({
        text:
          "Tài liệu này chuẩn bị cho buổi phỏng vấn tại LSQ - vui lòng không chia sẻ ra ngoài.",
        font: TNR,
        size: 22,
        color: BLACK,
      }),
    ],
  });

  const right = new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({ text: "Page ", font: TNR, size: 22, color: BLACK }),
      new SimpleField("PAGE"),
      new TextRun({ text: " of ", font: TNR, size: 22, color: BLACK }),
      new SimpleField("NUMPAGES"),
    ],
  });

  return new Footer({ children: [center, right] });
}

// ---------- Main export ----------
async function exportDocsIcaviet({
  outputPath,
  sv_list = [],
  pv_list = [],
  luu_y_kh = null,
  logo_path = "logo_icaviet.png",
  dien = null,
  khach_hang = null,
  ma_ten = null,
}) {
  // 1) Build ALL nodes first (no Document instance needed)
  const allNodes = [
    ...buildBannerNodes(logo_path),
    headingMain(titleByDien(dien)),
    ...buildCustomerAndFixedNotesNodes(ma_ten, khach_hang),
    ...buildSVNodes(sv_list),
    ...buildPVNodes(pv_list),
    ...(luu_y_kh ? buildStructuredNotesNodes(luu_y_kh) : []),
  ];

  // 2) Create Document ONCE with children set
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: TNR, size: 26, color: BLACK },
          paragraph: { spacing: { line: 360 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { font: TNR, size: 36, bold: true, color: BLACK },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { line: 360, before: 480, after: 240 },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { font: TNR, size: 32, bold: true, color: BLACK },
          paragraph: {
            alignment: AlignmentType.LEFT,
            spacing: { line: 360, before: 160, after: 160 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(20),
              footer: convertMillimetersToTwip(10),
            },
          },
          footer: buildFooter(),
        },
        children: allNodes,
      },
    ],
  });

  // 3) Save
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buf);
  return path.resolve(outputPath);
}

// ---------- Smoke test ----------
async function smokeTest() {
  const sv_list = [
    "Anh/chị vui lòng cho biết họ tên đầy đủ?",
    "Anh/chị sinh ngày, tháng, năm nào?",
    "Passport của anh/chị còn hạn đến khi nào?",
    "Anh/chị đang cư trú tại địa chỉ nào? Đây có phải địa chỉ nhận visa không?",
    "Người bảo lãnh tên gì? Sinh năm bao nhiêu? Là công dân Mỹ hay thường trú nhân?",
  ];
  const pv_list = [
    [
      "Anh chị quen nhau bằng cách nào? Ai là người chủ động liên lạc trước?",
      "Khi gửi lời mời kết bạn trên Facebook, anh An dùng tài khoản nào? Hình đại diện ra sao?",
    ],
    [
      "Anh An bắt đầu nhắn tin lần đầu cho chị vào ngày nào? Nội dung thế nào?",
      "Chị có nhớ lúc đó mình đang làm gì, ở đâu không?",
    ],
    [
      "Sau khi quen online, bao lâu thì hai người bắt đầu gọi video cho nhau?",
      "Anh An hay chị là người gọi ý gọi video đầu tiên?",
    ],
    ["Ngày 02/09/2021, ai là người tỏ tình? Nói câu gì cụ thể?", "Chị trả lời thế nào?"],
  ];
  const luu_y_kh = [
    "Mang đầy đủ giấy tờ gốc và bản sao theo thứ tự logic.",
    "Nếu nghe không rõ câu hỏi, xin lịch sự nhờ viên chức lặp lại.",
  ];

  const out = path.join(process.cwd(), "ICAVIET_PV_THAMKHAO_MAU.docx");
  const result = await exportDocsIcaviet({
    outputPath: out,
    sv_list,
    pv_list,
    luu_y_kh,
    logo_path: "logo_icaviet.png",
    dien: "F2A",
    khach_hang: "AN VAN",
    ma_ten: "2023CR127101",
  });
  console.log("Đã xuất file:", result);
}

if (require.main === module) {
  smokeTest().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { exportDocsIcaviet };
