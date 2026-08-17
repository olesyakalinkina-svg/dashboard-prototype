function hasIdleCallback(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function"
  );
}

/** Two animation frames so the filter dropdown can paint first. */
export function waitForPaint(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

/** Yield so input (filter clicks) can run before the next heavy chunk. */
export function yieldToEventLoop(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

/** Yield so input (filter clicks) can run before the next heavy chunk. */
export function yieldToMain(_timeout = 48): Promise<void> {
  return yieldToEventLoop();
}

/** Wait until the browser is actually idle. Long timeout so clicks stay responsive. */
export function yieldUntilIdle(timeout = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (hasIdleCallback()) {
      window.requestIdleCallback(() => resolve(), { timeout });
    } else {
      setTimeout(resolve, 50);
    }
  });
}
