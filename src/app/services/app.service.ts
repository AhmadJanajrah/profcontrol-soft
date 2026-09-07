import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { resolveApiUrl, resolveHubUrl } from '../core/api.config';
import arTranslations from '../../../public/assets/i18n/ar.json';

// External library declarations
declare var $: any;
declare let Cleave: any;

/**
 * =========================================================
 * GoRestofy POS System - Core Application Service (SIMPLIFIED)
 * =========================================================
 * Production-ready service with simplified layout management
 * Layout modes are configured from backend (sidebar-fixed, collapsible, drawer)
 * 
 * Author: GoRestofy Team
 * Version: 2.1.0 (Simplified)
 * Last Updated: 2025-10-04 15:30:00 UTC
 * =========================================================
 */
@Injectable({
  providedIn: 'root'
})
export class AppService {
  // ==================== Private Properties ====================

  // User & Authentication
  private user: Record<string, any> | null = null;
  private userLocations: any[] = [];
  private userSelectedLocationId = 0;
  private userPermissions: string[] = [];

  // Application Configuration
  private appConfig: Record<string, any> = {};

  // Localization & Formatting
  private languages: any[] = [];
  private regionName = '';
  private stringResources: Record<string, string> = {};
  private timeZone = '';
  private currencyName = '';
  private currencySymbol = '';
  private decimalSeparator = '.';
  private groupSeparator = ',';

  // Layout Management (Simplified - from backend config only)
  private baseLayoutMode: string = 'sidebar-fixed';

  // ==================== Constructor ====================

  constructor(
    private http: HttpClient,
    private router: Router,
    private location: Location
  ) {
    this.initializeApp();
  }

  // ==================== Initialization Methods ====================

  private initializeApp(): void {
    this.loadUser();
    this.loadAppConfig();
    this.loadLocalizationData();
  }

  private loadUser(): void {
    const userData = this.getDecrypted<any>('gorestofy_User');
    const selectedLocationId = this.getDecrypted<number>('gorestofy_UserSelectedLocationId');

    if (!userData) return;

    this.userLocations = userData.userLocations || [];
    this.userSelectedLocationId = selectedLocationId || 0;
    this.userPermissions = userData.permissionsJson?.split(',').map((p: string) => p.trim()) || [];

    this.user = {
      fullName: userData.fullName,
      userName: userData.userName,
      email: userData.email,
      defaultHome: userData.defaultHome,
      isWaiter: userData.isWaiter,
      profileImageUrl: userData.profileImageUrl,
      accessAllLocations: userData.accessAllLocations,
      token: userData.token,
    };
  }

  private loadAppConfig(): void {
    const cachedConfig = this.getDecrypted<any>('gorestofy_AppConfig');

    if (cachedConfig) {
      this.setAppConfig(cachedConfig);
    } else {
      this.http.get<any>('/api/system/appconfig').subscribe({
        next: (config) => {
          this.setEncrypted('gorestofy_AppConfig', config);
          this.setAppConfig(config);
        },
        error: (err) => console.error('Failed to load app configuration:', err),
      });
    }
  }

  private setAppConfig(config: any): void {
    this.appConfig = config;
    this.baseLayoutMode = config['themeLayout'] || 'sidebar-fixed';
    this.applySystemTheme();
  }

  public applySystemTheme(): void {
    if (!this.appConfig) return;

    const body = document.body;
    body.setAttribute('data-theme-layout', this.baseLayoutMode);
    body.setAttribute('data-theme', this.appConfig['theme'] || 'theme1');
    body.setAttribute('data-theme-mode', this.appConfig['themeMode'] || 'general');
    body.setAttribute('data-sidebar', this.appConfig['menuBackground'] || 'light');
    body.setAttribute('data-topbar', this.appConfig['headerBackground'] || 'light');

    this.applyNightMode();
  }

  private loadLocalizationData(): void {
    const cachedData = this.getDecrypted<any>('gorestofy_LocalizationData');

    if (cachedData) {
      this.applyLocalizationData(cachedData);
    } else {
      this.loadLocalizationFromAPI();
    }
  }

  private loadLocalizationFromAPI(): void {
    if (!this.getCookie('gorestofy_Language')) {
      this.setCookie('gorestofy_Language', this.appConfig['language'] || 'en-US', 30);
    }

    const language = this.getCookie('gorestofy_Language') ?? this.appConfig['language'] ?? 'en-US';

    this.http.get<any>(`/api/system/localizationdata/${language}`).subscribe({
      next: (data) => {
        this.enhanceLocalizationData(data);
        this.setEncrypted('gorestofy_LocalizationData', data);
        this.applyLocalizationData(data);
      },
      error: (err) => console.error('Failed to load localization data:', err),
    });
  }

  private enhanceLocalizationData(data: any): void {
    data.currencySymbol = this.getCurrencySymbol();
    this.changeDirection(data.isRtl ? 'rtl' : 'ltr');
  }

  private applyLocalizationData(data: any): void {
    this.stringResources = data.stringResources || {};
    this.regionName = data.regionName || '';
    this.timeZone = data.timeZone || '';
    this.currencyName = data.currencyName || '';
    this.languages = data.languages || [];
    this.decimalSeparator = data.decimalSeparator || '.';
    this.groupSeparator = data.groupSeparator || ',';
    this.currencySymbol = data.currencySymbol || '$';
    this.applyLocalTranslationFallbacks(
      data.languageCode || this.getCookie('gorestofy_Language') || this.appConfig['language'] || 'en-US'
    );
    this.changeDirection(data.isRtl ? 'rtl' : 'ltr');
  }

  private getLocalFallbackTranslations(languageCode: string): Record<string, string> {
    const lang = (languageCode || '').toLowerCase();
    if (lang.startsWith('ar')) {
      return arTranslations as Record<string, string>;
    }

    return {};
  }

  private applyLocalTranslationFallbacks(languageCode: string): void {
    const fallbacks = this.getLocalFallbackTranslations(languageCode);

    for (const [key, value] of Object.entries(fallbacks)) {
      if (!this.stringResources[key]) {
        this.stringResources[key] = value;
      }
    }
  }

  // ==================== Simplified Layout Management ====================

