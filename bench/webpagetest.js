#!/usr/bin/env node
/**
 * WebPageTest comparison — real devices, real networks.
 * Uses WebPageTest public API. Get a free API key at webpagetest.org
 * Run: WPT_API_KEY=your_key node bench/webpagetest.js
 */

const WPT_KEY = process.env.WPT_API_KEY;
const BASE = 'https://www.webpagetest.org';

const WPT_PARAMS = {
  location: 'Dulles_MotoG4:Chrome',
  connectivity: '4G',
  runs: 5,
  timeline: 1,
  video: 1,
  filmstrip: 1,
  lighthouse: 1,
  'first.repeat': 0,
};

const PAGES = [
  { label: 'Sidecar', url: process.env.SIDECAR_URL || 'https://your-demo.example.com/test/sidecar' },
  { label: 'fetchpriority', url: process.env.NATIVE_URL || 'https://your-demo.example.com/test/native' },
  { label: 'BlurHash', url: process.env.BLURHASH_URL || 'https://your-demo.example.com/test/blurhash' },
  { label: 'LQIP', url: process.env.LQIP_URL || 'https://your-demo.example.com/test/lqip' },
];

async function submitTest(url, label) {
  const params = new URLSearchParams({
    url,
    k: WPT_KEY,
    f: 'json',
    ...WPT_PARAMS,
  });
  const res = await fetch(`${BASE}/runtest.php?${params}`);
  const data = await res.json();
  console.log(`Submitted ${label}: ${data.data.testId}`);
  return data.data.testId;
}

async function pollResult(testId) {
  while (true) {
    await new Promise((r) => setTimeout(r, 15_000));
    const res = await fetch(`${BASE}/jsonResult.php?test=${testId}`);
    const data = await res.json();
    if (data.statusCode === 200) return data.data;
    if (data.statusCode >= 400) throw new Error(`Test failed: ${data.statusText}`);
    process.stdout.write('.');
  }
}

async function main() {
  if (!WPT_KEY) {
    console.error('Set WPT_API_KEY. Get one at webpagetest.org');
    process.exit(1);
  }

  const tests = await Promise.all(
    PAGES.map((p) => submitTest(p.url, p.label).then((id) => ({ ...p, testId: id })))
  );

  console.log('\nWaiting for results...');
  const results = await Promise.all(
    tests.map(async (t) => {
      const data = await pollResult(t.testId);
      const med = data.median?.firstView || {};
      return {
        label: t.label,
        fcp: med.firstContentfulPaint ?? 'N/A',
        lcp: med.LargestContentfulPaint ?? med.largestContentfulPaint ?? 'N/A',
        cls: med.chromeUserTiming?.CumulativeLayoutShift?.toFixed(3) ?? 'N/A',
        tti: med.TimeToInteractive ?? 'N/A',
        vp1s: med.visualComplete1000 ?? 'N/A',
        vp2s: med.visualComplete2000 ?? 'N/A',
        filmstrip: `${BASE}/video/compare.php?tests=${t.testId}`,
      };
    })
  );

  console.log('\n\n=== WebPageTest Results — Real Moto G4, Real 4G ===');
  console.log('(5 runs, median)\n');

  console.log(
    'Solution'.padEnd(16) +
      'FCP'.padStart(8) +
      'LCP'.padStart(8) +
      'CLS'.padStart(8) +
      'TTI'.padStart(8) +
      'VP@1s'.padStart(8) +
      'VP@2s'.padStart(8)
  );
  console.log('─'.repeat(72));
  for (const r of results) {
    const fcp = typeof r.fcp === 'number' ? `${r.fcp}ms` : r.fcp;
    const lcp = typeof r.lcp === 'number' ? `${r.lcp}ms` : r.lcp;
    const tti = typeof r.tti === 'number' ? `${r.tti}ms` : r.tti;
    const vp1 = typeof r.vp1s === 'number' ? `${r.vp1s}%` : r.vp1s;
    const vp2 = typeof r.vp2s === 'number' ? `${r.vp2s}%` : r.vp2s;
    console.log(
      r.label.padEnd(16) +
        fcp.padStart(8) +
        lcp.padStart(8) +
        r.cls.padStart(8) +
        tti.padStart(8) +
        vp1.padStart(8) +
        vp2.padStart(8)
    );
  }

  console.log('\nFilmstrip comparisons:');
  for (const r of results) console.log(`  ${r.label}: ${r.filmstrip}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
