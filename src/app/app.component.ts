import { AfterViewInit, Component, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppService } from './services/app.service';
import { Idle, DEFAULT_INTERRUPTSOURCES } from '@ng-idle/core';
import { Keepalive } from '@ng-idle/keepalive';
import { Subject } from 'rxjs';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { AppImports } from './app.imports';

/**
 * =========================================================
 * GoRestofy POS System - Main App Component (SIMPLIFIED)
 * =========================================================
 * Simplified layout management based on backend configuration:
 * - sidebar-fixed: Mobile=drawer, Tablet=mini, Desktop=toggle or always-mini for POS/Kitchen
 * - collapsible: Mobile=drawer, Tablet/Desktop=collapsible
 * - drawer: Always drawer with auto-close on mobile navigation
 * 
 * Author: Golosoft Team
 * Version: 1.0.0 (Simplified)
 * Last Updated: 2025-10-04 15:00:00 UTC
 * =========================================================
 */

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	standalone: true,
	imports: [AppImports]
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
	public notifications: any[] = [];

	// ==================== Private Properties ====================

	private destroy$ = new Subject<void>();
	private resizeTimeout: any;
	private navInitialized = false;
	private submenuInitialized = false;

	// Screen breakpoints
	private readonly MOBILE_MAX = 768;
	private readonly TABLET_MAX = 992;

	// ==================== Public Properties ====================

	public languageModal = { show: false, loading: false };
	public isMiniSubmenuOpen = false;

	// ==================== PWA ====================
	public showInstallBanner = false;
	private deferredPrompt: any;
	public appName = 'GoRestofy';
	public currentUrl = '';

	// ==================== Constructor ====================

	constructor(
		private http: HttpClient,
		public app: AppService,
		private router: Router,
		private idle: Idle,
		private keepalive: Keepalive
	) {
		this.initializeIdleTimeout();
		this.checkAppVersion();
		this.setupNavigationListener();
		this.loadNotifications();
	}

	// ==================== Notification Methods ====================

	public loadNotifications(): void {
		if (this.app.isAuthenticated()) {
			this.http.get<any>('/api/profile/getnewnotifications').subscribe(response => {
				this.notifications = response.notifications || [];
			});
		}
	}

	// ==================== Lifecycle Hooks ====================

	ngOnInit(): void {
		this.app.applySystemTheme();
		this.applyResponsiveLayout();
		this.showPWA();
	}

	ngAfterViewInit(): void {
		this.hideSplashScreen();
		this.initializeUtilities();
		if (this.app.isAuthenticated()) {
			setTimeout(() => {
				this.initializeLayoutSystem();
			}, 200);
		}
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
		}
	}

	// ==================== PWA Installation Methods ====================

	private showPWA() {
		if (this.isInstalled()) return;

		this.appName = this.app.getAppConfig('appName') || 'GoRestofy';
		this.currentUrl = window.location.hostname;

		window.addEventListener('beforeinstallprompt', (e: any) => {
			e.preventDefault();
			this.deferredPrompt = e;

			this.showInstallBanner = true;

			// Hide after 10 seconds
			setTimeout(() => {
				this.showInstallBanner = false;
			}, 10000);
		});
	}

	async installApp() {
		if (!this.deferredPrompt) return;

		this.deferredPrompt.prompt();
		await this.deferredPrompt.userChoice;

		this.showInstallBanner = false;
		this.deferredPrompt = null;
	}

	private isInstalled(): boolean {
		return (
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as any).standalone === true
		);
	}

	// ==================== Computed Properties ====================

	public get isMobile(): boolean {
		return window.innerWidth <= this.MOBILE_MAX;
	}

	public get isTablet(): boolean {
		return window.innerWidth > this.MOBILE_MAX && window.innerWidth <= this.TABLET_MAX;
	}

	public get isDesktop(): boolean {
		return window.innerWidth > this.TABLET_MAX;
	}

	public get baseLayout(): string {
		return this.app.getBaseLayoutMode();
	}

	public get isDark(): boolean {
		return document.body.getAttribute('data-dark-theme') === 'true';
	}

	// ==================== Event Handlers ====================

	@HostListener('window:resize')
	onResize(): void {
		clearTimeout(this.resizeTimeout);
		this.resizeTimeout = setTimeout(() => {
			this.applyResponsiveLayout();
		}, 150);
	}

	// ==================== Initialization Methods ====================

	private initializeIdleTimeout(): void {
		this.idle.setIdle(7200); // 2 hours
		this.idle.setTimeout(30);
		this.idle.setInterrupts(DEFAULT_INTERRUPTSOURCES);

		this.idle.onIdleStart.subscribe(() => {
			if (this.app.isAuthenticated()) {
				this.app.showWarningMessage('Session Timeout', 'You will be logged out due to inactivity');
				setTimeout(() => this.app.logout(), 5000);
			}
		});

		this.idle.watch();
	}

	private checkAppVersion() {
		this.http.get<any>('/api/system/appversion').subscribe(
			data => {
				let version = this.app.getCookie('gorestofy_Version');
				if (version != data.version) {
					localStorage.clear();
					window.location.reload();
					this.app.setCookie('gorestofy_Version', data.version, 60);
				}
			},
			error => console.error(error)
		);
	}

	private setupNavigationListener(): void {
		this.router.events.subscribe(event => {
			if (event instanceof NavigationEnd) {
				// Auto-close drawer on mobile navigation
				if (this.baseLayout === 'drawer' && this.isMobile) {
					this.closeSidebar();
				}
				// Refresh active navigation
				setTimeout(() => this.setActiveNavigation(), 100);
			}
		});
	}

	private hideSplashScreen(): void {
		const splash = document.getElementById('splash-screen');
		if (splash) {
			setTimeout(() => {
				splash.classList.add('fade-out');
				setTimeout(() => splash.classList.add('d-none'), 300);
			}, 600);
		}
	}

	private initializeUtilities(): void {
		this.initPasswordToggle();
		this.initKeyboardShortcuts();
	}

	private initializeLayoutSystem(): void {
		this.initializeNavigation();
		this.initializeSubmenuHandling();
		this.applyResponsiveLayout();
	}

	// ==================== Layout Management ====================

	/**
	 * Apply responsive layout based on screen size and backend configuration
	 */
	private applyResponsiveLayout(): void {
		const body = document.body;
		const layout = this.baseLayout;
		const isAlwaysMini = this.app.isAlwaysMiniRoute();

		// Clear existing states
		body.classList.remove('mini-active');
		this.closeSidebar();

		if (layout === 'sidebar-fixed') {
			if (this.isMobile) {
				// Mobile: drawer mode
				this.closeSidebar();
				body.setAttribute('data-theme-layout', 'drawer');
			} else if (this.isTablet) {
				// Tablet: always mini
				body.classList.add('mini-active');
				this.hideSubmenu();
				body.setAttribute('data-theme-layout', 'sidebar-fixed');
			} else {
				// Desktop: always mini for POS/Kitchen, otherwise check saved state
				if (isAlwaysMini) {
					body.classList.add('mini-active');
					this.hideSubmenu();
				} else {
					const savedMini = localStorage.getItem('gorestofy_SidebarMinified') === 'true';
					if (savedMini) {
						body.classList.add('mini-active');
						this.hideSubmenu();
					}
				}
				body.setAttribute('data-theme-layout', 'sidebar-fixed');
			}
		} else if (layout === 'collapsible') {
			if (this.isMobile) {
				// Mobile: drawer mode
				this.closeSidebar();
				body.setAttribute('data-theme-layout', 'drawer');
			} else {
				body.setAttribute('data-theme-layout', 'collapsible');
			}
		} else if (layout === 'drawer') {
			// Always drawer: starts closed
			this.closeSidebar();
			body.setAttribute('data-theme-layout', 'drawer');
		}
	}

	private initializeSubmenuHandling(): void {
		if (this.submenuInitialized) return;

		setTimeout(() => {
			const sidebar = document.querySelector('.app-sidebar');
			if (!sidebar) return;

			// For collapsible mode: expand on hover (non-mobile)
			if (this.baseLayout === 'collapsible' && !this.isMobile) {
				sidebar.addEventListener('mouseenter', () => {
					sidebar.classList.add('expanded');
				});

				sidebar.addEventListener('mouseleave', () => {
					sidebar.classList.remove('expanded');
					this.hideSubmenu();
				});
			}
			this.submenuInitialized = true;
		}, 150);
	}

	public applyMiniMode(): void {
		setTimeout(() => {
			this.applyResponsiveLayout();
		}, 200);
	}

	// ==================== Menu Toggle Handler ====================

	public handleMenuToggle(): void {
		const layout = this.baseLayout;

		if (layout === 'sidebar-fixed') {
			if (this.isMobile) {
				// Mobile: toggle drawer
				this.toggleDrawer();
			} else if (this.isTablet) {
				// Tablet: always mini, just close submenus
				this.hideSubmenu();
			} else {
				// Desktop: toggle mini mode (unless POS/Kitchen)
				if (!this.app.isAlwaysMiniRoute()) {
					this.toggleMiniMode();
				} else {
					this.hideSubmenu();
				}
			}
		} else if (layout === 'collapsible') {
			if (this.isMobile) {
				// Mobile: toggle drawer
				this.toggleDrawer();
			} else {
				// Tablet/Desktop: toggle expanded state
				this.toggleCollapsible();
			}
		} else if (layout === 'drawer') {
			// Always drawer: toggle
			this.toggleDrawer();
		}
	}

	private toggleDrawer(): void {
		const sidebar = document.querySelector('.app-sidebar');
		const overlay = document.querySelector('.layout-overlay');

		if (sidebar?.classList.contains('open')) {
			this.closeSidebar();
		} else {
			sidebar?.classList.add('open');
			overlay?.classList.add('active');
			document.body.style.overflow = 'hidden';
		}
	}

	private toggleMiniMode(): void {
		const body = document.body;
		const isCurrentlyMini = body.classList.contains('mini-active');

		body.classList.toggle('mini-active');
		localStorage.setItem('gorestofy_SidebarMinified', (!isCurrentlyMini).toString());

		if (!isCurrentlyMini) {
			this.hideSubmenu();
		}
	}

	private toggleCollapsible(): void {
		const sidebar = document.querySelector('.app-sidebar');
		if (!sidebar) return;

		const isExpanded = sidebar.classList.contains('expanded');

		if (isExpanded) {
			sidebar.classList.remove('expanded');
			this.hideSubmenu();
		} else {
			sidebar.classList.add('expanded');
			setTimeout(() => {
				if (!sidebar.matches(':hover')) {
					sidebar.classList.remove('expanded');
					this.hideSubmenu();
				}
			}, 3000);
		}
	}

	public closeSidebar(): void {
		const sidebar = document.querySelector('.app-sidebar');
		const overlay = document.querySelector('.layout-overlay');

		sidebar?.classList.remove('open', 'expanded');
		overlay?.classList.remove('active');
		document.body.style.overflow = '';
		//this.hideSubmenu();
	}

	// ==================== Navigation Management ====================

	private initializeNavigation(): void {
		if (this.navInitialized) return;

		setTimeout(() => {
			document.addEventListener('click', this.handleNavigationClick.bind(this));
			this.setActiveNavigation();
			this.navInitialized = true;
		}, 150);
	}

	private handleNavigationClick(event: Event): void {
		const target = event.target as HTMLElement;
		const menuItem = target.closest('.has-submenu') as HTMLElement;
		const menuLink = target.closest('a') as HTMLElement;

		if (menuItem && menuLink && menuLink.parentElement === menuItem) {
			event.preventDefault();
			event.stopPropagation();
			this.toggleSubmenu(menuItem);
			return;
		}

		if (menuLink) {
			const layout = document.body.getAttribute('data-theme-layout');
			const isMini = document.body.classList.contains('mini-active');
			// Close drawer on navigation (non-mobile drawer closes manually)
			if (layout === 'drawer') {
				setTimeout(() => {
					this.closeSidebar();
				}, 100);
			}
			if (layout === 'sidebar-fixed' && isMini) {
				setTimeout(() => {
					this.hideSubmenu();
				}, 100);
			}
			this.setActiveNavigationItem(menuLink);
		}
	}

	private toggleSubmenu(menuItem: HTMLElement): void {
		const isOpen = menuItem.classList.contains('open');
		const shouldShowBackdrop = this.shouldShowSubmenuBackdrop();

		// Close sibling submenus
		const parent = menuItem.parentElement;
		if (parent) {
			parent.querySelectorAll(':scope > .has-submenu').forEach(sibling => {
				if (sibling !== menuItem) {
					sibling.classList.remove('open');
				}
			});
		}

		menuItem.classList.toggle('open', !isOpen);

		if (shouldShowBackdrop) {
			this.updateSubmenuBackdrop();
		}
	}

	private shouldShowSubmenuBackdrop(): boolean {
		return (
			this.baseLayout === 'sidebar-fixed' &&
			(document.body.classList.contains('mini-active') || this.isTablet)
		);
	}

	private updateSubmenuBackdrop(): void {
		const anySubmenuOpen = document.querySelectorAll('.has-submenu.open').length > 0;
		this.isMiniSubmenuOpen = anySubmenuOpen;

		const miniOverlay = document.querySelector('.mini-overlay');
		if (anySubmenuOpen) {
			miniOverlay?.classList.add('active');
		} else {
			miniOverlay?.classList.remove('active');
		}
	}

	public hideSubmenu(): void {
		document.querySelectorAll('.has-submenu.open').forEach(submenu => {
			submenu.classList.remove('open');
		});

		this.isMiniSubmenuOpen = false;
		document.querySelector('.mini-overlay')?.classList.remove('active');
	}

	private setActiveNavigationItem(linkElement: HTMLElement): void {
		document.querySelectorAll('.menu li.active, .menu .has-submenu.parent-active')
			.forEach(item => item.classList.remove('active', 'parent-active'));

		const listItem = linkElement.closest('li');
		if (listItem) {
			let currentParent = listItem.parentElement?.closest('li.has-submenu');

			if (currentParent) {
				listItem.classList.add('active');
			}

			while (currentParent) {
				currentParent.classList.add('parent-active', 'active', 'open');
				currentParent = currentParent.parentElement?.closest('li.has-submenu');
			}

			if (this.shouldShowSubmenuBackdrop()) {
				this.updateSubmenuBackdrop();
			}
		}
	}

	private setActiveNavigation(): void {
		const currentPath = window.location.pathname;
		const navLinks = document.querySelectorAll('.menu a[routerLink]');
		let bestMatch: HTMLElement | null = null;
		let bestMatchLength = 0;

		navLinks.forEach(link => {
			const routerLink = link.getAttribute('routerLink');
			if (routerLink) {
				if (routerLink === currentPath) {
					bestMatch = link as HTMLElement;
					bestMatchLength = routerLink.length;
				} else if (routerLink !== '/' && currentPath.startsWith(routerLink) && routerLink.length > bestMatchLength) {
					bestMatch = link as HTMLElement;
					bestMatchLength = routerLink.length;
				}
			}
		});

		if (bestMatch) {
			this.setActiveNavigationItem(bestMatch);
		} else if (currentPath === '/') {
			const homeLink = document.querySelector('.menu a[routerLink="/"]') as HTMLElement;
			if (homeLink) {
				this.setActiveNavigationItem(homeLink);
			}
		}
	}

	// ==================== Theme Management ====================

	public toggleDarkMode(): void {
		this.app.toggleDarkMode();
	}

	// ==================== Modal Management ====================

	public showLanguageModal(): void {
		this.languageModal.show = true;
	}

	public closeLanguageModal(): void {
		this.languageModal.show = false;
	}

	public GetCountry(languageCode: string): string {
		const parts = languageCode?.split('-') || [];
		return parts.length > 1 ? parts[1].toLowerCase() : 'us';
	}

	public ChangeLanguage(name: string): void {
		this.languageModal.loading = true;

		try {
			this.app.reloadLocalizationData(name);
			this.languageModal.show = false;
		} catch (error) {
			this.app.showErrorMessage('Error', 'Failed to change language');
		} finally {
			this.languageModal.loading = false;
		}
	}

	public ChangeLocation(id: any): void {
		this.app.updateSelectedLocation(id);
	}

	// ==================== Utility Methods ====================

	public hasPermission(permission: string): boolean {
		return this.app.hasPermission(permission);
	}

	public hasSomePermission(permission: string): boolean {
		return this.app.hasSomePermission(permission);
	}

	public getCurrentLanguage(): string {
		return this.app.getRegionName();
	}

	public isCurrentRoute(route: string): boolean {
		return window.location.pathname === route;
	}

	private initPasswordToggle(): void {
		document.addEventListener('click', (event: Event) => {
			const target = event.target as HTMLElement;
			const button = target.closest('.toggle-password') as HTMLElement;
			if (!button) return;

			const targetSelector = button.getAttribute('data-target');
			if (!targetSelector) return;

			const input = document.querySelector<HTMLInputElement>(targetSelector);
			if (!input) return;

			input.type = input.type === 'password' ? 'text' : 'password';

			const icon = button.querySelector('i');
			if (icon) {
				icon.classList.toggle('ri-eye-line');
				icon.classList.toggle('ri-eye-off-line');
			}
		});
	}

	private initKeyboardShortcuts(): void {
		document.addEventListener('keydown', (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
				event.preventDefault();
				const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
				searchInput?.focus();
			}

			if (event.key === 'Escape') {
				this.closeSidebar();
				this.hideSubmenu();
				this.closeLanguageModal();
			}

			if (event.altKey && event.key === 'm') {
				event.preventDefault();
				this.handleMenuToggle();
			}
		});
	}
}
