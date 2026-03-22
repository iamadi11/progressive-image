#!/usr/bin/env node
/**
 * Generate test images at target file sizes (MB).
 * Uses existing test.jpg as source. Outputs test-0.5mb.jpg, test-1mb.jpg, etc.
 * Run: pnpm generate:test-images
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'demo/public/images/test.jpg');
const OUTPUT_DIR = join(ROOT, 'demo/public/images');

const TARGET_SIZES_MB = [0.5, 1, 2, 5];
const TOLERANCE = 0.05; // within 5% of target

async function generateImage(targetBytes: number, outputPath: string): Promise<void> {
  const inputBuf = readFileSync(SOURCE);
  const pipeline = sharp(inputBuf).rotate();
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid source image dimensions: ${width}x${height}`);
  }

  const sourceBytes = inputBuf.length;
  const scaleFactor = Math.sqrt(targetBytes / sourceBytes);

  // Scale dimensions - at least 1x, cap at 15x for large targets (e.g. 5MB)
  const scale = Math.min(Math.max(scaleFactor, 1), 15);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  // Binary search on quality to hit target size
  let low = 50;
  let high = 95;
  let bestBuf: Buffer | null = null;
  let bestDiff = Infinity;

  for (let i = 0; i < 15; i++) {
    const quality = Math.round((low + high) / 2);
    const buf = await sharp(inputBuf)
      .rotate()
      .resize(newWidth, newHeight, { fit: 'fill' })
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      })
      .toBuffer();

    const diff = Math.abs(buf.length - targetBytes);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestBuf = buf;
    }

    if (buf.length < targetBytes * (1 - TOLERANCE)) {
      low = quality + 1;
    } else if (buf.length > targetBytes * (1 + TOLERANCE)) {
      high = quality - 1;
    } else {
      bestBuf = buf;
      break;
    }
  }

  if (!bestBuf) throw new Error(`Failed to generate image for target ${targetBytes}`);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(outputPath, bestBuf);
}

async function main(): Promise<void> {
  try {
    statSync(SOURCE);
  } catch {
    console.error(`Source image not found: ${SOURCE}`);
    process.exit(1);
  }

  console.log('Generating test images...\n');

  for (const sizeMb of TARGET_SIZES_MB) {
    const targetBytes = Math.round(sizeMb * 1024 * 1024);
    const outputPath = join(OUTPUT_DIR, `test-${sizeMb}mb.jpg`);
    await generateImage(targetBytes, outputPath);
    const actualBytes = statSync(outputPath).size;
    const actualMb = (actualBytes / (1024 * 1024)).toFixed(2);
    console.log(`  test-${sizeMb}mb.jpg  →  ${actualMb} MB`);
  }

  console.log('\nDone. Run `pnpm build` to generate sidecars for new images.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
