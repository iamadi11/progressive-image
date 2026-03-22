/**
 * Phase orchestrator for progressive image loading.
 */

import { parseSidecar, type Manifest } from './parser.js';
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
  // Strip forceTiles=1 so final img.src loads the actual image (fetch mock uses it for initial 404 only)
  const cleanImageURL = imageURL.replace(/\?forceTiles=1$/, '');

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
    options.onPhase?.(phase);
    options.onFrame?.({ phase, elapsed: performance.now() - startTime });
  };

  reportPhase('placeholder');

  img.style.transition = 'opacity 0.15s ease-out';

  // Start both fetches; show pyramid as soon as sidecar is ready (don't wait for full)
  const sidecarPromise = fetch(sidecarURL);
  const fullPromise = fetch(imageURL);

  let manifest: Manifest | null = null;
  let levelBlobs: Blob[] | null = null;
  let showedFull = false;

  const processSidecar = async (): Promise<boolean> => {
    let sidecarRes: Response;
    try {
      sidecarRes = await sidecarPromise;
    } catch {
      return false;
    }
    if (!sidecarRes.ok) return false;
    const sidecarBuf = await sidecarRes.arrayBuffer();
    try {
      const parsed = parseSidecar(sidecarBuf);
      manifest = parsed.manifest;
      levelBlobs = parsed.levelBlobs;
      if (img.width === 0) img.width = manifest.width;
      if (img.height === 0) img.height = manifest.height;
      if (!showedFull && levelBlobs.length > 1) {
        reportPhase('pyramid');
        const url = createObjectURL(levelBlobs[1]);
        img.style.opacity = '0';
        img.src = url;
        await img.decode();
        img.style.opacity = '1';
        options.onFrame?.({ phase: 'pyramid', elapsed: performance.now() - startTime });
      }
      return true;
    } catch {
      return false;
    }
  };

  const processFull = async (): Promise<boolean> => {
    let res: Response;
    try {
      res = await fullPromise;
    } catch {
      return false;
    }
    if (res.ok) {
      showedFull = true;
      img.style.opacity = '0';
      const blob = await res.blob();
      img.src = createObjectURL(blob);
      img.fetchPriority = 'high';
      await img.decode();
      img.style.opacity = '1';
      reportPhase('full');
      return true;
    }
    return false;
  };

  // Run both processors in parallel; each shows content as soon as its fetch completes
  const [sidecarOk, fullOk] = await Promise.all([processSidecar(), processFull()]);

  if (!sidecarOk) {
    img.src = cleanImageURL;
    await img.decode();
    revokeAll();
    reportPhase('full');
    return;
  }

  if (fullOk) {
    revokeAll();
    return;
  }

  // Full fetch failed; run pyramid→tiles→full fallback
  // When sidecarOk is true, processSidecar set manifest and levelBlobs
  const m = manifest!;
  const blobs = levelBlobs!;

  try {
    for (let i = 1; i < blobs.length; i++) {
      const blob = blobs[i];
      const url = createObjectURL(blob);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      img.style.opacity = '0';
      img.src = url;
      await img.decode();
      img.style.opacity = '1';
      options.onFrame?.({ phase: 'pyramid', elapsed: performance.now() - startTime });
    }

    const connection = (navigator as Navigator & { connection?: { downlink?: number } })
      .connection;
    const downlinkMbps = connection?.downlink ?? 0;
    const isSlowConnection =
      connection === undefined || downlinkMbps < options.slowConnectionThreshold;

    if (
      !options.skipTiles &&
      isSlowConnection &&
      m.levelCount > 0 &&
      m.tiles.some((t) => t.length > 0)
    ) {
      reportPhase('tiles');
      img.fetchPriority = 'high';
      const container = img.parentElement;
      if (container) {
        try {
          await streamTiles(container, img, cleanImageURL, m, {
            concurrency: options.tileConcurrency,
            onTile: () =>
              options.onFrame?.({ phase: 'tiles', elapsed: performance.now() - startTime }),
            urlRegistry,
          });
        } catch {
          /* graceful */
        }
      }
    }

    reportPhase('full');
    img.style.opacity = '0';
    img.src = cleanImageURL;
    img.fetchPriority = 'high';
    await img.decode();
    img.style.opacity = '1';
  } catch {
    img.src = cleanImageURL;
    try {
      await img.decode();
    } catch {
      /* let broken image show */
    }
    img.style.opacity = '1';
    reportPhase('full');
  } finally {
    const container = img.parentElement;
    if (container) {
      const tileImgs = container.querySelectorAll('img[data-sidecar-tile]');
      tileImgs.forEach((el) => el.remove());
    }
    revokeAll();
  }
}
