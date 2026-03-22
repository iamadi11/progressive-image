/**
 * Phase orchestrator for progressive image loading.
 */

import { parseSidecar } from './parser.js';
import { streamTiles } from './tiles.js';

export interface LoaderOptions {
  onPhase?: (phase: 'placeholder' | 'pyramid' | 'tiles' | 'full') => void;
  onFrame?: (frameInfo: { phase: string; elapsed: number }) => void;
  slowConnectionThreshold?: number;
  tileConcurrency?: number;
  skipTiles?: boolean;
}

const DEFAULT_OPTIONS: Required<LoaderOptions> = {
  onPhase: () => {},
  onFrame: () => {},
  slowConnectionThreshold: 10,
  tileConcurrency: 4,
  skipTiles: false,
};

export async function loadProgressive(
  img: HTMLImageElement,
  imageURL: string,
  sidecarURL: string,
  opts?: LoaderOptions
): Promise<void> {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const urlRegistry: string[] = [];
  const startTime = performance.now();

  const revokeAll = () => {
    for (const url of urlRegistry) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    urlRegistry.length = 0;
  };

  const createObjectURL = (blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    urlRegistry.push(url);
    return url;
  };

  const reportPhase = (phase: 'placeholder' | 'pyramid' | 'tiles' | 'full') => {
    options.onPhase(phase);
    options.onFrame({ phase, elapsed: performance.now() - startTime });
  };

  reportPhase('placeholder');

  img.style.transition = 'opacity 0.15s ease-out';

  let res: Response;
  try {
    res = await fetch(sidecarURL);
  } catch {
    img.src = imageURL;
    await img.decode();
    revokeAll();
    reportPhase('full');
    return;
  }

  if (!res.ok) {
    img.src = imageURL;
    await img.decode();
    revokeAll();
    reportPhase('full');
    return;
  }

  const sidecarBuf = await res.arrayBuffer();
  let manifest;
  let levelBlobs: Blob[];
  try {
    const parsed = parseSidecar(sidecarBuf);
    manifest = parsed.manifest;
    levelBlobs = parsed.levelBlobs;
  } catch {
    img.src = imageURL;
    await img.decode();
    revokeAll();
    reportPhase('full');
    return;
  }

  if (img.width === 0) img.width = manifest.width;
  if (img.height === 0) img.height = manifest.height;

  reportPhase('pyramid');

  for (let i = 1; i < levelBlobs.length; i++) {
    const blob = levelBlobs[i];
    const url = createObjectURL(blob);
    await img.decode();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    img.style.opacity = '0';
    img.src = url;
    await img.decode();
    img.style.opacity = '1';
    options.onFrame({ phase: 'pyramid', elapsed: performance.now() - startTime });
  }

  const connection = (navigator as Navigator & { connection?: { downlink?: number } }).connection;
  const downlinkMbps = connection?.downlink ?? 0;
  const isSlowConnection = connection === undefined || downlinkMbps < options.slowConnectionThreshold;

  if (
    !options.skipTiles &&
    isSlowConnection &&
    manifest.levelCount > 0 &&
    manifest.tiles.some((t) => t.length > 0)
  ) {
    reportPhase('tiles');
    img.fetchPriority = 'high';
    const container = img.parentElement;
    if (container) {
      try {
        await streamTiles(container, img, imageURL, manifest, {
          concurrency: options.tileConcurrency,
          onTile: () => options.onFrame({ phase: 'tiles', elapsed: performance.now() - startTime }),
          urlRegistry,
        });
      } catch {
        /* graceful */
      }
    }
  }

  reportPhase('full');
  img.style.opacity = '0';
  img.src = imageURL;
  img.fetchPriority = 'high';
  await img.decode();
  img.style.opacity = '1';
  const container = img.parentElement;
  if (container) {
    const tileImgs = container.querySelectorAll('img[data-sidecar-tile]');
    tileImgs.forEach((el) => el.remove());
  }
  revokeAll();
}
