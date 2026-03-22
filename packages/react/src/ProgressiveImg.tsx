import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { loadProgressive } from '@sidecar/runtime';
import type { LoaderOptions } from '@sidecar/runtime';

const FALLBACK_PLACEHOLDER = (w: number, h: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect fill="%23e0e0e0" width="100%" height="100%"/></svg>`
  )}`;

export interface ProgressiveImgProps {
  src: string;
  alt: string;
  placeholder?: string;
  width: number;
  height: number;
  sidecarSrc?: string;
  className?: string;
  style?: React.CSSProperties;
  loaderOptions?: LoaderOptions;
  eager?: boolean;
  rootMargin?: string;
  onLoad?: () => void;
  onError?: (err: Error) => void;
}

export function ProgressiveImg({
  src,
  alt,
  placeholder,
  width,
  height,
  sidecarSrc = `${src}.sidecar`,
  className,
  style,
  loaderOptions,
  eager = false,
  rootMargin = '200px',
  onLoad,
  onError,
}: ProgressiveImgProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadIdRef = useRef(0);
  const [phase, setPhase] = useState<'placeholder' | 'pyramid' | 'tiles' | 'full'>('placeholder');
  const [isInView, setIsInView] = useState(eager);
  const [imgReady, setImgReady] = useState(false);

  const setImgRef = useCallback((el: HTMLImageElement | null) => {
    imgRef.current = el;
    setImgReady(!!el);
  }, []);

  const resolvedPlaceholder = useMemo(
    () => placeholder ?? FALLBACK_PLACEHOLDER(width, height),
    [placeholder, width, height]
  );

  useEffect(() => {
    if (!isInView || !imgReady || !imgRef.current) return;

    const loadId = ++loadIdRef.current;
    const img = imgRef.current;

    img.src = resolvedPlaceholder;
    img.width = width;
    img.height = height;

    loadProgressive(img, src, sidecarSrc, {
      ...loaderOptions,
      onPhase: (p) => {
        if (loadId !== loadIdRef.current) return;
        setPhase(p);
        loaderOptions?.onPhase?.(p);
      },
      onFrame: loaderOptions?.onFrame,
    })
      .then(() => {
        if (loadId !== loadIdRef.current) return;
        onLoad?.();
      })
      .catch((err) => {
        if (loadId !== loadIdRef.current) return;
        onError?.(err);
      });
  }, [isInView, imgReady, src, sidecarSrc, resolvedPlaceholder, width, height, loaderOptions, onLoad, onError]);

  useEffect(() => {
    if (eager) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, rootMargin]);

  const isDev =
    (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) === true;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width,
        height,
        background: '#e0e0e0',
        ...style,
      }}
    >
      <img
        ref={setImgRef}
        alt={alt}
        src={resolvedPlaceholder}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {isDev && (
        <span
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {phase}
        </span>
      )}
    </div>
  );
}
