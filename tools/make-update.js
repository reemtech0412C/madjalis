// يبني حزمة التحديث الخفيفة من نسخة مبنيّة (electron-builder --dir):
//   node tools/make-update.js            ← يقرأ dist/win-unpacked/resources ويكتب dist/Majalis-update-<version>.zip و .sha256
// ثمّ تُرفَع الملّفات مع إصدار (Release) وسمه v<version> في المستودع.
const fs = require("fs"), path = require("path"), cp = require("child_process"), crypto = require("crypto");
const ver = require("../package.json").version, root = path.join(__dirname, "..", "dist", "win-unpacked", "resources");
if (!fs.existsSync(path.join(root, "app.asar"))) { console.error("لا توجد dist/win-unpacked/resources/app.asar — ابنِ البرنامج أوّلاً: npx electron-builder --dir"); process.exit(1); }
const stage = path.join(__dirname, "..", "dist", "_upd"); fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { recursive: true });
fs.copyFileSync(path.join(root, "app.asar"), path.join(stage, "app.asar"));
if (fs.existsSync(path.join(root, "app.asar.unpacked"))) fs.cpSync(path.join(root, "app.asar.unpacked"), path.join(stage, "app.asar.unpacked"), { recursive: true });
const zip = path.join(__dirname, "..", "dist", `Majalis-update-${ver}.zip`); fs.rmSync(zip, { force: true });
cp.execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${stage}\*' -DestinationPath '${zip}' -Force`], { stdio: "inherit" });
const sha = crypto.createHash("sha256").update(fs.readFileSync(zip)).digest("hex");
fs.writeFileSync(zip + ".sha256", sha + "  " + path.basename(zip) + "\n"); fs.rmSync(stage, { recursive: true, force: true });
console.log("تمّ:", zip, (fs.statSync(zip).size / 1048576).toFixed(1), "م.ب", "\nSHA-256:", sha);
