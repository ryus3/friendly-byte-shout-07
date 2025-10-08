// Development Logger - Only logs in development mode
const isDev = import.meta.env.DEV;

export const devLog = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  error: (...args) => {
    // Always log errors even in production
    console.error(...args);
  }
};

// Export as default for convenience
export default devLog;
