/**
 * Global fetch interception for demo: throttle and force-tiles-path simulation.
 */

let fetchDelay = 0;
let comparisonForceTiles = false;
let capabilityForceTiles = false;
const getForceTilesActive = () => comparisonForceTiles || capabilityForceTiles;

const originalFetch = window.fetch.bind(window);

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

  if (fetchDelay > 0) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        originalFetch(input, init).then(resolve).catch(reject);
      }, fetchDelay);
    });
  }
  return originalFetch(input, init);
};

export function setFetchDelay(ms: number) {
  fetchDelay = ms;
}

export function getFetchDelay() {
  return fetchDelay;
}

export function setForceTilesPathForFetch(value: boolean) {
  capabilityForceTiles = value;
}

export function setComparisonForceTilesForFetch(value: boolean) {
  comparisonForceTiles = value;
}
