/**
 * Reusable card for the loading strategy comparison.
 * Renders one strategy with its image and metrics.
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ProgressiveImg } from '@sidecar/react';

const HERO_IMAGE = '/images/test.jpg';
const SIDECAR_SRC = '/images/test.sidecar';

export interface StrategyMetrics {
  /** Time (ms) to first pixel / placeholder visible */
  firstPixel?: number;
  /** Time (ms) to recognisable content (pyramid level or full) */
  recognisable?: number;
  /** Time (ms) to pyramid phase (sidecar parsed, level 1+ available) */
  pyramid?: number;
  /** Time (ms) to tiles phase (if used) */
  tiles?: number;
  /** Time (ms) to full-resolution image */
  full?: number;
  /** Phase progression: which phases were reached */
  phasesReached?: string[];
  /** Resource transfer sizes (bytes) - from Performance API when available */
  sidecarBytes?: number;
  imageBytes?: number;
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
  /** Override loader options for sidecar (e.g. skipTiles, slowConnectionThreshold) */
  loaderOverrides?: { skipTiles?: boolean; slowConnectionThreshold?: number };
  /** When true, main image fetch is forced to fail to test pyramid+tiles path */
  forceTilesPath?: boolean;
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

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Loads image via fetch() so the demo throttle applies. Use for native/blurhash/lqip/progressive
 * strategies to ensure fair comparison with Sidecar (which uses fetch for sidecar + image).
 */
function ImgViaFetch({
  src,
  placeholder,
  placeholderFilter,
  width,
  height,
  alt,
  style,
  fetchpriority,
  onFirstPixel,
  onFull,
  loadTrigger,
}: {
  src: string;
  placeholder?: string;
  placeholderFilter?: string;
  width: number;
  height: number;
  alt: string;
  style: React.CSSProperties;
  fetchpriority?: 'high' | 'low' | 'auto';
  onFirstPixel?: () => void;
  onFull: (imageBytes?: number) => void;
  loadTrigger: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [displaySrc, setDisplaySrc] = useState<string>(
    placeholder ?? TRANSPARENT_PIXEL
  );
  const [isPlaceholder, setIsPlaceholder] = useState(!!placeholder);

  useEffect(() => {
    if (loadTrigger <= 0) return;
    setDisplaySrc(placeholder ?? TRANSPARENT_PIXEL);
    setIsPlaceholder(!!placeholder);
  }, [loadTrigger, placeholder]);

  useEffect(() => {
    if (loadTrigger <= 0) return;
    const img = imgRef.current;
    if (!img) return;

    const loadFull = async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) {
          img.src = src;
          img.onload = () => onFull();
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        img.style.opacity = '0';
        setDisplaySrc(url);
        setIsPlaceholder(false);
        if (fetchpriority) img.fetchPriority = fetchpriority;
        await img.decode();
        img.style.opacity = '1';
        try {
          const entries = performance.getEntriesByType('resource');
          const r = entries.find(
            (e) =>
              e.name === src ||
              (typeof e.name === 'string' && e.name.includes(src.split('/').pop() ?? ''))
          );
          const size =
            r && 'transferSize' in r
              ? (r as PerformanceResourceTiming).transferSize > 0
                ? (r as PerformanceResourceTiming).transferSize
                : (r as PerformanceResourceTiming & { encodedBodySize?: number }).encodedBodySize
              : undefined;
          onFull(size);
        } catch {
          onFull();
        }
        blobUrlRef.current = null;
        URL.revokeObjectURL(url);
      } catch {
        img.src = src;
        img.onload = () => onFull();
      }
    };

    if (placeholder) {
      const reportFirstPixel = () => onFirstPixel?.();
      const onReady = () => {
        reportFirstPixel();
        loadFull();
      };
      if (img.complete) {
        onReady();
      } else {
        img.addEventListener('load', onReady, { once: true });
      }
    } else {
      onFirstPixel?.();
      loadFull();
    }

    return () => {
      const url = blobUrlRef.current;
      if (url) URL.revokeObjectURL(url);
    };
  }, [loadTrigger, src, placeholder, fetchpriority, onFirstPixel, onFull]);

  return (
    <img
      ref={imgRef}
      src={displaySrc}
      alt={alt}
      width={width}
      height={height}
      style={{
        ...style,
        transition: 'opacity 0.15s ease-out',
        filter: isPlaceholder && placeholderFilter ? placeholderFilter : undefined,
      }}
      {...(fetchpriority ? ({ fetchpriority } as React.ComponentProps<'img'>) : {})}
    />
  );
}

