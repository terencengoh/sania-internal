import { useEffect, useState } from 'react';

/** Tiny hash router: #/path/segments?query — works on GitHub Pages with no server config. */
export function useRoute() {
  const parse = () => {
    const h = window.location.hash.replace(/^#/, '') || '/';
    const [path, q = ''] = h.split('?');
    return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(q) };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => { window.location.hash = path; };
