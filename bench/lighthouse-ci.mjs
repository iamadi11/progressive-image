#!/usr/bin/env node
/**
 * Lighthouse CI — compares Sidecar vs native vs BlurHash vs LQIP vs Progressive JPEG.
 * Run: node bench/lighthouse-ci.mjs (with demo running at localhost:5173)
 * Requires: npm install lighthouse chrome-launcher
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const DEMO_URL = process.env.DEMO_URL || 'http://localhost:5173';

const SCENARIOS = [
  { name: 'Sidecar (this system)', url: `${DEMO_URL}/test/sidecar` },
  { name: 'Native fetchpriority', url: `${DEMO_URL}/test/native` },
  { name: 'BlurHash', url: `${DEMO_URL}/test/blurhash` },
  { name: 'LQIP', url: `${DEMO_URL}/test/lqip` },
  { name: 'Progressive JPEG', url: `${DEMO_URL}/test/progressive-jpeg` },
];

const LH_CONFIG = {
  logLevel: 'error',
  onlyCategories: ['performance'],
  formFactor: 'mobile',
  screenEmulation: {
    mobile: true,
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    disabled: false,
  },
  throttling: {
    rttMs: 150,
    throughputKbps: 1638.4, // 1.6Mbps Slow 4G
    cpuSlowdownMultiplier: 4,
  },
};

async function runScenario(url, name) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const runs = [];

  for (let i = 0; i < 3; i++) {
    const result = await lighthouse(url, { port: chrome.port, ...LH_CONFIG });
    const audits = result?.lhr?.audits || {};
    const metricsAudit = audits.metrics;
    let m;
    if (metricsAudit?.details?.items?.[0]) {
      m = metricsAudit.details.items[0];
    } else {
      m = {
        firstContentfulPaint: audits['first-contentful-paint']?.numericValue ?? 0,
        largestContentfulPaint: audits['largest-contentful-paint']?.numericValue ?? 0,
        totalBlockingTime: audits['total-blocking-time']?.numericValue ?? 0,
        cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue ?? 0,
        interactive: audits['interactive']?.numericValue ?? 0,
        speedIndex: audits['speed-index']?.numericValue ?? 0,
      };
    }
    runs.push({
      fcp: m.firstContentfulPaint ?? m.fcp ?? 0,
      lcp: m.largestContentfulPaint ?? m.lcp ?? 0,
      tbt: m.totalBlockingTime ?? m.tbt ?? 0,
      cls: m.cumulativeLayoutShift ?? m.cls ?? 0,
      tti: m.interactive ?? m.tti ?? 0,
      si: m.speedIndex ?? m.si ?? 0,
    });
  }

  await chrome.kill();

  const median = (arr) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  return {
    name,
    fcp: Math.round(median(runs.map((r) => r.fcp))),
    lcp: Math.round(median(runs.map((r) => r.lcp))),
    tbt: Math.round(median(runs.map((r) => r.tbt))),
    cls: median(runs.map((r) => r.cls)).toFixed(3),
    tti: Math.round(median(runs.map((r) => r.tti))),
    si: Math.round(median(runs.map((r) => r.si))),
  };
}

async function main() {
  console.log('\n=== Lighthouse CI — Slow 4G (1.6Mbps, 150ms RTT) ===');
  console.log('3 runs per scenario, median reported\n');

  const results = [];
  for (const s of SCENARIOS) {
    process.stdout.write(`Running: ${s.name}...`);
    try {
      const r = await runScenario(s.url, s.name);
      results.push(r);
      console.log(` FCP=${r.fcp}ms LCP=${r.lcp}ms`);
    } catch (err) {
      console.log(` Failed: ${err.message}`);
      results.push({
        name: s.name,
        fcp: 0,
        lcp: 0,
        tbt: 0,
        cls: 'N/A',
        tti: 0,
        si: 0,
      });
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(
    'Solution'.padEnd(25) +
      'FCP'.padStart(8) +
      'LCP'.padStart(8) +
      'TBT'.padStart(8) +
      'CLS'.padStart(8) +
      'SI'.padStart(8)
  );
  console.log('─'.repeat(80));

  const baseline = results.find((r) => r.name.includes('fetchpriority'));
  for (const r of results) {
    console.log(
      r.name.padEnd(25) +
        `${r.fcp}ms`.padStart(8) +
        `${r.lcp}ms`.padStart(8) +
        `${r.tbt}ms`.padStart(8) +
        r.cls.padStart(8) +
        `${r.si}ms`.padStart(8)
    );
  }
  console.log('─'.repeat(80));

  const sidecar = results.find((r) => r.name.includes('Sidecar'));
  if (sidecar && baseline) {
    const others = results.filter((r) => r !== sidecar && r.lcp > 0);
    if (others.length > 0) {
      const bestLcp = Math.min(...others.map((r) => r.lcp));
      const bestFcp = Math.min(...others.map((r) => r.fcp));
      console.log(
        `\nSidecar FCP vs best alternative: ${bestFcp - sidecar.fcp}ms faster`
      );
      console.log(
        `Sidecar LCP vs best alternative: ${bestLcp - sidecar.lcp}ms faster`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
