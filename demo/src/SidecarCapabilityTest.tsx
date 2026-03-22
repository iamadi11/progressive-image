/**
 * Dedicated section to test full Sidecar capability:
 * - Lazy loading (rootMargin, eager=false)
 * - Phase progression (placeholder → pyramid → tiles → full)
 * - Tiles path (when full fetch fails + slow connection)
 * - Error handling
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ProgressiveImg } from '@sidecar/react';
import { setForceTilesPathForFetch } from './fetchSetup';

export function SidecarCapabilityTest({
  imageSrc = '/images/test.jpg',
  sidecarSrc = '/images/test.sidecar',
}: {
  imageSrc?: string;
  sidecarSrc?: string;
} = {}) {
  const [phase, setPhase] = useState<string>('—');
  const [phases, setPhases] = useState<string[]>([]);
  const [tilesPathEnabled, setTilesPathEnabled] = useState(false);
  const [lazyLoaded, setLazyLoaded] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const t0Ref = useRef(0);

  useEffect(() => {
    setForceTilesPathForFetch(tilesPathEnabled);
    return () => {
      setForceTilesPathForFetch(false);
    };
  }, [tilesPathEnabled]);

  const hasTriggeredRef = useRef(false);
  const handlePhase = useCallback((p: string) => {
    setPhase(p);
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      setLazyLoaded(true); // Load only starts when in view (eager=false)
      t0Ref.current = performance.now();
    }
    setPhases((prev) => {
      if (prev[prev.length - 1] === p) return prev;
      return [...prev, p];
    });
  }, []);

  const handleFrame = useCallback((f: { phase: string; elapsed: number }) => {
    setMetrics((prev) => ({ ...prev, [f.phase]: f.elapsed }));
  }, []);

  const handleLoad = useCallback(() => {
    setMetrics((prev) => ({ ...prev, full: performance.now() - t0Ref.current }));
  }, []);

  const handleError = useCallback((err: Error) => {
    console.error('[Sidecar capability test]', err);
    setPhase(`error: ${err.message}`);
  }, []);

  const resetTest = useCallback(() => {
    hasTriggeredRef.current = false;
    setPhase('—');
    setPhases([]);
    setMetrics({});
    setLazyLoaded(false);
  }, []);

  const loaderOptions = useMemo(
    () => ({
      onPhase: handlePhase,
      onFrame: handleFrame,
      skipTiles: false,
      slowConnectionThreshold: 10,
    }),
    [handlePhase, handleFrame]
  );

  return (
    <section
      style={{
        marginTop: 48,
        padding: 24,
        background: '#1e1e1e',
        borderRadius: 12,
        border: '1px solid #333',
      }}
    >
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Sidecar Full Capability Test</h2>
      <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>
        Test all loading phases, lazy loading, and the pyramid+tiles fallback path.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={tilesPathEnabled}
            onChange={(e) => setTilesPathEnabled(e.target.checked)}
          />
          <span>Force pyramid+tiles path</span>
        </label>
        <span style={{ fontSize: 12, color: '#666' }}>
          (Makes initial full fetch fail so loader uses pyramid → tiles → full)
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Lazy-loaded image (scroll to reveal)</h3>
          <div
            style={{
              height: 400,
              overflow: 'auto',
              background: '#111',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div style={{ height: 200, display: 'flex', alignItems: 'center', color: '#555' }}>
              Scroll down to trigger load
            </div>
            <div
              style={{
                minHeight: 280,
                position: 'relative',
                background: '#1a1a1a',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <ProgressiveImg
                src={tilesPathEnabled ? `${imageSrc}?forceTiles=1` : imageSrc}
                sidecarSrc={sidecarSrc}
                alt="Capability test"
                width={400}
                height={250}
                eager={false}
                rootMargin="100px"
                loaderOptions={loaderOptions}
                onLoad={handleLoad}
                onError={handleError}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#222',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #333',
          }}
        >
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Live metrics</h3>
          <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
            <p>
              <strong>Current phase:</strong> {phase}
            </p>
            <p>
              <strong>Phases reached:</strong> {phases.length ? phases.join(' → ') : '—'}
            </p>
            <p>
              <strong>Lazy triggered:</strong> {lazyLoaded ? 'Yes' : 'No'}
            </p>
            <div style={{ marginTop: 12 }}>
              <strong>Timings (ms):</strong>
              <pre style={{ margin: '4px 0 0 0', fontSize: 11, color: '#aaa' }}>
                {Object.entries(metrics)
                  .map(([k, v]) => `  ${k}: ${Math.round(v)}`)
                  .join('\n') || '  (none yet)'}
              </pre>
            </div>
          </div>
          <button
            onClick={resetTest}
            style={{
              marginTop: 12,
              padding: '6px 12px',
              fontSize: 12,
              background: '#444',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Reset test
          </button>
        </div>
      </div>
    </section>
  );
}
