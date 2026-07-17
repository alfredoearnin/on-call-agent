/**
 * Minimal fetch wrapper with timeout, retry, and exponential backoff + jitter.
 * Retries only transient failures (429 + 5xx), per Earnin error-handling
 * standards. Never logs secrets — only method, URL path, and status.
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    public body: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(base: string, query?: RequestOptions["query"]): string {
  if (!query) return base;
  const url = new URL(base);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function httpRequest<T>(
  url: string,
  opts: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 20_000,
    retries = 3,
    query,
  } = opts;

  const fullUrl = buildUrl(url, query);
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(fullUrl, {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const backoff = Math.min(1000 * 2 ** attempt, 8000);
          const jitter = Math.random() * 250;
          await sleep(backoff + jitter);
          attempt++;
          continue;
        }
      }

      const text = await res.text();
      if (!res.ok) throw new HttpError(res.status, fullUrl, text.slice(0, 500));
      return (text ? JSON.parse(text) : {}) as T;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // Retry on network/abort errors too.
      if (attempt < retries && !(err instanceof HttpError)) {
        const backoff = Math.min(1000 * 2 ** attempt, 8000);
        await sleep(backoff + Math.random() * 250);
        attempt++;
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("request failed");
}
