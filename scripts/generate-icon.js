// 生成应用图标的脚本
const fs = require('fs');
const path = require('path');

const size = 256;
const data = Buffer.alloc(size * size * 4);

// 绘制蓝色圆形背景 + 白色 T 字母
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const idx = (y * size + x) * 4;
    const cx = x - size / 2;
    const cy = y - size / 2;
    const dist = Math.sqrt(cx * cx + cy * cy);

    if (dist < size / 2 - 2) {
      // T 字母区域 (按比例缩放)
      const tx = x / size;
      const ty = y / size;
      const isT = (ty >= 0.25 && ty <= 0.38 && tx >= 0.25 && tx <= 0.75) || // 横线
                  (tx >= 0.42 && tx <= 0.58 && ty >= 0.25 && ty <= 0.78);   // 竖线

      if (isT) {
        // 白色
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else {
        // 蓝色 #007AFF
        data[idx] = 0;
        data[idx + 1] = 122;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      }
    } else {
      // 透明
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 0;
    }
  }
}

// 简单的 PNG 编码 (使用 zlib)
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
}

// PNG signature
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type (RGBA)
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// IDAT - 添加 filter byte
const rawData = [];
for (let y = 0; y < size; y++) {
  rawData.push(0); // filter type: none
  for (let x = 0; x < size; x++) {
    const idx = (y * size + x) * 4;
    rawData.push(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
  }
}
const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });

// IEND
const iend = Buffer.alloc(0);

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', iend)
]);

const outPath = path.join(__dirname, '..', 'assets', 'icon.png');
fs.writeFileSync(outPath, png);
console.log('Icon generated:', outPath);
