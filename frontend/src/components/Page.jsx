import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import BackLink from './BackLink.jsx';

/**
 * Every screen starts with <Page title="…">. It sets the document title and, after client-side
 * navigation, moves focus to the <h1> so keyboard and screen-reader users start at the new content.
 * `documentTitle` replaces the heading in the document title where the heading alone would
 * match another page the same user can open (WCAG 2.4.2). `heading` (optional) is a styled
 * version of the same words for the <h1>; `title` stays the plain text.
 * `back` ({ to, label }) adds a back link above the heading; `subtitle` goes under the heading and
 * `actions` (e.g. Read aloud) sit to its right on wide screens.
 */
export default function Page({ title, heading, documentTitle, back, subtitle, actions, children, className = '' }) {
  const headingRef = useRef(null);
  // The router's first entry has key 'default': leave the browser's normal start position on a
  // fresh page load (also safe under StrictMode's double effects).
  const { key } = useLocation();

  useEffect(() => {
    document.title = `${documentTitle ?? title} – OpenDoor`;
    if (key !== 'default') headingRef.current?.focus();
  }, [title, documentTitle, key]);

  const headingBlock = (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        {heading ?? title}
      </h1>
      {subtitle}
    </>
  );

  return (
    <div className={`page ${className}`.trim()}>
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      {actions ? (
        <div className="page__header">
          <div className="page__heading">{headingBlock}</div>
          <div className="page__actions">{actions}</div>
        </div>
      ) : (
        headingBlock
      )}
      {children}
    </div>
  );
}
