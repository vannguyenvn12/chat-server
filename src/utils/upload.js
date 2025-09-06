// upload.js
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { ulid } = require("ulid");

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Chỉ lấy phần đuôi hợp lệ, tránh path traversal
const safeExt = (name) => {
    const ext = path.extname(name || "").toLowerCase();
    if (!ext || ext.length > 10) return "";
    return ext.replace(/[^.a-z0-9]/g, "");
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = safeExt(file.originalname);
        cb(null, `${ulid()}${ext}`);
    },
});

// Tuỳ chỉnh filter nếu muốn giới hạn loại file
const fileFilter = (req, file, cb) => {
    // Ví dụ chỉ cho ảnh & pdf:
    // if (!/^image\\//.test(file.mimetype) && file.mimetype !== "application/pdf") {
    //   return cb(new Error("Only images and pdf allowed"));
    // }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        files: 20,            // tối đa 20 file
        fileSize: 25 * 1024 * 1024, // 25MB/file
    },
});

// Middleware nhận nhiều file: 'files' và optional 'meta' (nếu meta gửi như file)
const uploadMiddleware = upload.fields([
    { name: "files", maxCount: 20 },
    { name: "meta", maxCount: 1 },
]);

module.exports = { uploadMiddleware, UPLOAD_DIR };
