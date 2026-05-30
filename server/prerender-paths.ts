import path from 'node:path';

/** Strip query/hash, normalise trailing slash. '/tours/abc/?x=1' -> '/tours/abc' */
function cleanRoute(route: string): string {
  let r = route.split('?')[0].split('#')[0];
  if (r.length > 1 && r.endsWith('/')) r = r.replace(/\/+$/, '');
  return r;
}

/** Map a URL path to the relative snapshot file. '/' -> 'index.html', '/tours/abc' -> 'tours/abc/index.html'. */
export function routeToRelFile(route: string): string {
  const r = cleanRoute(route);
  if (r === '' || r === '/') return 'index.html';
  return path.join(r.replace(/^\/+/, ''), 'index.html');
}

/** Absolute path to the snapshot file under distPath for a given route. */
export function outputPathFor(route: string, distPath: string): string {
  return path.join(distPath, routeToRelFile(route));
}
