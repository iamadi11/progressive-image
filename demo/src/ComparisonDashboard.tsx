/**
 * Comparison dashboard showing all five loading strategies side-by-side.
 */

import { useState, useCallback } from 'react';
import { ComparisonCard } from './ComparisonCard';
import type { StrategyMetrics } from './ComparisonCard';

let fetchDelay = 0;
const originalFetch = window.fetch.bind(window);
window.fetch = function (
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  if (fetchDelay > 0) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        originalFetch(...args).then(resolve).catch(reject);
      }, fetchDelay);
    });
  }
  return originalFetch(...args);
};

const STRATEGIES: Array<{
  id: 'sidecar' | 'native' | 'blurhash' | 'lqip' | 'progressive-jpeg';
  label: string;
  description: string;
}> = [
  {
    id: 'sidecar',
    label: 'Sidecar (this system)',
    description: 'Level 0 inline, pyramid, optional tiles',
  },
  {
    id: 'native',
    label: 'Native fetchpriority',
    description: 'img with fetchpriority="high"',
  },
  {
    id: 'blurhash',
    label: 'BlurHash',
    description: 'Blur placeholder + swap to full',
  },
  {
    id: 'lqip',
    label: 'LQIP',
    description: 'Inline placeholder + swap to full',
  },
  {
    id: 'progressive-jpeg',
    label: 'Progressive JPEG',
    description: 'Native progressive JPEG, no JS',
  },
];

export function ComparisonDashboard() {
  const [loadTrigger, setLoadTrigger] = useState(0);
  const [throttleMs, setThrottleMs] = useState(0);
  const [allMetrics, setAllMetrics] = useState<Record<string, StrategyMetrics>>({});

  const updateThrottle = useCallback((ms: number) => {
    fetchDelay = ms;
    setThrottleMs(ms);
  }, []);

  const handleStartComparison = useCallback(() => {
    setLoadTrigger((t) => t + 1);
  }, []);

  const handleMetrics = useCallback((strategyId: string, metrics: StrategyMetrics) => {
    setAllMetrics((prev) => ({ ...prev, [strategyId]: metrics }));
  }, []);


  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1>Loading strategy comparison</h1>
      <p style={{ color: '#999', marginBottom: 24 }}>
        Compare Sidecar progressive loading against native approaches. Use the throttle to simulate
        slow 4G.
      </p>

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
            Start comparison
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Delay per request (ms):</span>
            <input
              type="range"
              min={0}
              max={1000}
              step={50}
              value={throttleMs}
              onChange={(e) => updateThrottle(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span>{throttleMs}</span>
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
            key={s.id}
            strategy={s.id}
            strategyId={s.id}
            label={s.label}
            description={s.description}
            loadTrigger={loadTrigger}
            onMetrics={handleMetrics}
          />
        ))}
      </div>

      {loadTrigger > 0 && Object.keys(allMetrics).length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Summary</h2>
          <pre
            style={{
              background: '#222',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 12,
            }}
          >
            {Object.entries(allMetrics)
              .map(([id, m]) => {
                const label = STRATEGIES.find((s) => s.id === id)?.label ?? id;
                return `${label}: first=${m.firstPixel ?? '-'}ms full=${m.full ?? '-'}ms`;
              })
              .join('\n')}
          </pre>
        </section>
      )}
    </div>
  );
}
