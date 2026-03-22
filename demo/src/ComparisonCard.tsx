/**
 * Reusable card for the loading strategy comparison.
 * Renders one strategy with its image and metrics.
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ProgressiveImg } from '@sidecar/react';

const HERO_IMAGE = '/images/test.jpg';
const SIDECAR_SRC = '/images/test.sidecar';

export interface StrategyMetrics {
  firstPixel?: number;
  full?: number;
}

export interface ComparisonCardProps {
  strategy: 'sidecar' | 'native' | 'blurhash' | 'lqip' | 'progressive-jpeg';
  strategyId: string;
  label: string;
  description: string;
  onMetrics?: (strategyId: string, metrics: StrategyMetrics) => void;
  loadTrigger: number;
  width?: number;
  height?: number;
}

const BLURHASH_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect fill="%23999" width="100%" height="100%"/></svg>'
  );

const LQIP_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="#999" width="1" height="1"/></svg>'
  );

export function ComparisonCard({
  strategy,
  strategyId,
  label,
  description,
  onMetrics,
  loadTrigger,
  width = 280,
  height = 175,
}: ComparisonCardProps) {
  const t0Ref = useRef<number>(0);
  const [metrics, setMetrics] = useState<StrategyMetrics>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loadTrigger > 0) {
      t0Ref.current = performance.now();
      setMetrics({});
      setLoaded(false);
    }
  }, [loadTrigger]);

  const reportMetrics = useCallback((update: Partial<StrategyMetrics>) => {
    setMetrics((prev) => ({ ...prev, ...update }));
  }, []);

  // Sync metrics to parent in effect to avoid setState-in-render (onMetrics
  // updates ComparisonDashboard while ComparisonCard is rendering).
  useEffect(() => {
    onMetrics?.(strategyId, metrics);
  }, [strategyId, metrics, onMetrics]);

  const handleSidecarPhase = useCallback(
    (phase: string) => {
      const elapsed = performance.now() - t0Ref.current;
      if (phase === 'placeholder') {
        reportMetrics({ firstPixel: elapsed });
      }
    },
    [reportMetrics]
  );

  const handleSidecarLoad = useCallback(() => {
    const elapsed = performance.now() - t0Ref.current;
    reportMetrics({ full: elapsed });
  }, [reportMetrics]);

  const handleSidecarError = useCallback((err: Error) => {
    console.error('[Sidecar] load failed:', err);
  }, []);

  const handleImgLoad = useCallback(() => {
    const elapsed = performance.now() - t0Ref.current;
    setLoaded(true);
    reportMetrics({ full: elapsed });
  }, [reportMetrics]);

  const handlePlaceholderLoad = useCallback(() => {
    const elapsed = performance.now() - t0Ref.current;
    reportMetrics({ firstPixel: elapsed });
    setLoaded(true);
  }, [reportMetrics]);

  const sidecarLoaderOptions = useMemo(
    () => ({ onPhase: handleSidecarPhase, skipTiles: true }),
    [handleSidecarPhase]
  );

  if (loadTrigger === 0) {
    return (
      <div
        style={{
          border: '1px solid #333',
          borderRadius: 8,
          padding: 16,
          background: '#222',
        }}
      >
        <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{label}</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#999' }}>{description}</p>
        <div
          style={{
            aspectRatio: `${width}/${height}`,
            background: '#1a1a1a',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
            fontSize: 14,
          }}
        >
          Click &quot;Start comparison&quot; to load
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#666' }}>
          First pixel: — | Full: —
        </p>
      </div>
    );
  }

  const imageContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: `${width}/${height}`,
    overflow: 'hidden',
    background: '#1a1a1a',
    borderRadius: 4,
  };

  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  return (
    <div
      style={{
        border: '1px solid #333',
        borderRadius: 8,
        padding: 16,
        background: '#222',
      }}
    >
      <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{label}</h3>
      <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#999' }}>{description}</p>
      <div style={imageContainerStyle}>
        {strategy === 'sidecar' && (
          <ProgressiveImg
            src={HERO_IMAGE}
            sidecarSrc={SIDECAR_SRC}
            alt={label}
            width={width}
            height={height}
            eager
            loaderOptions={sidecarLoaderOptions}
            onLoad={handleSidecarLoad}
            onError={handleSidecarError}
            style={imgStyle}
          />
        )}
        {strategy === 'native' && (
          <img
            src={HERO_IMAGE}
            alt={label}
            width={width}
            height={height}
            {...({ fetchpriority: 'high' } as React.ComponentProps<'img'>)}
            style={imgStyle}
            onLoad={handleImgLoad}
          />
        )}
        {strategy === 'blurhash' && (
          <img
            src={loaded ? HERO_IMAGE : BLURHASH_PLACEHOLDER}
            alt={label}
            width={width}
            height={height}
            onLoad={loaded ? handleImgLoad : handlePlaceholderLoad}
            style={{
              ...imgStyle,
              filter: loaded ? 'none' : 'blur(20px)',
            }}
          />
        )}
        {strategy === 'lqip' && (
          <img
            src={loaded ? HERO_IMAGE : LQIP_PLACEHOLDER}
            alt={label}
            width={width}
            height={height}
            onLoad={loaded ? handleImgLoad : handlePlaceholderLoad}
            style={imgStyle}
          />
        )}
        {strategy === 'progressive-jpeg' && (
          <img
            src={HERO_IMAGE}
            alt={label}
            width={width}
            height={height}
            style={imgStyle}
            onLoad={handleImgLoad}
          />
        )}
      </div>
      <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#888' }}>
        First pixel: {metrics.firstPixel != null ? `${Math.round(metrics.firstPixel)}ms` : '—'} | Full:{' '}
        {metrics.full != null ? `${Math.round(metrics.full)}ms` : '—'}
      </p>
    </div>
  );
}
