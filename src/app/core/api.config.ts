import { environment } from '../../environments/environment';

export const API_ORIGIN = environment.apiOrigin.replace(/\/+$/, '');
export const API_BASE_URL = `${API_ORIGIN}/api`;

function toPascalApiPath(path: string): string {
  const [pathname, query] = path.split('?');
  const converted = pathname
    .split('/')
    .map((segment) => {
      if (!segment) {
        return segment;
      }

      const lower = segment.toLowerCase();
      if (lower === 'api' || lower === 'hub') {
        return lower;
      }

      if (/^\d+$/.test(segment) || segment.includes('.')) {
        return segment;
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join('/');

  return query ? `${converted}?${query}` : converted;
}

export function resolveApiUrl(path: string): string {
  if (!path) {
    return path;
  }

  if (path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('assets/')) {
    return path;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      const isRemoteApi = url.origin === API_ORIGIN;

      if ((isLocalHost || isRemoteApi) && (url.pathname.startsWith('/api') || url.pathname.startsWith('/hub'))) {
        const apiPath = url.pathname.startsWith('/api')
          ? toPascalApiPath(url.pathname)
          : url.pathname;
        return `${API_ORIGIN}${apiPath}${url.search}`;
      }

      return path;
    } catch {
      return path;
    }
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (normalized.startsWith('/api')) {
    return `${API_ORIGIN}${toPascalApiPath(normalized)}`;
  }

  if (normalized.startsWith('/hub')) {
    return `${API_ORIGIN}${normalized}`;
  }

  return path;
}

export function resolveHubUrl(): string {
  return resolveApiUrl('/hub/notificationhub');
}
