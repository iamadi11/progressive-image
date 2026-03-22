/**
 * Zero dependencies. Parses the binary sidecar ArrayBuffer.
 * Called once per image on sidecar fetch completion.
 */

export class SidecarParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SidecarParseError';
  }
}

export interface Manifest {
  width: number;
  height: number;
  levelCount: number;
  tileCols: number;
  tileRows: number;
  tileSize: number;
  hasPriorityList: boolean;
  levels: Array<{ offset: number; length: number }>;
  tiles: Array<{ offset: number; length: number }>;
  priority: number[];
}

const MAGIC = [0x53, 0x43, 0x52, 0x01]; // "SCR" + version 1

export function parseSidecar(buf: ArrayBuffer): {
  manifest: Manifest;
  levelBlobs: Blob[];
} {
  const view = new DataView(buf);
  const len = buf.byteLength;

  if (len < 16) {
    throw new SidecarParseError('Sidecar too short');
  }

  for (let i = 0; i < 4; i++) {
    if (view.getUint8(i) !== MAGIC[i]) {
      throw new SidecarParseError(`Invalid magic bytes at offset ${i}`);
    }
  }

  const width = view.getUint16(4, true);
  const height = view.getUint16(6, true);
  const levelCount = view.getUint8(8);
  const tileCols = view.getUint8(9);
  const tileRows = view.getUint8(10);
  const tileSizeExp = view.getUint8(11);
  const flags = view.getUint8(12);
  const hasPriorityList = (flags & 1) !== 0;
  const tileSize = 1 << tileSizeExp;

  if (levelCount > 8) {
    throw new SidecarParseError(`Invalid level count: ${levelCount}`);
  }
  if (tileCols > 255) {
    throw new SidecarParseError(`Invalid tile columns: ${tileCols}`);
  }
  if (tileRows > 255) {
    throw new SidecarParseError(`Invalid tile rows: ${tileRows}`);
  }

  let pos = 16;

  const levels: Array<{ offset: number; length: number }> = [];
  for (let i = 0; i < levelCount; i++) {
    const offset = view.getUint32(pos, true);
    const length = view.getUint16(pos + 4, true);
    pos += 6;
    if (offset + length > len) {
      throw new SidecarParseError(`Level ${i} extends past buffer`);
    }
    levels.push({ offset, length });
  }

  const tileCount = tileCols * tileRows;
  const tiles: Array<{ offset: number; length: number }> = [];
  for (let i = 0; i < tileCount; i++) {
    const offset = view.getUint32(pos, true);
    const length = view.getUint16(pos + 4, true);
    pos += 6;
    tiles.push({ offset, length });
  }

  const priority: number[] = [];
  if (hasPriorityList) {
    for (let i = 0; i < tileCount; i++) {
      priority.push(view.getUint16(pos, true));
      pos += 2;
    }
  }

  const manifest: Manifest = {
    width,
    height,
    levelCount,
    tileCols,
    tileRows,
    tileSize,
    hasPriorityList,
    levels,
    tiles,
    priority,
  };

  const levelBlobs = levels.map(({ offset, length }) => {
    return new Blob([buf.slice(offset, offset + length)], { type: 'image/jpeg' });
  });

  return { manifest, levelBlobs };
}