  /**
   * Get base layout mode from backend configuration
   */
  public getBaseLayoutMode(): string {
    return this.baseLayoutMode;
  }

  /**
   * Get layout display name
   */
  public getLayoutDisplayName(mode: string): string {
    const names: Record<string, string> = {
      'sidebar-fixed': 'Fixed Sidebar',
      'drawer': 'Drawer Mode',
      'collapsible': 'Collapsible Sidebar'
    };
    return names[mode] || mode;
  }

  /**
   * Check if mobile device
   */
  public isMobileDevice(): boolean {
    return window.innerWidth <= 768;
  }

  /**
   * Check if tablet device
   */
  public isTabletDevice(): boolean {
    return window.innerWidth > 768 && window.innerWidth <= 992;
  }

  /**
   * Check if desktop device
   */
  public isDesktopDevice(): boolean {
    return window.innerWidth > 992;
  }

  /**
   * Check if current route requires always mini mode (POS/Kitchen)
   */
  public isAlwaysMiniRoute(): boolean {
    const currentPath = window.location.pathname.toLowerCase();
    return currentPath.includes('/pos') || currentPath.includes('/kitchen');
  }

  // ==================== Encryption & Storage ====================

  private setEncrypted(key: string, data: any): void {
    try {
      const json = JSON.stringify(data);
      const encoded = btoa(encodeURIComponent(json));
      localStorage.setItem(key, encoded);
    } catch (error) {
      console.warn(`Failed to encrypt data for key: ${key}`, error);
    }
  }

  private getDecrypted<T>(key: string): T | null {
    const value = localStorage.getItem(key);
    if (!value) return null;

    try {
      const json = decodeURIComponent(atob(value));
      return JSON.parse(json) as T;
    } catch {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
  }

  // ==================== Cookie Management ====================

  public setCookie(name: string, value: string, daysToExpire: number): void {
    // Use cookies when available, otherwise persist in localStorage with expiry metadata
    if (this.areCookiesEnabled()) {
      try {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + daysToExpire);
        const cookieValue = `${encodeURIComponent(value)}; expires=${expirationDate.toUTCString()}; path=/`;
        document.cookie = `${name}=${cookieValue}`;
        return;
      } catch {
        // fallback to localStorage below
      }
    }

    try {
      const expires = daysToExpire && daysToExpire > 0
        ? Date.now() + daysToExpire * 24 * 60 * 60 * 1000
        : null;
      const payload = { v: value, e: expires };
      localStorage.setItem(name, JSON.stringify(payload));
    } catch {
      // best-effort: ignore storage errors
    }
  }

  public getCookie(name: string): string | null {
    // Prefer cookies when available
    if (this.areCookiesEnabled()) {
      try {
        const cookieName = `${name}=`;
        const cookies = document.cookie ? document.cookie.split(';') : [];
        for (const cookie of cookies) {
          const trimmed = cookie.trim();
          if (trimmed.indexOf(cookieName) === 0) {
            return decodeURIComponent(trimmed.substring(cookieName.length));
          }
        }
      } catch {
        // fall through to localStorage fallback
      }
    }

    // localStorage fallback — supports expiry metadata
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && ('v' in parsed)) {
        const expires = parsed.e as number | null;
        if (expires && Date.now() > expires) {
          localStorage.removeItem(name);
          return null;
        }
        return parsed.v ?? null;
      }

