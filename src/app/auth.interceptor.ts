import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  
  // Get JWT token using the same logic as the original interceptor
  const authToken = getJwtToken();
  
  // Clone the request and add authorization header if token exists
  if (authToken) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`
      }
    });
  }
  
  return next(req).pipe(
    catchError(error => {
      if (error.status === 401) {
        // Handle unauthorized access - redirect to login
        localStorage.clear();
        window.location.href = '/app/auth/login';
      }
      return throwError(() => error);
    })
  );
};

function getJwtToken(): string {
  // Decode user data from localStorage
  const decodedUser = getDecrypted<any>('gorestofy_User');

  // Initialize user data if available
  if (decodedUser) {
    return decodedUser.token;
  }
  else {
    return "";
  }
}

function getDecrypted<T>(key: string): T | null {
  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    // Decode Base64 and UTF-8
    const json = decodeURIComponent(atob(value));
    return JSON.parse(json) as T;
  } catch {
    try {
      // Fallback: plain JSON
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
}