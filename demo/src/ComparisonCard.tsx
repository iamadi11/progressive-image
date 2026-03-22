import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ProgressiveImg } from '@sidecar/react';

export interface StrategyMetrics {
  firstPaint?: number;
  fullLoad?: number;
}

export interface ComparisonCardProps {
  strategy: 'sidecar' | 'native' | 'blurhash' | 'lqip' | 'progressive-jpeg';
  label: string;
  description: string;
  imageSrc: string;
  loadTrigger: number;
  onMetrics?: (strategyId: string, metrics: StrategyMetrics) => void;
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
  label,
  description,
  imageSrc,
  loadTrigger,
  onMetrics,
  width = 280,
  height = 175,
}: ComparisonCardProps) {
  const t0Ref = useRef(0);
  const firstPaintRecordedRef = useRef(false);
  const [metrics, setMetrics] = useState<StrategyMetrics>({});

  useEffect(() => {
    if (loadTrigger > 0) {
      t0Ref.current = performance.now();
      firstPaintRecordedRef.current = false;
      setMetrics({});
    }
  }, [loadTrigger]);

  useEffect(() => {
    onMetrics?.(strategy, metrics);
  }, [strategy, metrics, onMetrics]);

  const recordFirstPaint = useCallback(() => {
    if (firstPaintRecordedRef.current) return;
    firstPaintRecordedRef.current = true;
    setMetrics((prev) => ({ ...prev, firstPaint: performance.now() - t0Ref.current }));
  }, []);

  const recordFullLoad = useCallback(() => {
    setMetrics((prev) => ({ ...prev, fullLoad: performance.now() - t0Ref.current }));
  }, []);

  const sidecarLoaderOptions = useMemo(
    () => ({ onPhase: (phase: string) => { if (phase === 'placeholder') recordFirstPaint(); } }),
    [recordFirstPaint],
  );

  if (loadTrigger === 0) {
    return (
      <div style={{ border: '1px solid #333', borderRadius: 8, padding: 16, background: '#222' }}>
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
          First paint: — | Full load: —
        </p>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
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
    <div style={{ border: '1px solid #333', borderRadius: 8, padding: 16, background: '#222' }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{label}</h3>
      <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#999' }}>{description}</p>
      <div style={containerStyle}>
        {strategy === 'sidecar' && (
          <ProgressiveImg
            src={imageSrc}
            alt={label}
            width={width}
            height={height}
            eager
            loaderOptions={sidecarLoaderOptions}
            onLoad={recordFullLoad}
            onError={(err) => console.error('[Sidecar]', err)}
            style={imgStyle}
          />
        )}

        {strategy === 'native' && (
          <img
            src={imageSrc}
            alt={label}
            width={width}
            height={height}
            {...({ fetchpriority: 'high' } as React.ComponentProps<'img'>)}
            style={imgStyle}
            onLoad={recordFullLoad}
          />
        )}

        {strategy === 'blurhash' && (
          <PlaceholderSwap
            imageSrc={imageSrc}
            placeholder={BLURHASH_PLACEHOLDER}
            placeholderFilter="blur(20px)"
            alt={label}
            width={width}
            height={height}
            imgStyle={imgStyle}
            onFirstPaint={recordFirstPaint}
            onFullLoad={recordFullLoad}
          />
        )}

        {strategy === 'lqip' && (
          <PlaceholderSwap
            imageSrc={imageSrc}
            placeholder={LQIP_PLACEHOLDER}
            alt={label}
            width={width}
            height={height}
            imgStyle={imgStyle}
            onFirstPaint={recordFirstPaint}
            onFullLoad={recordFullLoad}
          />
        )}

        {strategy === 'progressive-jpeg' && (
          <img
            src={imageSrc}
            alt={label}
            width={width}
            height={height}
            style={imgStyle}
            onLoad={recordFullLoad}
          />
        )}
      </div>
      <div style={{ margin: '8px 0 0 0', fontSize: 11, color: '#888' }}>
        First paint: {metrics.firstPaint != null ? `${Math.round(metrics.firstPaint)}ms` : '—'}
        {' | '}
        Full load: {metrics.fullLoad != null ? `${Math.round(metrics.fullLoad)}ms` : '—'}
      </div>
    </div>
  );
}

/**
 * Two-layer placeholder swap: shows a data-URI placeholder immediately,
 * loads the full image natively via <img>, fades it in when ready.
 * This is how BlurHash / LQIP work in production.
 */
function PlaceholderSwap({
  imageSrc,
  placeholder,
  placeholderFilter,
  alt,
  width,
  height,
  imgStyle,
  onFirstPaint,
  onFullLoad,
}: {
  imageSrc: string;
  placeholder: string;
  placeholderFilter?: string;
  alt: string;
  width: number;
  height: number;
  imgStyle: React.CSSProperties;
  onFirstPaint: () => void;
  onFullLoad: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <img
        src={placeholder}
        alt=""
        width={width}
        height={height}
        onLoad={onFirstPaint}
        style={{
          ...imgStyle,
          filter: placeholderFilter,
          opacity: loaded ? 0 : 1,
          transition: 'opacity 0.15s ease-out',
        }}
      />
      <img
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        onLoad={() => {
          setLoaded(true);
          onFullLoad();
        }}
        style={{
          ...imgStyle,
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.15s ease-out',
        }}
      />
    </>
  );
}
