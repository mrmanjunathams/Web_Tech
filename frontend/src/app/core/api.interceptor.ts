import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

/** Sends API calls (paths starting with "/") to the configured backend, with the session cookie. */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/')) return next(req);
  return next(req.clone({ url: environment.apiBaseUrl + req.url, withCredentials: true }));
};
