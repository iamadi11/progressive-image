/**
 * Comparison dashboard showing all five loading strategies side-by-side.
 */

import './fetchSetup';
import { useState, useCallback } from 'react';
import { ComparisonCard } from './ComparisonCard';
import { SidecarCapabilityTest } from './SidecarCapabilityTest';
import { setFetchDelay, setComparisonForceTilesForFetch } from './fetchSetup';
import type { StrategyMetrics } from './ComparisonCard';

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
  const [forceTilesPath, setForceTilesPath] = useState(false);
  const [allMetrics, setAllMetrics] = useState<Record<string, StrategyMetrics>>({});

  const updateThrottle = useCallback((ms: number) => {
    setFetchDelay(ms);
    setThrottleMs(ms);
  }, []);

  const handleStartComparison = useCallback(() => {
    setComparisonForceTilesForFetch(forceTilesPath);
    performance.clearResourceTimings?.();
    setLoadTrigger((t) => t + 1);
  }, [forceTilesPath]);

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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={forceTilesPath}
              onChange={(e) => setForceTilesPath(e.target.checked)}
            />
            <span>Force pyramid+tiles path (Sidecar)</span>
          </label>
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
            forceTilesPath={s.id === 'sidecar' ? forceTilesPath : false}
          />
        ))}
      </div>

      {loadTrigger > 0 && Object.keys(allMetrics).length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Full Metrics Summary</h2>
          <div
            style={{
              background: '#222',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 12,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Strategy</th>
                  <th style={{ padding: '8px 12px' }}>Placeholder</th>
                  <th style={{ padding: '8px 12px' }}>Pyramid</th>
                  <th style={{ padding: '8px 12px' }}>Tiles</th>
                  <th style={{ padding: '8px 12px' }}>Full</th>
                  <th style={{ padding: '8px 12px' }}>Recognisable</th>
                  <th style={{ padding: '8px 12px' }}>Sidecar B</th>
                  <th style={{ padding: '8px 12px' }}>Image B</th>
                  <th style={{ padding: '8px 12px' }}>Phases</th>
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
                        {m.firstPixel != null ? `${Math.round(m.firstPixel)}ms` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.pyramid != null ? `${Math.round(m.pyramid)}ms` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.tiles != null ? `${Math.round(m.tiles)}ms` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.full != null ? `${Math.round(m.full)}ms` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.recognisable != null ? `${Math.round(m.recognisable)}ms` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.sidecarBytes != null ? `${(m.sidecarBytes / 1024).toFixed(1)}KB` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.imageBytes != null ? `${(m.imageBytes / 1024).toFixed(1)}KB` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 10 }}>
                        {m.phasesReached?.join('→') ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SidecarCapabilityTest />
    </div>
  );
}
