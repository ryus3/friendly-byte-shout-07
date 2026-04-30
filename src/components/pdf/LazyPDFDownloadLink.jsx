import React, { Suspense, lazy } from 'react';

/**
 * ⚡ Lazy wrapper for @react-pdf/renderer's PDFDownloadLink.
 * The heavy library (~500KB) is only loaded when this component renders,
 * not when the parent page imports it. Same API as PDFDownloadLink.
 *
 * Usage:
 *   <LazyPDFDownloadLink document={<MyPDF .../>} fileName="...">
 *     {({ loading }) => <Button>...</Button>}
 *   </LazyPDFDownloadLink>
 */
const PDFDownloadLinkLazy = lazy(async () => {
  const mod = await import('@react-pdf/renderer');
  return { default: mod.PDFDownloadLink };
});

const PDFViewerLazy = lazy(async () => {
  const mod = await import('@react-pdf/renderer');
  return { default: mod.PDFViewer };
});

export const LazyPDFDownloadLink = ({ children, fallback = null, ...props }) => (
  <Suspense fallback={fallback ?? (typeof children === 'function' ? children({ loading: true }) : null)}>
    <PDFDownloadLinkLazy {...props}>{children}</PDFDownloadLinkLazy>
  </Suspense>
);

export const LazyPDFViewer = ({ children, fallback = null, ...props }) => (
  <Suspense fallback={fallback}>
    <PDFViewerLazy {...props}>{children}</PDFViewerLazy>
  </Suspense>
);

export default LazyPDFDownloadLink;
