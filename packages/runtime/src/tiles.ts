/**
 * HTTP/2 Range request tile fetcher.
 */

import type { Manifest } from './parser.js';
import { ensureHeaderCache, wrapRSTSegment } from './jpeg-wrap.js';

let rangeSupportChecked = false;
let rangeSupported = true;

export async function streamTiles(
  container: HTMLElement,
  img: HTMLImageElement,
  imageURL: string,
  manifest: Manifest,
  opts: {
    concurrency: number;
    onTile?: (idx: number) => void;
    urlRegistry?: string[];
  }
): Promise<void> {
  const { tileSize, tiles, tileCols, width, height } = manifest;
  const { concurrency, onTile, urlRegistry = [] } = opts;

  await ensureHeaderCache(imageURL);
  if (!container.contains(img)) return;

  const tileIndices = manifest.priority.length > 0
    ? manifest.priority
    : tiles.map((_, i) => i);

  const fetchTile = async (idx: number): Promise<void> => {
    const tile = tiles[idx];
    if (tile.length === 0) return;

    const col = idx % tileCols;
    const row = Math.floor(idx / tileCols);
    const tileEl = document.createElement('img');
    const tileW = Math.min(tileSize, width - col * tileSize);
    const tileH = Math.min(tileSize, height - row * tileSize);

    tileEl.style.position = 'absolute';
    tileEl.style.left = `${col * tileSize}px`;
    tileEl.style.top = `${row * tileSize}px`;
    tileEl.style.width = `${tileW}px`;
    tileEl.style.height = `${tileH}px`;
    tileEl.style.objectFit = 'cover';
    tileEl.style.objectPosition = `${-col * tileSize}px ${-row * tileSize}px`;
    tileEl.decoding = 'async';
    tileEl.width = tileW;
    tileEl.height = tileH;
    tileEl.setAttribute('data-sidecar-tile', '1');

    container.appendChild(tileEl);

    const res = await fetch(imageURL, {
      headers: { Range: `bytes=${tile.offset}-${tile.offset + tile.length - 1}` },
    });

    if (!rangeSupportChecked) {
      rangeSupportChecked = true;
      rangeSupported = res.status === 206;
      if (!rangeSupported) {
        console.warn('[sidecar] Server does not support Range requests — tile streaming disabled');
        return;
      }
    }

    if (res.status !== 206) return;

    const buf = await res.arrayBuffer();
    const bandHeight = Math.ceil(tileSize / 16) * 16;
    const bandWidth = width;
    const blob = wrapRSTSegment(buf, bandWidth, bandHeight);
    if (blob.size === 0) return;

    const url = URL.createObjectURL(blob);
    urlRegistry.push(url);
    tileEl.src = url;
    tileEl.style.objectPosition = `${-col * tileSize}px 0`;
    onTile?.(idx);
  };

  for (let i = 0; i < tileIndices.length; i += concurrency) {
    const batch = tileIndices.slice(i, i + concurrency).filter((idx) => tiles[idx].length > 0);
    if (!rangeSupported) break;
    await Promise.all(batch.map(fetchTile));
  }
}
