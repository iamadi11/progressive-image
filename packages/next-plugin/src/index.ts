export interface SidecarOptions {
  include?: string;
  injectPreload?: boolean;
  minSourceBytes?: number;
}

export function withSidecar(
  nextConfig: Record<string, unknown>,
  _sidecarOpts?: SidecarOptions
): Record<string, unknown> {
  return nextConfig;
}

export { ProgressiveImg, type ProgressiveImgProps } from '@sidecar/react';
