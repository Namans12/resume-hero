/* Minimal PNG decoder → ink bitmap for the centerline pipeline.
   The 2026-07-05 artworks (svg/*.png) are thin one-line drawings stored as
   8-bit PNGs; the vector SVGs beside them embed the same art as base64
   rasters, so the PNG *is* the source of truth. Supports non-interlaced
   8-bit gray / RGB / palette / gray+alpha / RGBA (filters 0-4). Alpha is
   composited over white before thresholding. */

import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error('interlaced PNG unsupported');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const px = new Uint8Array(w * h * channels);
  let prevRow = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0;   // left
      const b = prevRow[i];                              // up
      const c = i >= channels ? prevRow[i - channels] : 0; // up-left
      let v = row[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = v & 0xff;
    }
    prevRow = out;
  }

  // luminance with alpha composited over white
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, a = 255;
    const o = i * channels;
    if (colorType === 0) { r = g = b = px[o]; }
    else if (colorType === 2) { r = px[o]; g = px[o + 1]; b = px[o + 2]; }
    else if (colorType === 3) { const p = px[o] * 3; r = palette[p]; g = palette[p + 1]; b = palette[p + 2]; }
    else if (colorType === 4) { r = g = b = px[o]; a = px[o + 1]; }
    else { r = px[o]; g = px[o + 1]; b = px[o + 2]; a = px[o + 3]; }
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[i] = Math.round((lum * a + 255 * (255 - a)) / 255);
  }
  return { w, h, gray };
}

/* Threshold the decoded image to the pipeline's ink bitmap. ox/oy = 0 so
   graph world coords equal (scaled) PNG pixel coords. `threshold`: gray
   levels strictly below it count as ink. `scale` supersamples the grayscale
   bilinearly first — the artworks' parallel strokes run only a few pixels
   apart at native size, and at 1x the thinner merges/zigzags them; at 2x
   they thin cleanly (world coords are then native px · scale). */
export function inkBitmap({ w, h, gray }, { threshold = 160, scale = 1 } = {}) {
  let W = w, H = h, g = gray;
  if (scale !== 1) {
    W = Math.round(w * scale); H = Math.round(h * scale);
    g = new Float64Array(W * H);
    for (let y = 0; y < H; y++) {
      const sy = Math.min(h - 1, (y + 0.5) / scale - 0.5);
      const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(h - 1, y0 + 1);
      const fy = sy - y0;
      for (let x = 0; x < W; x++) {
        const sx = Math.min(w - 1, (x + 0.5) / scale - 0.5);
        const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(w - 1, x0 + 1);
        const fx = sx - x0;
        g[y * W + x] =
          gray[y0 * w + x0] * (1 - fx) * (1 - fy) + gray[y0 * w + x1] * fx * (1 - fy) +
          gray[y1 * w + x0] * (1 - fx) * fy + gray[y1 * w + x1] * fx * fy;
      }
    }
  }
  const data = new Uint8Array(W * H);
  let n = 0;
  for (let i = 0; i < W * H; i++) if (g[i] < threshold) { data[i] = 1; n++; }
  if (!n) throw new Error('no ink pixels found');
  return { data, w: W, h: H, ox: 0, oy: 0 };
}
