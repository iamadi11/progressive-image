/**
 * Synthetic benchmark for the build pipeline.
 * Runs entirely in Node.js — no browser required.
 * Run: pnpm --filter @sidecar/bench synthetic ./test-images/*.jpg
 * Or:  npx tsx bench/synthetic.ts ./demo/public/images/*.jpg
 */

import { encodeSidecar } from '@sidecar/build';
import { parseSidecar } from '@sidecar/runtime';
import { readFileSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import fg from 'fast-glob';

interface ImageResult {
  filename: string;
  sourceBytes: number;
  sidecarBytes: number;
  budgetPct: number;
  level0Bytes: number;
  level1Bytes: number;
  level2Bytes: number;
  tilesExtracted: number;
  buildMs: number;
  roundTripOk: boolean;
  warnings: string[];
}

function fmtBytes(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(1)}K`;
  return `${n}B`;
}

async function runSyntheticBench(imagePaths: string[]): Promise<void> {
  console.log('\n=== Sidecar Build Benchmark ===\n');

  const results: ImageResult[] = [];

  for (const imgPath of imagePaths) {
    const outDir = join('/tmp/sidecar-bench', imgPath.replace(/\.(jpg|jpeg)$/i, '').split('/').pop() ?? 'out');
    mkdirSync(outDir, { recursive: true });

    let sourceBytes = 0;
    try {
      sourceBytes = statSync(imgPath).size;
    } catch {
      continue;
    }

    const t0 = performance.now();

    let result;
    try {
      result = await encodeSidecar(imgPath, outDir, {
        maxBytes: 12_288,
        tileExp: 8,
        levelWidths: [32, 128, 256],
        levelQualities: [45, 58, 64],
        computePriority: true,
      });
    } catch (err) {
      console.error(`Failed ${imgPath}:`, err);
      continue;
    }

    const buildMs = performance.now() - t0;

    const sidecarBuf = readFileSync(result.sidecarPath);
    let roundTripOk = false;
    let manifest: { width: number; height: number; levels: Array<{ length: number }> } | null = null;

    try {
      const parsed = parseSidecar(sidecarBuf.buffer);
      manifest = parsed.manifest;
      roundTripOk =
        manifest.width === result.width && manifest.height === result.height;
    } catch {
      /* roundTripOk stays false */
    }

    results.push({
      filename: imgPath.split('/').pop() ?? imgPath,
      sourceBytes,
      sidecarBytes: result.sidecarBytes,
      budgetPct: result.budgetUsedPct,
      level0Bytes: manifest?.levels[0]?.length ?? 0,
      level1Bytes: manifest?.levels[1]?.length ?? 0,
      level2Bytes: manifest?.levels[2]?.length ?? 0,
      tilesExtracted: result.tilesExtracted,
      buildMs: Math.round(buildMs),
      roundTripOk,
      warnings: result.warnings,
    });
  }

  // Print table
  console.log(
    'File'.padEnd(30) +
      'Source'.padStart(9) +
      'Sidecar'.padStart(9) +
      'Budget%'.padStart(9) +
      'L0'.padStart(7) +
      'L1'.padStart(7) +
      'L2'.padStart(7) +
      'Tiles'.padStart(7) +
      'Build'.padStart(8) +
      'RT'.padStart(5)
  );
  console.log('─'.repeat(98));

  for (const r of results) {
    const warn = r.warnings.length > 0 ? ' ⚠' : '';
    console.log(
      (r.filename + warn).padEnd(30) +
        fmtBytes(r.sourceBytes).padStart(9) +
        fmtBytes(r.sidecarBytes).padStart(9) +
        `${r.budgetPct.toFixed(1)}%`.padStart(9) +
        fmtBytes(r.level0Bytes).padStart(7) +
        fmtBytes(r.level1Bytes).padStart(7) +
        fmtBytes(r.level2Bytes).padStart(7) +
        r.tilesExtracted.toString().padStart(7) +
        `${r.buildMs}ms`.padStart(8) +
        (r.roundTripOk ? '✓' : '✗').padStart(5)
    );
    for (const w of r.warnings) console.log(`  └─ ⚠ ${w}`);
  }

  const overBudget = results.filter((r) => r.sidecarBytes > 12_288);
  const avgBudget =
    results.length > 0
      ? results.reduce((s, r) => s + r.budgetPct, 0) / results.length
      : 0;

  console.log('\n' + '─'.repeat(98));
  console.log(`Images processed: ${results.length}`);
  console.log(`Over budget:      ${overBudget.length}  ← must be 0`);
  console.log(`Average budget:   ${avgBudget.toFixed(1)}%`);
  console.log(
    `Total build time: ${results.reduce((s, r) => s + r.buildMs, 0)}ms`
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: tsx bench/synthetic.ts path/to/*.jpg');
    process.exit(1);
  }

  const cwd = process.cwd();
  const root = cwd.includes('/bench') ? join(cwd, '..') : cwd;
  const patterns = args.map((p) => (p.startsWith('/') ? p : join(root, p)));
  const expanded = await fg(patterns, { absolute: true, onlyFiles: true });
  const imagePaths = expanded.filter(
    (p) => p.endsWith('.jpg') || p.endsWith('.jpeg')
  );

  if (imagePaths.length === 0) {
    console.error('No JPEG files found. Usage: pnpm bench:synthetic "demo/public/images/*.jpg"');
    process.exit(1);
  }

  await runSyntheticBench(imagePaths);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
