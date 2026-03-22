/**
 * Global fetch interception for demo: Chrome DevTools–style network throttling.
 * Simulates latency (RTT) + throughput (Kbps) like Chrome's Network panel.
 */

let throttleLatencyMs = 0;
let throttleKbps = 0;
let comparisonForceTiles = false;
let capabilityForceTiles = false;
const getForceTilesActive = () => comparisonForceTiles || capabilityForceTiles;

const originalFetch = window.fetch.bind(window);

/** Chrome DevTools–style presets (approximate values) */
export const THROTTLE_PRESETS = {
  off: { latencyMs: 0, kbps: 0 },
  fast3g: { latencyMs: 562.5, kbps: 1600 },
  slow3g: { latencyMs: 2000, kbps: 400 },
} as const;

function throttleResponse(res: Response, latencyMs: number, kbps: number): Response {
  if (!res.body) return res;
  const applyLatency = latencyMs > 0;
  const applyThroughput = kbps > 0;
  if (!applyLatency && !applyThroughput) return res;

  const bytesPerMs = applyThroughput ? (kbps * 1024) / 8 / 1000 : Infinity;
  const reader = res.body.getReader();
  const throttledStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (applyLatency) await new Promise((r) => setTimeout(r, latencyMs));
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          controller.enqueue(value);
          if (applyThroughput) {
            const chunkSize = value?.length ?? 0;
            const delayMs = chunkSize / bytesPerMs;
            if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new Response(throttledStream, {
    headers: res.headers,
    status: res.status,
    statusText: res.statusText,
  });
}

window.fetch = function (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers = init?.headers;
  const hasRange =
    headers &&
    (typeof headers === 'object' && !(headers instanceof Headers)
      ? (headers as Record<string, string>)['Range']
      : headers instanceof Headers
        ? headers.get('Range')
        : false);

  if (getForceTilesActive() && url.includes('forceTiles=1')) {
    if (!hasRange) {
      return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
    }
    const realUrl = url.replace(/\?forceTiles=1$/, '');
    return originalFetch(realUrl, init);
  }

  return originalFetch(input, init).then((res) => {
    if (throttleLatencyMs > 0 || throttleKbps > 0) {
      return throttleResponse(res, throttleLatencyMs, throttleKbps);
    }
    return res;
  });
};

export function setThrottle(latencyMs: number, kbps: number) {
  throttleLatencyMs = Math.max(0, latencyMs);
  throttleKbps = Math.max(0, kbps);
}

export function setThrottlePreset(
  preset: keyof typeof THROTTLE_PRESETS
) {
  const { latencyMs, kbps } = THROTTLE_PRESETS[preset];
  setThrottle(latencyMs, kbps);
}

export function getThrottle() {
  return { latencyMs: throttleLatencyMs, kbps: throttleKbps };
}

export function setThrottleKbps(kbps: number) {
  throttleKbps = Math.max(0, kbps);
}

export function getThrottleKbps() {
  return throttleKbps;
}

export function setForceTilesPathForFetch(value: boolean) {
  capabilityForceTiles = value;
}

export function setComparisonForceTilesForFetch(value: boolean) {
  comparisonForceTiles = value;
}