      // value stored as plain string
      return raw;
    } catch {
      return null;
    }
  }

  private areCookiesEnabled(): boolean {
    try {
      // Fast check first
      if (typeof navigator !== 'undefined' && 'cookieEnabled' in navigator && (navigator as any).cookieEnabled) {
        return true;
      }

      // Fallback: try to set and read a test cookie
      const testKey = 'gorestofy_cookie_test';
      document.cookie = `${testKey}=1; path=/`;
      const enabled = document.cookie.indexOf(`${testKey}=`) !== -1;
      // remove test cookie
      document.cookie = `${testKey}=;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      return enabled;
    } catch {
      return false;
    }
  }

  // ==================== Number & Currency Formatting ====================

  public getCurrencySymbol(): string {
    try {
      const formatter = new Intl.NumberFormat(this.regionName, {
        style: 'currency',
        currency: this.currencyName
      });
      const parts = formatter.formatToParts(1);
      const currencyPart = parts.find(part => part.type === 'currency');
      return currencyPart?.value || '';
    } catch {
      return '';
    }
  }

  public getNumberFormat(): { symbol: string; decimalSeparator: string; groupSeparator: string; placeholder: string } {
    return {
      symbol: this.currencySymbol,
      decimalSeparator: this.decimalSeparator,
      groupSeparator: this.groupSeparator,
      placeholder: `0${this.decimalSeparator}00`
    };
  }

  public getNumberPlaceholder(num: string = '0.00'): string {
    const decimalSeparator = this.getNumberFormat().decimalSeparator;
    return num.toString().replace('.', decimalSeparator);
  }

  // ==================== Authentication & Authorization ====================

  public login(userData: any): void {
    this.showSplashScreen();
    this.setEncrypted('gorestofy_UserSelectedLocationId', userData.defaultLocation);
    this.setEncrypted('gorestofy_User', userData);
    window.location.href = '/';
  }

  public logout(): void {
    this.showSplashScreen();
    localStorage.clear();
    window.location.href = '/auth/login';
  }

  public isAuthenticated(): boolean {
    return !!localStorage.getItem('gorestofy_User');
  }

  public hasPermission(permission: string): boolean {
    return this.userPermissions.includes(permission);
  }

  public hasSomePermissions(permission: string[]): boolean {
    return permission.some(p => this.userPermissions.includes(p));
  }

  public hasSomePermission(permissionPrefix: string): boolean {
    return this.userPermissions.some(permission => permission.startsWith(permissionPrefix));
  }

  public hasHomeAccess(): boolean {
    const defaultHome = this.getUserAttribute('defaultHome');
    return defaultHome == 'home';
  }

  public redirect(): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
      return;
    }

    if (this.getUserAttribute('isWaiter')) {
      this.router.navigate(['/waiter']);
      return;
    }

    const defaultHome = this.getUserAttribute('defaultHome');
    const routes: Record<string, string> = {
      'home': '/homemenu',
      'dashboard': '/dashboard',
      'pos': '/sales/pos'
    };

    this.router.navigate([routes[defaultHome] || '/homemenu']);
  }

  public navigate(route: string): void {
    this.router.navigate([route]);
  }

  // ==================== User Data Management ====================

  public getUserAttribute(name: string): string {
    return this.user?.[name] ?? '';
  }

  public getJwtToken(): string {
    const decodedUser = this.getDecrypted<any>('gorestofy_User');
    return decodedUser?.token || "";
  }

  public apiUrl(path: string): string {
    return resolveApiUrl(path);
  }

  public mediaFileName(value?: string | null): string {
    if (!value) {
      return '';
    }
    const name = value.replace(/\\/g, '/').split('?')[0].split('/').pop() || '';
    return name;
  }

  public itemImageUrl(fileName?: string | null, thumbnail = true): string {
    const name = this.mediaFileName(fileName);
    if (!name) {
      return '';
    }
    const action = thumbnail ? 'getthumbnailimage' : 'getimage';
    return this.apiUrl(`/api/media/${action}/items/${encodeURIComponent(name)}`);
  }

  public hubUrl(): string {
    return resolveHubUrl();
  }

  public getUserLocations(): any[] {
    return this.userLocations;
  }

  public getSelectedLocationId(): number {
    return this.userSelectedLocationId || this.getDecrypted<number>('gorestofy_UserSelectedLocationId') || 0;
  }

  public getSelectedLocationName(): string {
    const location = this.userLocations.find(b => b.id === this.userSelectedLocationId);
    return location?.locationName ?? '';
  }

  public getLocationName(id: number): string {
    const location = this.userLocations.find(b => b.id === id);
    return location?.locationName ?? '';
  }

  public hasAccessAllLocations(): boolean {
    return this.user?.['accessAllLocations'] == true;
  }

  public updateSelectedLocation(locationId: number): void {
    const location = this.userLocations.find(b => b.id === locationId);
    if (!location || this.userSelectedLocationId === locationId) return;

    this.userSelectedLocationId = locationId;
    this.setEncrypted('gorestofy_UserSelectedLocationId', locationId);
    window.location.reload();
  }

  // ==================== Localization ====================

  public localize(text: string): string {
    return this.stringResources[text] ?? text;
  }

  public getLanguages(): any[] {
    return this.languages;
  }

  public getAppConfig(key: string): string {
    return this.appConfig[key] ?? '';
  }

  public reloadLocalizationData(languageCode: string): void {
    $('.splash').removeAttr('style');

    this.http.get<any>(`/api/system/localizationdata/${languageCode}`).subscribe({
      next: (data) => {
        $('.splash').fadeOut('slow');
        this.enhanceLocalizationData(data);
        this.setCookie('gorestofy_Language', languageCode, 30);
        this.applyLocalizationData(data);
        localStorage.removeItem('gorestofy_LocalizationData');
        this.setEncrypted('gorestofy_LocalizationData', data);
        window.location.reload();
      },
      error: (error) => {
        $('.splash').fadeOut('slow');
        console.error('Failed to reload localization data:', error);
      }
    });
  }

  private changeDirection(direction: 'ltr' | 'rtl'): void {
    const bootstrapLink = document.querySelector('[bootstrap-lib]') as HTMLLinkElement;
    if (bootstrapLink) {
      bootstrapLink.href = direction === 'ltr'
        ? 'assets/lib/bootstrap/dist/css/bootstrap.min.css'
        : 'assets/lib/bootstrap/dist/css/bootstrap.rtl.min.css';
    }
    document.dir = direction;
  }

  public getRegionName(): string {
    return this.regionName;
  }

  // ==================== Date & Time Formatting ====================

  public formatDateTime(dateTimeString: string): string {
    if (!dateTimeString || !this.regionName || !this.timeZone) return '';

    try {
      const utcString = dateTimeString.endsWith('Z') ? dateTimeString : `${dateTimeString}Z`;
      const date = new Date(utcString);
      return date.toLocaleString(this.regionName, { timeZone: this.timeZone });
    } catch (error) {
      console.error('formatDateTime failed:', error);
      return '';
    }
  }

  public formatDate(dateTimeString: string): string {
    if (!dateTimeString || !this.regionName || !this.timeZone) return '';

    try {
      const utcString = dateTimeString.endsWith('Z') ? dateTimeString : `${dateTimeString}Z`;
      const date = new Date(utcString);
      return new Intl.DateTimeFormat(this.regionName, {
        timeZone: this.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('formatDate failed:', error);
      return '';
    }
  }

  public formatDayOfWeek(dateTimeString: string): string {
    if (!dateTimeString || !this.regionName || !this.timeZone) return '';

    try {
      const utcString = dateTimeString.endsWith('Z') ? dateTimeString : `${dateTimeString}Z`;
      const date = new Date(utcString);
      return new Intl.DateTimeFormat(this.regionName, {
        timeZone: this.timeZone,
        weekday: 'long'
      }).format(date);
    } catch (error) {
      console.error('formatDayOfWeek failed:', error);
      return '';
    }
  }

  public formatTime(timeString: string): string {
    if (!timeString || !this.regionName || !this.timeZone) return '';

    try {
      const [hours, minutes = 0, seconds = 0] = timeString.split(':').map(Number);
      const date = new Date();
      date.setUTCHours(hours, minutes, seconds, 0);

      return date.toLocaleTimeString(this.regionName, {
        timeZone: this.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('formatTime failed:', error);
      return '';
    }
  }

  public formatTimeByDateTime(dateTimeString: string): string {
    if (!dateTimeString || !this.regionName || !this.timeZone) return '';

    try {
      const utcString = dateTimeString.endsWith('Z') ? dateTimeString : `${dateTimeString}Z`;
      const date = new Date(utcString);
      return new Intl.DateTimeFormat(this.regionName, {
        timeZone: this.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (error) {
      console.error('formatTimeByDateTime failed:', error);
      return '';
    }
  }

  public formatPeriod(period: any): string {
    if (period === null || period === undefined) return '';

    try {
      const yearOnly = /^\d{4}$/;
      const yearMonth = /^\d{4}-\d{2}$/;
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
      const dateHour = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/; // e.g. "2025-03-15 14:00"

      const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(this.regionName || undefined, opts).format(d);

      if (typeof period === 'number' || (typeof period === 'string' && yearOnly.test(period))) {
        return String(period); // Year only
      }

      if (typeof period === 'string' && yearMonth.test(period)) {
        const [y, m] = period.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        return fmt(d, { year: 'numeric', month: 'long' }); // e.g. "March 2025"
      }

      if (typeof period === 'string' && dateHour.test(period)) {
        const [datePart, timePart] = period.split(/\s+/);
        const [y, m, dd] = datePart.split('-').map(Number);
        const [hh, mm] = timePart.split(':').map(Number);
        const d = new Date(y, m - 1, dd, hh, mm);
        const dateStr = fmt(d, { year: 'numeric', month: 'short', day: '2-digit' });
        const timeStr = fmt(d, { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${dateStr} ${timeStr}`;
      }

      if (typeof period === 'string' && dateOnly.test(period)) {
        const [y, m, dd] = period.split('-').map(Number);
        const d = new Date(y, m - 1, dd);
        return fmt(d, { year: 'numeric', month: 'long', day: '2-digit' });
      }

      if (period instanceof Date) {
        return fmt(period, { year: 'numeric', month: 'long', day: '2-digit' });
      }

      const parsed = new Date(String(period));
      if (!isNaN(parsed.getTime())) {
        return fmt(parsed, { year: 'numeric', month: 'long', day: '2-digit' });
      }

      return String(period);
    } catch {
      return String(period);
    }
  }

  public currentHTMLDate(): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: this.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    } catch (error) {
      return '';
    }
  }

  public monthStartHTMLDate(): string {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: this.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(now).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {} as Record<string, string>);

      const year = parts['year'];
      const month = parts['month'];

      if (!year || !month) return '';

      return `${year}-${month.padStart(2, '0')}-01`;
    } catch (error) {
      return '';
    }
  }

  public APIDateTimeToHTMLDate(utcDateTime: string): string {
    const dateTime = new Date(utcDateTime + 'Z');
    const options: any = { timeZone: this.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' };
    const formattedDateString = dateTime.toLocaleString('en-US', options);
    const parts = formattedDateString.split('/');
    const year = parts[2];
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public HTMLDateToAPIDateTime(htmlDate: string): string | null {
    if (!htmlDate || !this.timeZone) return null;

    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-GB', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).formatToParts(now).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {} as Record<string, string>);

      const hour = Number(parts['hour']);
      const minute = Number(parts['minute']);
      const second = Number(parts['second']);
      const [year, month, day] = htmlDate.split('-').map(Number);
      const localDateGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      const actualZoneDate = new Date(localDateGuess.toLocaleString('en-US', { timeZone: this.timeZone }));
      const offsetMs = localDateGuess.getTime() - actualZoneDate.getTime();
      const utcDate = new Date(localDateGuess.getTime() - offsetMs);
      return utcDate.toISOString();
    } catch {
      return null;
    }
  }

  public APIDateTimeToHTMLDateTime(utcDateTime: string): string {
    if (!utcDateTime) return '';

    try {
      const utcString = utcDateTime.endsWith('Z') ? utcDateTime : `${utcDateTime}Z`;
      const date = new Date(utcString);

      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: this.timeZone || undefined,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(date).reduce((acc, p) => {
        if (p.type !== 'literal') acc[p.type] = p.value;
        return acc;
      }, {} as Record<string, string>);

      const year = parts['year'] ?? '';
      const month = (parts['month'] ?? '').padStart(2, '0');
      const day = (parts['day'] ?? '').padStart(2, '0');
      const hour = (parts['hour'] ?? '00').padStart(2, '0');
      const minute = (parts['minute'] ?? '00').padStart(2, '0');

      // Return value suitable for <input type="datetime-local"> (no timezone suffix)
      return `${year}-${month}-${day}T${hour}:${minute}`;
    } catch (error) {
      console.error('APIDateTimeToHTMLDateTime failed:', error);
      return '';
    }
  }

  public HTMLTimeToAPITime(time: any): string {
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}:00`;
  }

  public APITimeToHTMLTime(utcTime: string): string {
    try {
      const [h, m] = utcTime.split(":").map(Number);
      const baseDate = new Date();
      baseDate.setUTCHours(h, m, 0, 0);

      const formatter = new Intl.DateTimeFormat(this.regionName, {
        timeZone: this.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });

      const parts = formatter.formatToParts(baseDate);
      const hour = parts.find(p => p.type === "hour")?.value ?? "00";
      const minute = parts.find(p => p.type === "minute")?.value ?? "00";

      return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    } catch {
      return utcTime;
    }
  }

  // ==================== Number & Currency Formatting ====================

  public formatNumber(value: number | string, fractionDigits: number = 2): string {
    if (value === null || value === undefined || isNaN(Number(value))) return '0.00';

    return new Intl.NumberFormat(this.regionName, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(Number(value));
  }

  public formatCurrency(value: number | string): string {
    if (value === null || value === '' || !this.currencyName || !this.regionName) return '';

    return new Intl.NumberFormat(this.regionName, {
      style: 'currency',
      currency: this.currencyName
    }).format(Number(value));
  }

  public formatPercent(value: number | string, fractionDigits: number = 2): string {
    if (value === null || value === undefined || value === '') return '';
    return value.toString() + '%';
  }

  public localeToAPINumber(value: string): number {
    if (typeof value !== 'string') value = String(value);

    const thousandsSeparator = this.decimalSeparator === ',' ? '.' : ',';
    let normalized = value.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '').replace(/\s/g, '');
    normalized = normalized.replace(this.decimalSeparator, '.');

    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }

  public apiNumberToLocale(value: any): string {
    const str = String(value).trim();
    const num = Number(str);
    if (isNaN(num)) return '0';

    return num.toString().replace('.', this.decimalSeparator);
  }

  // ==================== Form Utilities ====================

  public formatAccountsForNgSelect(accounts: any[]): { id: any; accountName: string; group: string }[] {
    const groups: Record<string, { id: any; accountName: string; group: string }[]> = {};

    accounts.forEach(account => {
      const group = `${account?.typeName || 'Other'} › ${account?.categoryName || 'Uncategorized'}`;
      const accountName = `${account?.accountCode ?? '----'} - ${account?.accountName ?? 'Unnamed Account'}`;
      if (!groups[group]) groups[group] = [];
      groups[group].push({ id: account?.id, accountName, group });
    });

    return ([] as { id: any; accountName: string; group: string }[]).concat(...Object.values(groups));
  }

  public getCleaveNumberOptions(scale: number = 2, positiveOnly: boolean = false): any {
    return {
      numeral: true,
      numeralDecimalMark: this.decimalSeparator,
      delimiter: '',
      numeralDecimalScale: scale,
      numeralPositiveOnly: positiveOnly,
      stripLeadingZeroes: false,
      blocks: [18]
    };
  }

  public initCleaveNumber(selector: string, options: any = {}): void {
    const defaultOptions = this.getCleaveNumberOptions();
    document.querySelectorAll(selector).forEach(element => {
      new Cleave(element, { ...defaultOptions, ...options });
    });
  }

  public getLocaleDateFormat(): string {
    try {
      const formatter = new Intl.DateTimeFormat(this.regionName);
      const parts = formatter.formatToParts(new Date(2025, 10, 23));

      return parts.map(part => {
        switch (part.type) {
          case 'day': return 'dd';
          case 'month': return 'mm';
          case 'year': return 'yyyy';
          case 'literal': return part.value;
          default: return '';
        }
      }).join('');
    } catch {
      return 'mm/dd/yyyy';
    }
  }

  public createFormData(data: any, excludeFields: string[] = []): FormData {
    const formData = new FormData();

    const appendToFormData = (form: FormData, key: string, value: any): void => {
      if (value === null || value === undefined) return;

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            Object.keys(item).forEach(prop => {
              if (item[prop] != null) {
                form.append(`${key}[${index}].${prop}`, item[prop]);
              }
            });
          } else {
            form.append(`${key}[${index}]`, item);
          }
        });
      } else if (typeof value === 'object') {
        Object.keys(value).forEach(prop => {
          appendToFormData(form, `${key}.${prop}`, value[prop]);
        });
      } else {
        form.append(key, value);
      }
    };

    Object.keys(data).forEach(key => {
      if (!excludeFields.includes(key)) {
        appendToFormData(formData, key, data[key]);
      }
    });

    return formData;
  }

  public appendFilesToFormData(formData: FormData, files: { [key: string]: File | File[] | null }): FormData {
    for (const key in files) {
      const file = files[key];
      if (file instanceof File) {
        formData.append(key, file);
      } else if (Array.isArray(file)) {
        file.forEach((f, index) => {
          if (f instanceof File) {
            formData.append(`${key}[${index}]`, f);
          }
        });
      }
    }
    return formData;
  }

  public getSummernoteCode(selector: string): string {
    return $(selector).summernote('code');
  }

  public formatAddress(
    address?: string | null,
    city?: string | null,
    state?: string | null,
    postalCode?: string | null,
    country?: string | null
  ): string {
    const clean = (s?: string | null) =>
      s && s.trim() !== '' && s.trim() !== '-' ? s.trim() : null;

    const addr = clean(address);
    const ct = clean(city);
    const st = clean(state);
    const postal = clean(postalCode);
    const cnt = clean(country);

    const statePostal = st && postal ? `${st} ${postal}` : (st || postal) || null;

    const parts = [addr, ct, statePostal, cnt].filter(p => p !== null) as string[];

    return parts.length === 0 ? '' : parts.join(', ');
  }

  // ==================== Image Management ====================

  public async loadImages(selector: string, isBackground = false): Promise<void> {
    setTimeout(async () => {
      const elements = document.querySelectorAll(selector);
      if (!elements.length) {
        return;
      }

      let cache: Cache | null = null;
      try {
        cache = await caches.open('image-cache');
      } catch {
        cache = null;
      }

      for (const element of Array.from(elements)) {
        const el = element as HTMLElement;
        const imageUrl = el.getAttribute('data-url');
        if (!imageUrl) {
          if (isBackground) {
            el.style.backgroundImage = 'url()';
          }
          continue;
        }

        try {
          if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
            if (isBackground) {
              el.style.backgroundImage = `url(${imageUrl})`;
            } else {
              (el as HTMLImageElement).src = imageUrl;
            }
            continue;
          }

          let blob: Blob | null = null;
          if (cache) {
            const cachedResponse = await cache.match(imageUrl);
            if (cachedResponse) {
              blob = await cachedResponse.blob();
            }
          }

          if (!blob) {
            blob = await this.http.get(imageUrl, { responseType: 'blob' }).toPromise() as Blob;
            if (blob && cache && !/json|html|text|xml/i.test(blob.type || '')) {
              try {
                await cache.put(imageUrl, new Response(blob));
              } catch {
                // Ignore cache quota / CORS put failures so the image still displays
              }
            }
          }

          if (!blob || /json|html|text|xml/i.test(blob.type || '')) {
            throw new Error('Not an image');
          }

          const objectUrl = URL.createObjectURL(blob);
          if (isBackground) {
            el.style.backgroundImage = `url(${objectUrl})`;
          } else {
            (el as HTMLImageElement).src = objectUrl;
          }
        } catch {
          if (!isBackground) {
            (el as HTMLImageElement).src = 'assets/images/default.png';
          }
        }
      }
    }, 100);
  }

  // ==================== Offline Data Management ====================

  private DB_NAME = 'GorestofyOfflineDB'
  private STORE_NAME = 'OfflineDataStore'
  private DB_VERSION = 1

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Save data to IndexedDB
  public async saveOfflineData<T>(key: string, value: T): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get data from IndexedDB
  public async getOfflineData<T>(key: string): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result ? (request.result.value as T) : null;
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteOfflineData(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Error Handling ====================

  public handleApiError(error: any): void {
    if(error && error.status == 423 && error?.error?.message) {
      this.showWarningMessage('Access Denied!', error.error.message);
      return;
    }
    if (error && error?.error?.message) {
      this.showErrorMessage('Error!', error.error.message);
      return;
    }
    const errorHandlers: Record<number, () => void> = {
      401: () => this.logout(),
      403: () => this.showErrorMessage('Error!', 'Access denied'),
      404: () => this.showErrorMessage('Error!', 'Resource not found'),
      0: () => this.showNoInternetMessage('No Internet Connection!', 'Check your connection and try again')
    };

    const handler = errorHandlers[error.status];
    if (handler) {
      handler();
    } else {
      const message = this.localize(error.error?.message ?? '') || this.localize(error.error.statusText ?? '') || 'An error occurred';
      this.showErrorMessage(`${error.status}`, message);
    }
  }

  // ==================== Notification System ====================

  public showSuccessMessage(title: string, description: string): void {
    this.showToast('primary', title, description);
  }

  public showErrorMessage(title: string, description: string): void {
    this.showToast('error', title, description);
  }

  public showInfoMessage(title: string, description: string): void {
    this.showToast('info', title, description);
  }

  public showWarningMessage(title: string, description: string): void {
    this.showToast('warning', title, description);
  }

  public showNoInternetMessage(title: string, description: string): void {
    this.showToast('offline', title, description);
  }

  private showToast(type: string, title: string, description: string): void {
    const iconMap: Record<string, string> = {
      primary: 'text-primary ri-checkbox-circle-fill',
      error: 'text-danger ri-close-circle-fill',
      info: 'text-info ri-information-fill',
      warning: 'text-warning ri-alert-fill',
      offline: 'text-secondary ri-wifi-off-line',
    };

    const iconClass = iconMap[type] || 'text-muted ri-notification-line';

    const toastHtml = `
    <div class="toast-body">
      <div class="toast-icon"><i class="${iconClass}"></i></div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        ${description ? `<div class="toast-desc">${description}</div>` : ''}
      </div>
      <button class="toast-close btn btn-sm btn-icon" aria-label="Close"><i class="ri-close-line"></i></button>
      <div class="toast-progress"></div>
    </div>
  `;

    const toaster = document.getElementById('toasters');
    if (!toaster) return;

    const toast = document.createElement('div');
    toast.className = `toast show toast-${type}`;
    toast.innerHTML = toastHtml;
    toaster.prepend(toast);

    const timeoutDuration = 20000;
    let startTime = Date.now();
    let remaining = timeoutDuration;
    let timeoutId: ReturnType<typeof setTimeout>;

    const progressDiv = toast.querySelector('.toast-progress') as HTMLElement;
    if (progressDiv) {
      progressDiv.style.setProperty('--progress-duration', `${timeoutDuration}ms`);
    }

    const removeToast = () => toast.remove();

    const startTimeout = () => {
      startTime = Date.now();
      timeoutId = setTimeout(removeToast, remaining);
    };

    const pauseTimeout = () => {
      clearTimeout(timeoutId);
      remaining -= Date.now() - startTime;
    };

    startTimeout();

    toast.addEventListener('mouseenter', () => {
      pauseTimeout();
      if (progressDiv) {
        progressDiv.style.setProperty('animation-play-state', 'paused');
      }
    });

    toast.addEventListener('mouseleave', () => {
      startTime = Date.now();
      if (progressDiv) {
        progressDiv.style.setProperty('animation-play-state', 'running');
      }
      timeoutId = setTimeout(removeToast, remaining);
    });

    toast.querySelector('.toast-close')?.addEventListener('click', () => {
      clearTimeout(timeoutId);
      removeToast();
    });
  }

  // ==================== Confirm Dialog System ====================

  public confirmDialog(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: (() => void) | null,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel',
    type: 'danger' | 'warning' | 'success' | 'info' = 'info'
  ): void {
    this.removeExistingConfirmDialog();

    const dialogId = 'confirmDialog_' + Date.now();
    const iconClass = this.getDialogIconClass(type);
    const iconColor = this.getDialogIconColor(type);
    const buttonClass = this.getDialogButtonClass(type);

    const dialogHtml = `
    <div class="modal fade show" id="${dialogId}" tabindex="-1" role="dialog" style="display: block;">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content fadeIn">
          <div class="modal-body text-center p-4">
            <div class="text-${iconColor}">
              <i class="fs-1 ${iconClass}"></i>
            </div>
            <div class="heading heading-sub-lg my-3">
              <h4 class="mb-1">${title}</h4>
              <p>${message}</p>
            </div>
            <div class="d-flex justify-content-center gap-2">
              <button type="button" class="btn btn-light btn-round cancel-action" id="cancelBtn_${dialogId}">
                ${cancelText}
              </button>
              <button type="button" class="btn btn-${buttonClass} btn-round confirm-action" id="confirmBtn_${dialogId}">
                ${confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    </div>
  `;

    let modalContainer = document.querySelector('.modal-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.className = 'modal-container';
      document.body.appendChild(modalContainer);
    }

    const dialogElement = document.createElement('div');
    dialogElement.innerHTML = dialogHtml;
    dialogElement.id = `closeconfirmdialog_${dialogId}`;
    modalContainer.appendChild(dialogElement);

    document.body.style.overflow = 'hidden';
    this.attachConfirmDialogEventListeners(dialogId, onConfirm, onCancel);
  }


  public detailDialog(
    title: string,
    message: string,
    onClose?: (() => void) | null,
    buttonText: string = 'OK',
    type: 'danger' | 'warning' | 'success' | 'info' = 'info'
  ): void {
    this.removeExistingAlertDialog();

    const dialogId = 'detailDialog_' + Date.now();
    const buttonClass = this.getDialogButtonClass(type);

    const dialogHtml = `
    <div class="modal has-footer fade show" id="${dialogId}" tabindex="-1" role="dialog" style="display: block;">
      <div class="modal-dialog modal-dialog modal-lg" role="document">
        <div class="modal-content fadeIn">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="ms-auto btn btn-icon btn-sm btn-light close-action" id="closeIcon_${dialogId}">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <div>${message}</div>
          </div>
          <div class="modal-footer">
            <div class="d-flex justify-content-end align-items-center my-auto">
              <button type="button" class="btn btn-${buttonClass} btn-round close-action" id="closeBtn_${dialogId}">
                ${buttonText}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    </div>
  `;

    let modalContainer = document.querySelector('.modal-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.className = 'modal-container';
      document.body.appendChild(modalContainer);
    }

    const dialogElement = document.createElement('div');
    dialogElement.innerHTML = dialogHtml;
    dialogElement.id = `closeconfirmdialog_${dialogId}`;
    modalContainer.appendChild(dialogElement);

    document.body.style.overflow = 'hidden';
    this.attachAlertDialogEventListeners(dialogId, onClose);
  }

  public showLoadingDialog(message: string = 'Please wait...'): string {
    this.removeExistingLoadingDialog();

    const dialogId = 'loadingDialog_' + Date.now();

    const dialogHtml = `
    <div class="modal fade show" id="${dialogId}" tabindex="-1" role="dialog" style="display: block;">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
          <div class="modal-body text-center p-4">
            <div class="d-flex justify-content-center mb-3">
              <div class="loader"></div>
            </div>
            <h5 class="mb-0">${message}</h5>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    </div>
  `;

    let modalContainer = document.querySelector('.modal-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.className = 'modal-container';
      document.body.appendChild(modalContainer);
    }

    const dialogElement = document.createElement('div');
    dialogElement.innerHTML = dialogHtml;
    dialogElement.id = `closeconfirmdialog_${dialogId}`;
    modalContainer.appendChild(dialogElement);

    document.body.style.overflow = 'hidden';
    return dialogId;
  }

  public closeLoadingDialog(dialogId: string): void {
    const dialogElement = document.getElementById(`closeconfirmdialog_${dialogId}`);
    if (dialogElement) {
      dialogElement.remove();
      this.restoreBodyScroll();
    }
  }

  // Helper methods for dialog system
  private getDialogIconClass(type: string): string {
    const iconMap: Record<string, string> = {
      danger: 'ri-error-warning-line',
      warning: 'ri-alert-line',
      success: 'ri-checkbox-circle-line',
      info: 'ri-information-line'
    };
    return iconMap[type] || iconMap['info'];
  }

  private getDialogIconColor(type: string): string {
    const colorMap: Record<string, string> = {
      danger: 'danger',
      warning: 'warning',
      success: 'success',
      info: 'info'
    };
    return colorMap[type] || colorMap['info'];
  }

  private getDialogButtonClass(type: string): string {
    const buttonMap: Record<string, string> = {
      danger: 'danger',
      warning: 'warning',
      success: 'success',
      info: 'primary'
    };
    return buttonMap[type] || buttonMap['info'];
  }

  private attachConfirmDialogEventListeners(
    dialogId: string,
    onConfirm: () => void,
    onCancel?: (() => void) | null
  ): void {
    const confirmBtn = document.getElementById(`confirmBtn_${dialogId}`);
    const cancelBtn = document.getElementById(`cancelBtn_${dialogId}`);
    const backdrop = document.querySelector(`#${dialogId} .modal-backdrop`);
    const dialogElement = document.getElementById(`closeconfirmdialog_${dialogId}`);

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.removeConfirmDialog(dialogId);
        if (onConfirm) onConfirm();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.removeConfirmDialog(dialogId);
        if (onCancel) onCancel();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.removeConfirmDialog(dialogId);
        if (onCancel) onCancel();
      });
    }

    const escKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.removeConfirmDialog(dialogId);
        if (onCancel) onCancel();
        document.removeEventListener('keydown', escKeyHandler);
      }
    };
    document.addEventListener('keydown', escKeyHandler);

    if (dialogElement) {
      (dialogElement as any)._escKeyHandler = escKeyHandler;
    }
  }

  private attachAlertDialogEventListeners(
    dialogId: string,
    onClose?: (() => void) | null
  ): void {
    const closeBtn = document.getElementById(`closeBtn_${dialogId}`);
    const closeIcon = document.getElementById(`closeIcon_${dialogId}`);
    const backdrop = document.querySelector(`#${dialogId} .modal-backdrop`);
    const dialogElement = document.getElementById(`closeconfirmdialog_${dialogId}`);

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removeAlertDialog(dialogId);
        if (onClose) onClose();
      });
    }

    if (closeIcon) {
      closeIcon.addEventListener('click', () => {
        this.removeAlertDialog(dialogId);
        if (onClose) onClose();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.removeAlertDialog(dialogId);
        if (onClose) onClose();
      });
    }

    const escKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.removeAlertDialog(dialogId);
        if (onClose) onClose();
        document.removeEventListener('keydown', escKeyHandler);
      }
    };
    document.addEventListener('keydown', escKeyHandler);

    if (dialogElement) {
      (dialogElement as any)._escKeyHandler = escKeyHandler;
    }
  }

  private attachInputDialogEventListeners(
    dialogId: string,
    onConfirm: (value: string) => void,
    onCancel?: (() => void) | null,
    required: boolean = true
  ): void {
    const confirmBtn = document.getElementById(`confirmInputBtn_${dialogId}`);
    const cancelBtn = document.getElementById(`cancelInputBtn_${dialogId}`);
    const inputElement = document.getElementById(`inputValue_${dialogId}`) as HTMLInputElement;
    const backdrop = document.querySelector(`#${dialogId} .modal-backdrop`);
    const dialogElement = document.getElementById(`closeconfirmdialog_${dialogId}`);

    const validateInput = (): boolean => {
      if (!inputElement) return false;

      const value = inputElement.value.trim();
      const isValid = !required || value.length > 0;

      if (isValid) {
        inputElement.classList.remove('is-invalid');
        inputElement.classList.add('is-valid');
      } else {
        inputElement.classList.remove('is-valid');
        inputElement.classList.add('is-invalid');
      }

      return isValid;
    };

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (validateInput() && inputElement) {
          const value = inputElement.value.trim();
          this.removeInputDialog(dialogId);
          if (onConfirm) onConfirm(value);
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.removeInputDialog(dialogId);
        if (onCancel) onCancel();
      });
    }

    if (inputElement) {
      inputElement.addEventListener('input', validateInput);
      inputElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (validateInput()) {
            const value = inputElement.value.trim();
            this.removeInputDialog(dialogId);
            if (onConfirm) onConfirm(value);
          }
        }
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.removeInputDialog(dialogId);
        if (onCancel) onCancel();
      });
    }

    const escKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.removeInputDialog(dialogId);
        if (onCancel) onCancel();
        document.removeEventListener('keydown', escKeyHandler);
      }
    };
    document.addEventListener('keydown', escKeyHandler);

    if (dialogElement) {
      (dialogElement as any)._escKeyHandler = escKeyHandler;
    }
  }

  private removeConfirmDialog(dialogId: string): void {
    const dialogElement = document.getElementById(`closeconfirmdialog_${dialogId}`);
    if (dialogElement) {
      const escKeyHandler = (dialogElement as any)._escKeyHandler;
      if (escKeyHandler) {
        document.removeEventListener('keydown', escKeyHandler);
      }
      dialogElement.remove();
      this.restoreBodyScroll();
    }
  }

  private removeAlertDialog(dialogId: string): void {
    const dialogElement = document.getElementById(`closeconfirmdialog_${dialogId}`);
    if (dialogElement) {
      const escKeyHandler = (dialogElement as any)._escKeyHandler;
      if (escKeyHandler) {
        document.removeEventListener('keydown', escKeyHandler);
      }
      dialogElement.remove();
      this.restoreBodyScroll();
    }
  }

  private removeInputDialog(dialogId: string): void {
    const dialogElement = document.getElementById(`closeconfirmdialog_${dialogId}`);
    if (dialogElement) {
      const escKeyHandler = (dialogElement as any)._escKeyHandler;
      if (escKeyHandler) {
        document.removeEventListener('keydown', escKeyHandler);
      }
      dialogElement.remove();
      this.restoreBodyScroll();
    }
  }

  private removeExistingConfirmDialog(): void {
    const existingDialogs = document.querySelectorAll('[id^="closeconfirmdialog_confirmDialog_"]');
    existingDialogs.forEach(dialog => {
      const escKeyHandler = (dialog as any)._escKeyHandler;
      if (escKeyHandler) {
        document.removeEventListener('keydown', escKeyHandler);
      }
      dialog.remove();
    });
  }

  private removeExistingAlertDialog(): void {
    const existingDialogs = document.querySelectorAll('[id^="closeconfirmdialog_alertDialog_"], [id^="closeconfirmdialog_detailDialog_"]');
    existingDialogs.forEach(dialog => {
      const escKeyHandler = (dialog as any)._escKeyHandler;
      if (escKeyHandler) {
        document.removeEventListener('keydown', escKeyHandler);
      }
      dialog.remove();
    });
  }

  private removeExistingLoadingDialog(): void {
    const existingDialogs = document.querySelectorAll('[id^="closeconfirmdialog_loadingDialog_"]');
    existingDialogs.forEach(dialog => dialog.remove());
  }

  private removeExistingInputDialog(): void {
    const existingDialogs = document.querySelectorAll('[id^="closeconfirmdialog_inputDialog_"]');
    existingDialogs.forEach(dialog => {
      const escKeyHandler = (dialog as any)._escKeyHandler;
      if (escKeyHandler) {
        document.removeEventListener('keydown', escKeyHandler);
      }
      dialog.remove();
    });
  }

  private restoreBodyScroll(): void {
    const remainingDialogs = document.querySelectorAll('[id^="closeconfirmdialog_"]');
    if (remainingDialogs.length === 0) {
      document.body.style.overflow = '';
    }
  }

  // ==================== Theme Management ====================

  public switchNightMode(): void {
    const isDark = this.isNightMode();
    localStorage.setItem('gorestofy_Thememode', isDark ? 'light' : 'dark');
    document.body.setAttribute('data-dark-theme', (!isDark).toString());
  }

  public applyNightMode(): void {
    if (this.isNightMode()) {
      document.body.setAttribute('data-dark-theme', 'true');
    } else {
      document.body.removeAttribute('data-dark-theme');
    }
  }

  public isNightMode(): boolean {
    return localStorage.getItem('gorestofy_Thememode') === 'dark';
  }

  public toggleDarkMode(): void {
    const isDark = !this.isNightMode();
    localStorage.setItem('gorestofy_Thememode', isDark ? 'dark' : 'light');
    document.body.setAttribute('data-dark-theme', isDark.toString());
  }

  // ==================== Utility Methods ====================

  public getLocalCurrentDateTime(): string {
    try {
      const opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      return new Date().toLocaleString(this.regionName || undefined, { timeZone: this.timeZone || undefined, ...opts });
    } catch {
      return new Date().toLocaleString();
    }
  }

  public goBack(): void {
    this.location.back();
  }

  private showSplashScreen(): void {
    const splash = document.getElementById('splash-screen');
    splash?.classList.remove('d-none');
  }

  private hideSplashScreen(): void {
    const splash = document.getElementById('splash-screen');
    splash?.classList.add('d-none');
  }

  public getMonths(): Array<{ id: number; value: string }> {
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(2000, index, 1);
      const monthName = date.toLocaleDateString(this.regionName, { month: 'long' });
      return { id: index + 1, value: monthName };
    });
  }

  public getYears(): Array<{ id: number; value: number }> {
    const currentYear = new Date().getFullYear();
    const years: Array<{ id: number; value: number }> = [];
    const start = currentYear - 10;
    const end = currentYear + 10;

    for (let year = start; year <= end; year++) {
      years.push({ id: year, value: year });
    }

    return years;
  }

  public getMonthName(month: number): string {
    if (month < 1 || month > 12) return 'Invalid Month';
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleDateString(this.regionName, { month: 'long' });
  }

  public getMonthYearString(month: number, year: number): string {
    const monthName = this.getMonthName(month);
    return `${monthName} ${year}`;
  }

  public reloadAppConfig(): void {
    localStorage.removeItem('gorestofy_AppConfig');
    this.loadAppConfig();
  }

  public getCurrentDateTime(): string {
    return new Date().toLocaleString();
  }

  public getCurrentUser(): string {
    return this.getUserAttribute('fullName') || 'Unknown User';
  }

  public getAppVersion(): string {
    return this.getAppConfig('version') || '2.1.0';
  }

  public generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
