// 生成有质感的 App 图标（无需 canvas/sharp，纯像素渲染 + 4x 超采样）。
// 设计：靛蓝→紫罗兰渐变背景 + 顶部柔光 + 立体着色的珍珠质感地球（经纬网格 + 高光 + 边缘光）。
// 用法：node docs/build-icon.js  -> 写出 PNG 预览 + base64
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---------- PNG 编码 ----------
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); crcTable[n] = c; }
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(rgba, W, H) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  let p = 0;
  for (let y = 0; y < H; y++) { raw[p++] = 0; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; raw[p++] = rgba[i]; raw[p++] = rgba[i + 1]; raw[p++] = rgba[i + 2]; raw[p++] = rgba[i + 3]; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- 数学 / 颜色 ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sat = v => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------- 绘制单个超采样像素，返回 [r,g,b]（0-255） ----------
function shade(u, v) {
  // u,v ∈ [0,1]，左上(0,0)→右下(1,1)
  // 1) 对角渐变背景：左上亮靛蓝 → 右下深紫
  const cTL = hex("#7C77FF"), cBR = hex("#32209C");
  let col = mix3(cTL, cBR, sat((u + v) / 2 * 1.04 - 0.02));
  // 2) 左上柔光（提亮，营造光源方向）
  const glow = smooth(0.92, 0.0, Math.hypot(u - 0.29, v - 0.21));
  col = mix3(col, hex("#C9C6FF"), glow * 0.30);
  // 3) 右下角暗角（加深，增加体积感）
  const vig = smooth(0.50, 1.18, Math.hypot(u - 0.74, v - 0.80));
  col = mix3(col, hex("#1E1466"), vig * 0.34);

  // ---- 地球 ----
  const gcx = 0.5, gcy = 0.515, rg = 0.305;
  const dx = (u - gcx) / rg, dy = (v - gcy) / rg;
  const r2 = dx * dx + dy * dy;

  // 球体外侧柔和投影（把球“托起来”）
  if (r2 > 1) {
    const d = Math.sqrt(r2);
    const sh = smooth(1.42, 1.0, d) * 0.34;          // 外阴影强度
    col = mix3(col, hex("#241765"), sh);
    return col;
  }

  // 球面法线
  const nz = Math.sqrt(1 - r2);
  const nx = dx, ny = dy;
  // 光照方向（左上前方）
  const L = [-0.46, -0.55, 0.70]; const Ln = Math.hypot(...L);
  const lx = L[0] / Ln, ly = L[1] / Ln, lz = L[2] / Ln;
  const diff = sat(nx * lx + ny * ly + nz * lz);

  // 珍珠球体本体：阴影侧淡紫，受光侧近白
  const shadowCol = hex("#B9B4EE"), litCol = [255, 255, 255];
  let sphere = mix3(shadowCol, litCol, Math.pow(diff, 0.85));

  // 经纬网格（靛蓝细线）
  const lat = Math.asin(clamp(ny, -1, 1));
  const lon = Math.atan2(nx, nz);
  const sp = Math.PI / 6; // 30°
  const distLat = Math.min(((lat % sp) + sp) % sp, sp - ((lat % sp) + sp) % sp);
  const distLon = Math.min(((lon % sp) + sp) % sp, sp - ((lon % sp) + sp) % sp);
  // 赤道 / 中央经线加粗，使球体更“有设计感”
  const isEquator = Math.abs(Math.round(lat / sp)) < 1e-6;
  const isPrime = Math.abs(Math.round(lon / sp)) < 1e-6;
  const lwLat = isEquator ? 0.040 : 0.026, lwLon = isPrime ? 0.040 : 0.026;
  let gLat = (1 - smooth(0, lwLat, distLat));
  let gLon = (1 - smooth(0, lwLon, distLon)) * nz;                     // 经线近边缘淡出
  let gLine = Math.max(gLat, gLon);
  gLine *= smooth(0.04, 0.22, nz);                                     // 整体在轮廓处淡出
  const emph = (isEquator || isPrime) ? 0.72 : 0.55;
  sphere = mix3(sphere, hex("#5B5BD6"), gLine * emph);

  // 镜面高光（左上的亮点）
  const H = [lx, ly, lz + 1]; const Hn = Math.hypot(...H);
  const spec = Math.pow(sat(nx * H[0] / Hn + ny * H[1] / Hn + nz * H[2] / Hn), 42);
  sphere = mix3(sphere, [255, 255, 255], spec * 0.9);

  // 受光侧边缘亮光（rim light）
  const rim = smooth(0.34, 0.0, nz) * smooth(-0.1, 0.6, -(nx * 0.7 + ny * 0.7));
  sphere = mix3(sphere, [255, 255, 255], sat(rim) * 0.18);

  // 与背景的边缘抗锯齿：靠近轮廓时混入一点暗边
  const edge = smooth(0.0, 0.05, nz);
  sphere = mix3(mix3(sphere, hex("#3A2C9A"), 0.5), sphere, edge);

  // ---- 定位图钉（暖色珊瑚橘，立在地球上）----
  if (PIN) sphere = overlayPin(u, v, sphere);

  return sphere;
}

// 在球面颜色上叠加一枚有光泽的定位图钉（对称水滴形）
function overlayPin(u, v, base) {
  const cxp = 0.5, headY = 0.440, headR = 0.078, tipY = 0.610;
  // 1) 图钉在球面上的柔和投影（略偏右下）
  const shA = smooth(0.10, 0.0, Math.hypot((u - cxp - 0.012), (v - 0.585))) * 0.26;
  base = mix3(base, hex("#574BA6"), shA);

  // 2) 水滴形 = 圆头 ∪ 由 tip 向圆做切线构成的三角形
  const L = tipY - headY;
  const beta = Math.acos(clamp(headR / L, -1, 1));       // 切线半角
  const px1 = cxp + headR * Math.sin(beta), py1 = headY + headR * Math.cos(beta);
  const px2 = cxp - headR * Math.sin(beta);              // 对称
  const inHead = Math.hypot(u - cxp, v - headY) <= headR;
  // 三角形 (tip, P+, P-) 的点内判定（重心坐标）
  function inTri(Px, Py) {
    const v0x = px1 - cxp, v0y = py1 - tipY, v1x = px2 - cxp, v1y = py1 - tipY;
    const v2x = Px - cxp, v2y = Py - tipY;
    const d00 = v0x * v0x + v0y * v0y, d01 = v0x * v1x + v0y * v1y, d11 = v1x * v1x + v1y * v1y;
    const d20 = v2x * v0x + v2y * v0y, d21 = v2x * v1x + v2y * v1y;
    const den = d00 * d11 - d01 * d01;
    const a = (d11 * d20 - d01 * d21) / den, b = (d00 * d21 - d01 * d20) / den;
    return a >= 0 && b >= 0 && a + b <= 1;
  }
  if (!(inHead || inTri(u, v))) return base;

  // 3) 珊瑚橘竖向渐变
  const t = sat((v - (headY - headR)) / (tipY - (headY - headR)));
  let pin = mix3(hex("#FFA06A"), hex("#EF4E3A"), Math.pow(t, 0.95));
  // 头部左上高光
  const spec = smooth(0.060, 0.0, Math.hypot(u - (cxp - 0.022), v - (headY - 0.026)));
  pin = mix3(pin, [255, 255, 255], spec * 0.55);
  // 4) 中心白色圆孔
  const hole = smooth(0.032, 0.022, Math.hypot(u - cxp, v - headY));
  pin = mix3(pin, hex("#FFF3EC"), hole);
  return pin;
}

// ---------- 渲染（SS 倍超采样下采样） ----------
function render(size, ss) {
  const W = size, S = size * ss;
  const out = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = (x * ss + sx + 0.5) / S, v = (y * ss + sy + 0.5) / S;
          const c = shade(u, v); r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = ss * ss, i = (y * W + x) * 4;
      out[i] = Math.round(r / n); out[i + 1] = Math.round(g / n); out[i + 2] = Math.round(b / n); out[i + 3] = 255;
    }
  }
  return out;
}

const PIN = process.env.PIN !== "0";
const SS = 4;
const sizes = [180, 192, 512];
const result = {};
sizes.forEach(sz => {
  const png = encodePNG(render(sz, SS), sz, sz);
  fs.writeFileSync(path.join(__dirname, `icon-${sz}.png`), png);
  result[sz] = "data:image/png;base64," + png.toString("base64");
  console.log(`icon-${sz}.png  ${png.length} bytes  (dataURL ${result[sz].length} chars)`);
});
fs.writeFileSync(path.join(__dirname, "icons.json"), JSON.stringify(result));
console.log("已写出 docs/icon-*.png 与 docs/icons.json");
