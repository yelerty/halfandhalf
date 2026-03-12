/**
 * Creates a debounced callback that delays execution until after `delay` milliseconds
 * have elapsed since the last time it was called.
 */
export const createDebouncedCallback = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number
): ((...args: T) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(...args);
      timeoutId = null;
    }, delay);
  };
};

/**
 * Creates a throttled callback that executes at most once every `interval` milliseconds
 */
export const createThrottledCallback = <T extends any[]>(
  callback: (...args: T) => void,
  interval: number
): ((...args: T) => void) => {
  let lastExecutionTime = 0;

  return (...args: T) => {
    const now = Date.now();
    if (now - lastExecutionTime >= interval) {
      callback(...args);
      lastExecutionTime = now;
    }
  };
};
