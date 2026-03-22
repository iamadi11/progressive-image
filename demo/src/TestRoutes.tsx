/**
 * Lighthouse comparison test routes.
 * Each route renders a single hero image with a different loading strategy.
 */

import React, { useState } from 'react';
import { ProgressiveImg } from '@sidecar/react';

const HERO_IMAGE = '/images/test.jpg';

function TestLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1>{title}</h1>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/10',
          overflow: 'hidden',
          background: '#1a1a1a',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function TestSidecar() {
  return (
    <TestLayout title="Sidecar (this system)">
      <ProgressiveImg
        src={HERO_IMAGE}
        alt="Hero"
        sidecarSrc="/images/test.sidecar"
        width={800}
        height={500}
        eager
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </TestLayout>
  );
}

export function TestNative() {
  return (
    <TestLayout title="Native fetchpriority=high">
      <img
        src={HERO_IMAGE}
        alt="Hero"
        width={800}
        height={500}
        fetchPriority="high"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </TestLayout>
  );
}

export function TestBlurHash() {
  const [loaded, setLoaded] = useState(false);
  const blurhashPlaceholder =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect fill="%23999" width="100%" height="100%"/></svg>'
    );
  return (
    <TestLayout title="BlurHash (blur placeholder + swap)">
      <img
        src={loaded ? HERO_IMAGE : blurhashPlaceholder}
        alt="Hero"
        width={800}
        height={500}
        onLoad={() => setLoaded(true)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: loaded ? 'none' : 'blur(20px)',
        }}
      />
    </TestLayout>
  );
}


export function TestLQIP() {
  const [loaded, setLoaded] = useState(false);
  const lqip = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="#999" width="1" height="1"/></svg>');
  return (
    <TestLayout title="LQIP (inline placeholder + swap)">
      <img
        src={loaded ? HERO_IMAGE : lqip}
        alt="Hero"
        width={800}
        height={500}
        onLoad={() => setLoaded(true)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </TestLayout>
  );
}

export function TestProgressiveJpeg() {
  return (
    <TestLayout title="Progressive JPEG (native, no JS)">
      <img
        src={HERO_IMAGE}
        alt="Hero"
        width={800}
        height={500}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </TestLayout>
  );
}

export function getTestComponent(pathname: string): React.ComponentType | null {
  switch (pathname) {
    case '/test/sidecar':
      return TestSidecar;
    case '/test/native':
      return TestNative;
    case '/test/blurhash':
      return TestBlurHash;
    case '/test/lqip':
      return TestLQIP;
    case '/test/progressive-jpeg':
      return TestProgressiveJpeg;
    default:
      return null;
  }
}
