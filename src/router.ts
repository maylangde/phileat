import { signal } from '@preact/signals';

export interface Route {
  path: string;
  query: URLSearchParams;
}

const parse = (): Route => {
  const h = location.hash.slice(1) || '/';
  const [p, q] = h.split('?');
  return { path: p || '/', query: new URLSearchParams(q ?? '') };
};

export const route = signal<Route>(parse());

window.addEventListener('hashchange', () => {
  route.value = parse();
  window.scrollTo(0, 0);
});

export function go(to: string, replace = false) {
  if (replace) {
    history.replaceState(null, '', '#' + to);
    route.value = parse();
  } else {
    location.hash = to;
  }
}

export function back(fallback = '/') {
  if (history.length > 1) history.back();
  else go(fallback, true);
}
