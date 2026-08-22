import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  private user: any;
  private permissions: any;

  constructor(private router: Router) { };
  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): boolean {
    console.log('CanActivate called');
    let isLoggedIn = this.isAuthenticated();
    let permission = next.data['permission'] as string;

    if (isLoggedIn) {
      if (permission == "profile") {
        return true;
      }

      if (permission == "home") {
        return true;
      }

      if (this.permissions == null) {
        // Decode user data from localStorage
        const decodedUser = this.getDecrypted<any>('gorestofy_User');
        const isWaiter = decodedUser.isWaiter;
        const isDefaultHome = decodedUser.defaultHome == 'home';

        if (isWaiter && permission == "waiter") {
          return true;
        }

        // Initialize user data if available
        if (decodedUser) {
          this.permissions = decodedUser.permissionsJson.split(",").map((permission: any) => permission.trim());
        }
        return this.permissions.includes(permission) ? true : false;
      }
      return this.permissions.includes(permission) ? true : false;
    } else {
      if (permission == "Login" || permission == "ForgotPassword" || permission == "ResetPassword") {
        return true;
      }

      this.router.navigate(['/auth/login']);
      return false;
    }
  }

  //check user already logged in or not
  private isAuthenticated() {
    return !!localStorage.getItem("gorestofy_User");
  }

  private encrypt(data: any): string {
    return btoa(JSON.stringify(data));
  }

  private getDecrypted<T>(key: string): T | null {
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

}