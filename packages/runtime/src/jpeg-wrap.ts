/**
 * Wraps a raw RST segment into a valid standalone JPEG.
 * DQT and DHT from main image are cached after first 2KB fetch.
 */

let headerCache: Uint8Array | null = null;

const HEADER_MARKERS = [0xdb, 0xc4];

function extractMarkerSegments(buf: Uint8Array, markerBytes: number[]): Uint8Array {
  const segments: Uint8Array[] = [];
  let i = 0;

  while (i < buf.length - 3) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0x00) {
      i += 2;
      continue;
    }
    if (markerBytes.includes(marker)) {
      const len = (buf[i + 2] << 8) | buf[i + 3];
      const segLen = 2 + len;
      segments.push(buf.slice(i, i + segLen));
      i += segLen;
    } else {
      i += 2;
      if (marker >= 0xd0 && marker <= 0xd9) {
        continue;
      }
      const len = (buf[i] << 8) | buf[i + 1];
      i += 2 + len;
    }
  }

  const totalLen = segments.reduce((s, seg) => s + seg.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const seg of segments) {
    out.set(seg, pos);
    pos += seg.length;
  }
  return out;
}

function buildSOF0(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(19);
  let pos = 0;
  buf[pos++] = 0xff;
  buf[pos++] = 0xc0;
  buf[pos++] = 0;
  buf[pos++] = 17;
  buf[pos++] = 8;
  buf[pos++] = (height >> 8) & 0xff;
  buf[pos++] = height & 0xff;
  buf[pos++] = (width >> 8) & 0xff;
  buf[pos++] = width & 0xff;
  buf[pos++] = 3;
  buf[pos++] = 1;
  buf[pos++] = 0x22;
  buf[pos++] = 0;
  buf[pos++] = 2;
  buf[pos++] = 0x11;
  buf[pos++] = 1;
  buf[pos++] = 3;
  buf[pos++] = 0x11;
  buf[pos++] = 1;
  return buf;
}

function buildSOS(): Uint8Array {
  return new Uint8Array([
    0xff, 0xda, 0, 12, 3,
    1, 0, 2, 0x11, 3, 0x11,
    0, 0x3f, 0,
  ]);
}

const SOI = new Uint8Array([0xff, 0xd8]);
const EOI = new Uint8Array([0xff, 0xd9]);

export async function ensureHeaderCache(imageURL: string): Promise<void> {
  if (headerCache) return;

  const res = await fetch(imageURL, {
    headers: { Range: 'bytes=0-2047' },
  });
  if (!res.ok) return;

  const buf = new Uint8Array(await res.arrayBuffer());
  headerCache = extractMarkerSegments(buf, HEADER_MARKERS);
}

/**
 * Wraps RST segment bytes into a valid standalone JPEG.
 * The rstBytes represent entropy data from a band - dimensions must match.
 * For full-width bands, tileWidth=imageWidth, tileHeight=bandHeight.
 */
export function wrapRSTSegment(
  rstBytes: ArrayBuffer,
  tileWidth: number,
  tileHeight: number
): Blob {
  if (!headerCache || tileWidth <= 0 || tileHeight <= 0) {
    return new Blob([], { type: 'image/jpeg' });
  }

  const sof0 = buildSOF0(tileWidth, tileHeight);
  const sos = buildSOS();
  const rst = new Uint8Array(rstBytes);

  const totalLen = SOI.length + headerCache.length + sof0.length + sos.length + rst.length + EOI.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;

  out.set(SOI, pos);
  pos += SOI.length;
  out.set(headerCache, pos);
  pos += headerCache.length;
  out.set(sof0, pos);
  pos += sof0.length;
  out.set(sos, pos);
  pos += sos.length;
  out.set(rst, pos);
  pos += rst.length;
  out.set(EOI, pos);

  return new Blob([out], { type: 'image/jpeg' });
}
