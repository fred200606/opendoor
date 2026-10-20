import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import BackLink from './BackLink.jsx';

/**
 * Every screen starts with <Page title="…">. It sets the document title and, after client-side
 * navigation, moves focus to the <h1> so keyboard and screen-reader users start at the new content.
 * `documentTitle` replaces the heading in the document title where the heading alone would
 * match another page the same user can open (WCAG 2.4.2). `heading` (optional) is a styled
 * version of the same words for the <h1>; `title` stays the plain text.
 * `back` ({ to, label }) adds a back link above the heading; `badge` sits on the heading's line
 * (outside the <h1>, so it is not part of its name); `subtitle` goes under the heading and
 * `actions` (e.g. Read aloud) sit to its right on wide screens. `illustration` (decoration, e.g. a
 * mascot) goes above the heading; `headingClassName` sizes an exceptional <h1> (Home).
 */
export default function Page({ title, heading, documentTitle, back, badge, subtitle, actions, illustration, headingClassName, children, className = '' }) {
  const headingRef = useRef(null);
  // The router's first entry has key 'default': leave the browser's normal start position on a
  // fresh page load (also safe under StrictMode's double effects).
  const { key, pathname } = useLocation();

  useEffect(() => {
    document.title = `${documentTitle ?? title} – OpenDoor`;
  }, [title, documentTitle]);

  // Only a new page (path) moves focus. Filters, tabs and paging change just the query string and
  // must leave focus where the user is, e.g. in the search field they are typing in.
  useEffect(() => {
    if (key !== 'default') headingRef.current?.focus();
    // `key` is read but must not re-run this: it changes with every query-string update too.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const h1 = (
    <h1 ref={headingRef} tabIndex={-1} className={headingClassName}>
      {heading ?? title}
    </h1>
  );
  const headingBlock = (
    <>
      {badge ? (
        <div className="page__title-row">
          {h1}
          {badge}
        </div>
      ) : (
        h1
      )}
      {subtitle}
    </>
  );

  return (
    <div className={`page ${className}`.trim()}>
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      {illustration}
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
