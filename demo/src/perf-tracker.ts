/**
 * Measures phase timings precisely and reports them.
 * Embed in ProgressiveImg for real-world analytics.
 */

export class SidecarPerfTracker {
  private marks: Record<string, number> = {};
  private t0: number;
  private imageURL: string;

  constructor(imageURL: string) {
    this.imageURL = imageURL;
    this.t0 = performance.now();
    this.mark('init');
  }

  mark(phase: string): void {
    const t = performance.now() - this.t0;
    this.marks[phase] = t;
    performance.mark(`sidecar-${this.imageURL}-${phase}`, {
      detail: { imageURL: this.imageURL, phase, elapsed: t },
    });
  }

  /** Call after Phase 3 (full image loaded) */
  report(): SidecarPerfReport {
    return {
      imageURL: this.imageURL,
      timeToFirstPixel: this.marks['placeholder'] ?? 0,
      timeToRecognisable: this.marks['pyramid-done'] ?? 0,
      timeToFull: this.marks['full'] ?? 0,
      tileStreamDuration:
        (this.marks['tiles-done'] ?? 0) - (this.marks['tiles'] ?? 0),
      connection: getConnectionInfo(),
    };
  }
}

function getConnectionInfo(): {
  effectiveType: string;
  downlink: number | null;
  rtt: number | null;
  saveData: boolean;
} {
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } })
    .connection;
  return {
    effectiveType: conn?.effectiveType ?? 'unknown',
    downlink: conn?.downlink ?? null,
    rtt: conn?.rtt ?? null,
    saveData: conn?.saveData ?? false,
  };
}

export interface SidecarPerfReport {
  imageURL: string;
  timeToFirstPixel: number;
  timeToRecognisable: number;
  timeToFull: number;
  tileStreamDuration: number;
  connection: ReturnType<typeof getConnectionInfo>;
}