export function ComparisonCard({
  strategy,
  strategyId,
  label,
  description,
  onMetrics,
  loadTrigger,
  width = 280,
  height = 175,
  loaderOverrides,
  forceTilesPath = false,
}: ComparisonCardProps) {
  const t0Ref = useRef<number>(0);
  const [metrics, setMetrics] = useState<StrategyMetrics>({});
  const phasesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (loadTrigger > 0) {
      t0Ref.current = performance.now();
      setMetrics({});
      phasesRef.current = new Set();
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
      phasesRef.current.add(phase);
      const phases = Array.from(phasesRef.current);
      if (phase === 'placeholder') {
        reportMetrics({ firstPixel: elapsed, phasesReached: phases });
      } else if (phase === 'pyramid') {
        reportMetrics({
          pyramid: elapsed,
          recognisable: elapsed,
          phasesReached: phases,
        });
      } else if (phase === 'tiles') {
        reportMetrics({ tiles: elapsed, phasesReached: phases });
      } else if (phase === 'full') {
        reportMetrics({ full: elapsed, phasesReached: phases });
      }
    },
    [reportMetrics]
  );

  const handleSidecarFrame = useCallback(
    (f: { phase: string; elapsed: number }) => {
      const phases = Array.from(phasesRef.current);
      if (f.phase === 'pyramid') {
        reportMetrics({
          pyramid: f.elapsed,
          recognisable: f.elapsed,
          phasesReached: phases,
        });
      } else if (f.phase === 'tiles') {
        reportMetrics({ tiles: f.elapsed, phasesReached: phases });
      }
    },
    [reportMetrics]
  );

  const handleSidecarLoad = useCallback(() => {
    const elapsed = performance.now() - t0Ref.current;
    // Collect resource timing for bytes
    try {
      const entries = performance.getEntriesByType('resource');
      const sidecar = entries.find((e) => e.name.includes('.sidecar'));
      const img = entries.find((e) => e.name === HERO_IMAGE || e.name.includes('test.jpg'));
      const transferSize = (e: PerformanceResourceTiming) =>
        e.transferSize > 0 ? e.transferSize : (e as PerformanceResourceTiming & { encodedBodySize?: number }).encodedBodySize ?? 0;
      reportMetrics({
        full: elapsed,
        sidecarBytes: sidecar ? transferSize(sidecar as PerformanceResourceTiming) : undefined,
        imageBytes: img ? transferSize(img as PerformanceResourceTiming) : undefined,
      });
    } catch {
      reportMetrics({ full: elapsed });
    }
  }, [reportMetrics]);

  const handleSidecarError = useCallback((err: Error) => {
    console.error('[Sidecar] load failed:', err);
  }, []);

  const handleImgLoad = useCallback(() => {
    const elapsed = performance.now() - t0Ref.current;
    try {
      const entries = performance.getEntriesByType('resource');
      const img = entries.find((e) => e.name === HERO_IMAGE || e.name.includes('test.jpg'));
      const transferSize = (e: PerformanceResourceTiming) =>
        e.transferSize > 0 ? e.transferSize : (e as PerformanceResourceTiming & { encodedBodySize?: number }).encodedBodySize ?? 0;
      reportMetrics({
        full: elapsed,
        imageBytes: img ? transferSize(img as PerformanceResourceTiming) : undefined,
      });
    } catch {
      reportMetrics({ full: elapsed });
    }
  }, [reportMetrics]);

  const handlePlaceholderLoad = useCallback(() => {
    const elapsed = performance.now() - t0Ref.current;
    reportMetrics({ firstPixel: elapsed });
  }, [reportMetrics]);

  const sidecarLoaderOptions = useMemo(
    () => ({
      onPhase: handleSidecarPhase,
      onFrame: handleSidecarFrame,
      skipTiles: loaderOverrides?.skipTiles ?? false,
      slowConnectionThreshold: loaderOverrides?.slowConnectionThreshold ?? 10,
    }),
    [handleSidecarPhase, handleSidecarFrame, loaderOverrides]
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
          Placeholder: — | Pyramid: — | Full: — | Bytes: —
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
            src={forceTilesPath ? `${HERO_IMAGE}?forceTiles=1` : HERO_IMAGE}
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
          <ImgViaFetch
            src={HERO_IMAGE}
            width={width}
            height={height}
            alt={label}
            style={imgStyle}
            fetchpriority="high"
            onFull={handleImgLoad}
            loadTrigger={loadTrigger}
          />
        )}
        {strategy === 'blurhash' && (
          <ImgViaFetch
            src={HERO_IMAGE}
            placeholder={BLURHASH_PLACEHOLDER}
            placeholderFilter="blur(20px)"
            width={width}
            height={height}
            alt={label}
            style={imgStyle}
            onFirstPixel={handlePlaceholderLoad}
            onFull={handleImgLoad}
            loadTrigger={loadTrigger}
          />
        )}
        {strategy === 'lqip' && (
          <ImgViaFetch
            src={HERO_IMAGE}
            placeholder={LQIP_PLACEHOLDER}
            width={width}
            height={height}
            alt={label}
            style={imgStyle}
            onFirstPixel={handlePlaceholderLoad}
            onFull={handleImgLoad}
            loadTrigger={loadTrigger}
          />
        )}
        {strategy === 'progressive-jpeg' && (
          <ImgViaFetch
            src={HERO_IMAGE}
            width={width}
            height={height}
            alt={label}
            style={imgStyle}
            onFull={handleImgLoad}
            loadTrigger={loadTrigger}
          />
        )}
      </div>
      <div style={{ margin: '8px 0 0 0', fontSize: 11, color: '#888' }}>
        <div>
          Placeholder: {metrics.firstPixel != null ? `${Math.round(metrics.firstPixel)}ms` : '—'} |
          Pyramid: {metrics.pyramid != null ? `${Math.round(metrics.pyramid)}ms` : '—'} |
          Tiles: {metrics.tiles != null ? `${Math.round(metrics.tiles)}ms` : '—'} |
          Full: {metrics.full != null ? `${Math.round(metrics.full)}ms` : '—'}
        </div>
        {(metrics.sidecarBytes != null || metrics.imageBytes != null) && (
          <div style={{ marginTop: 2, color: '#666' }}>
            Bytes: sidecar {metrics.sidecarBytes ?? '—'} | image {metrics.imageBytes ?? '—'}
          </div>
        )}
      </div>
    </div>
  );
}
