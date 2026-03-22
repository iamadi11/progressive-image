import { useState, useCallback, useRef } from 'react';
import { ComparisonCard } from './ComparisonCard';
import type { StrategyMetrics } from './ComparisonCard';

const STRATEGIES: Array<{
  id: 'sidecar' | 'native' | 'blurhash' | 'lqip' | 'progressive-jpeg';
  label: string;
  description: string;
}> = [
  {
    id: 'sidecar',
    label: 'Sidecar (this system)',
    description: 'Plug-and-play: placeholder, pyramid, optional tiles, full',
  },
  {
    id: 'native',
    label: 'Native fetchpriority',
    description: '<img> with fetchpriority="high"',
  },
  {
    id: 'blurhash',
    label: 'BlurHash',
    description: 'Blur placeholder shown instantly, swap on load',
  },
  {
    id: 'lqip',
    label: 'LQIP',
    description: 'Inline low-quality placeholder, swap on load',
  },
  {
    id: 'progressive-jpeg',
    label: 'Progressive JPEG',
    description: 'Native progressive JPEG, no JS',
  },
];

const IMAGE_SIZES = [
  { value: 'test.jpg', label: '60KB (default)' },
  { value: 'test-0.5mb.jpg', label: '0.5 MB' },
  { value: 'test-1mb.jpg', label: '1 MB' },
  { value: 'test-2mb.jpg', label: '2 MB' },
  { value: 'test-5mb.jpg', label: '5 MB' },
];

export function ComparisonDashboard() {
  const [loadTrigger, setLoadTrigger] = useState(0);
  const [imageSize, setImageSize] = useState('test.jpg');
  const [allMetrics, setAllMetrics] = useState<Record<string, StrategyMetrics>>({});
  const cacheBustRef = useRef(0);

  const handleStartComparison = useCallback(() => {
    cacheBustRef.current = Date.now();
    performance.clearResourceTimings?.();
    setAllMetrics({});
    setLoadTrigger((t) => t + 1);
  }, []);

  const handleMetrics = useCallback((strategyId: string, metrics: StrategyMetrics) => {
    setAllMetrics((prev) => ({ ...prev, [strategyId]: metrics }));
  }, []);

  const imageSrc = loadTrigger > 0
    ? `/images/${imageSize}?v=${cacheBustRef.current}`
    : `/images/${imageSize}`;

  const filledCount = Object.values(allMetrics).filter((m) => m.fullLoad != null).length;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1>Loading strategy comparison</h1>

      <div
        style={{
          background: '#1a2332',
          border: '1px solid #2a4a6b',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 13,
          color: '#8bb8e8',
          lineHeight: 1.5,
        }}
      >
        For a meaningful comparison, enable <strong>Chrome DevTools Network throttling</strong>
        {' '}(F12 &rarr; Network &rarr; Throttling dropdown &rarr; Slow 3G or Fast 3G).
        This throttles all network requests equally &mdash; both native &lt;img&gt; and fetch().
      </div>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleStartComparison}
            style={{
              padding: '10px 20px',
              fontSize: 16,
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {loadTrigger === 0 ? 'Start comparison' : 'Restart comparison'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Image size:</span>
            <select
              value={imageSize}
              onChange={(e) => setImageSize(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 14, cursor: 'pointer' }}
            >
              {IMAGE_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
        }}
      >
        {STRATEGIES.map((s) => (
          <ComparisonCard
            key={`${s.id}-${loadTrigger}`}
            strategy={s.id}
            label={s.label}
            description={s.description}
            loadTrigger={loadTrigger}
            onMetrics={handleMetrics}
            imageSrc={imageSrc}
          />
        ))}
      </div>

      {loadTrigger > 0 && filledCount > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Results</h2>
          <div
            style={{
              background: '#222',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 13,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Strategy</th>
                  <th style={{ padding: '8px 12px' }}>First paint</th>
                  <th style={{ padding: '8px 12px' }}>Full load</th>
                </tr>
              </thead>
              <tbody>
                {STRATEGIES.map((s) => {
                  const m = allMetrics[s.id];
                  if (!m) return null;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '8px 12px' }}>{s.label}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.firstPaint != null ? `${Math.round(m.firstPaint)}ms` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.fullLoad != null ? `${Math.round(m.fullLoad)}ms` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
