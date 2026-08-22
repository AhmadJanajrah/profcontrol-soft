import { HttpInterceptorFn } from '@angular/common/http';
import { resolveApiUrl } from './core/api.config';

export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  const resolvedUrl = resolveApiUrl(req.url);

  if (resolvedUrl !== req.url) {
    return next(req.clone({ url: resolvedUrl }));
  }

  return next(req);
};
