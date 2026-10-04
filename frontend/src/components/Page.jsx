import { useEffect, useRef } from 'react';

let isFirstPage = true;

/**
 * Every screen starts with <Page title="…">. It sets the document title and, after client-side
 * navigation, moves focus to the <h1> so keyboard and screen-reader users start at the new content.
 */
export default function Page({ title, children, className = '' }) {
  const headingRef = useRef(null);

  useEffect(() => {
    document.title = `${title} – OpenDoor`;

    if (isFirstPage) {
      isFirstPage = false; // Leave the browser's normal start position on the initial load.
      return;
    }
    headingRef.current?.focus();
  }, [title]);

  return (
    <div className={`page ${className}`.trim()}>
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {children}
    </div>
  );
}
