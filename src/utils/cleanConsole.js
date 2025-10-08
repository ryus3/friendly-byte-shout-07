// Clean all console.log/info/warn in production
// Only keep console.error for critical errors

const isDev = import.meta.env.DEV;

if (!isDev) {
  // Disable console.log, console.info, console.warn in production
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  
  // Keep console.error for critical errors
  // console.error remains active
}

export default {};
