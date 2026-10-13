import { useEffect, useState } from 'react';

/** The page's layout width in px (without the scrollbar), kept up to date on resize. */
export function useViewportWidth() {
  const read = () => (typeof document !== 'undefined' ? document.documentElement.clientWidth : 0);
  const [width, setWidth] = useState(read);

  useEffect(() => {
    const update = () => setWidth(document.documentElement.clientWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return width;
}
