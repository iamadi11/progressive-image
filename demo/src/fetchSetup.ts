/**
 * Global fetch interception for demo: bandwidth throttling and force-tiles-path simulation.
 * Throttles response body transfer to simulate slow network (Kbps) instead of fixed delay.
 */

let throttleKbps = 0;
let comparisonForceTiles = false;
let capabilityForceTiles = false;
const getForceTilesActive = () => comparisonForceTiles || capabilityForceTiles;

const originalFetch = window.fetch.bind(window);

function throttleResponse(res: Response, kbps: number): Response {
  if (!res.body || kbps <= 0) return res;
  const bytesPerMs = (kbps * 1024) / 8 / 1000;
  const reader = res.body.getReader();
  const throttledStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          controller.enqueue(value);
          const chunkSize = value?.length ?? 0;
          const delayMs = chunkSize / bytesPerMs;
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
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
    if (throttleKbps > 0) return throttleResponse(res, throttleKbps);
    return res;
  });
};

export function setThrottleKbps(kbps: number) {
  throttleKbps = Math.max(0, kbps);
}

export function getThrottleKbps() {
  return throttleKbps;
}

/** @deprecated Use setThrottleKbps instead. Kept for backwards compat. */
export function setFetchDelay(ms: number) {
  if (ms > 0) {
    setThrottleKbps(50);
  } else {
    setThrottleKbps(0);
  }
}

/** @deprecated Use getThrottleKbps instead. */
export function getFetchDelay() {
  return throttleKbps > 0 ? 500 : 0;
}

export function setForceTilesPathForFetch(value: boolean) {
  capabilityForceTiles = value;
}

export function setComparisonForceTilesForFetch(value: boolean) {
  comparisonForceTiles = value;
}
