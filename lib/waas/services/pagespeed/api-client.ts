// lib/waas/services/pagespeed/api-client.ts
import {
  PAGESPEED_TIMEOUT_MS,
  PAGESPEED_503_RETRY_DELAY_MS,
  PageSpeedFetchResult,
} from "./types";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const e = err as { name?: string; message?: string };
  return (
    e.name === "TimeoutError" ||
    e.name === "AbortError" ||
    e.message?.toLowerCase().includes("timed out") === true ||
    e.message?.toLowerCase().includes("timeout") === true
  );
}

// ----------------------------------------------------------------------------
// Fetch PageSpeed data for a single strategy (mobile or desktop)
// ----------------------------------------------------------------------------
export async function fetchPageSpeed(
  url: string,
  strategy: "mobile" | "desktop",
): Promise<PageSpeedFetchResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;

  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.append("category", "performance");
  endpoint.searchParams.append("category", "seo");
  endpoint.searchParams.append("category", "accessibility");
  endpoint.searchParams.append("category", "best-practices");
  if (apiKey) endpoint.searchParams.set("key", apiKey);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(endpoint.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(PAGESPEED_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 503 && attempt === 1) {
          console.warn(
            `[PageSpeed] ${strategy} returned 503. Retrying once after ${PAGESPEED_503_RETRY_DELAY_MS}ms.`,
          );
          await sleep(PAGESPEED_503_RETRY_DELAY_MS);
          continue;
        }

        console.error(
          `[PageSpeed] ${strategy} error ${response.status}:`,
          errorText.slice(0, 200),
        );
        return {
          data: null,
          error: {
            reason: response.status === 503 ? "http-503" : "http-error",
            status: response.status,
            message: errorText.slice(0, 200) || `HTTP ${response.status}`,
          },
        };
      }

      return {
        data: await response.json(),
        error: null,
      };
    } catch (err) {
      if (isTimeoutError(err)) {
        console.error(
          `[PageSpeed] ${strategy} timeout after ${PAGESPEED_TIMEOUT_MS}ms.`,
        );
        return {
          data: null,
          error: {
            reason: "timeout",
            message: `Timeout after ${PAGESPEED_TIMEOUT_MS}ms`,
          },
        };
      }

      console.error(`[PageSpeed] ${strategy} fetch error:`, err);
      return {
        data: null,
        error: {
          reason: "network-error",
          message: String(err),
        },
      };
    }
  }

  return {
    data: null,
    error: {
      reason: "http-503",
      status: 503,
      message: "PageSpeed service unavailable after retry.",
    },
  };
}
