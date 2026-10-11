import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Every screen starts with <Page title="…">. It sets the document title and, after client-side
 * navigation, moves focus to the <h1> so keyboard and screen-reader users start at the new content.
 * `documentTitle` replaces the heading in the document title where the heading alone would
 * match another page the same user can open (WCAG 2.4.2).
 */
export default function Page({ title, documentTitle, children, className = '' }) {
  const headingRef = useRef(null);
  // The router's first entry has key 'default': leave the browser's normal start position on a
  // fresh page load (also safe under StrictMode's double effects).
  const { key } = useLocation();

  useEffect(() => {
    document.title = `${documentTitle ?? title} – OpenDoor`;
    if (key !== 'default') headingRef.current?.focus();
  }, [title, documentTitle, key]);

  return (
    <div className={`page ${className}`.trim()}>
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {children}
    </div>
  );
}
