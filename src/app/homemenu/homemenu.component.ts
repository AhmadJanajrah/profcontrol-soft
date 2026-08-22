import { Component, OnInit, Inject } from '@angular/core';
import { AppService } from '../services/app.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AppImports } from '../app.imports';

interface QuickAccessMenu {
	title: string;
	icon: string;
	route: string;
	permission: string;
	color: string;
}

@Component({
	selector: 'homemenu',
	templateUrl: './homemenu.component.html',
	standalone: true,
	imports: [AppImports]
})
export class HomeMenuComponent implements OnInit {
	public quickAccessMenus: QuickAccessMenu[] = [];

	constructor(
		private http: HttpClient,
		public app: AppService,
		private router: Router
	) { }

	ngOnInit(): void {
		this.initializeQuickAccessMenus();
	}

	private initializeQuickAccessMenus(): void {
		const allMenus: QuickAccessMenu[] = [
			{
				title: 'Dashboard',
				icon: 'ri-dashboard-line',
				route: '/dashboard',
				permission: 'dashboard',
				color: 'primary'
			},
			{
				title: 'POS',
				icon: 'ri-cash-line',
				route: '/sales/pos',
				permission: 'sales.pos',
				color: 'success'
			},
			{
				title: 'Kitchen',
				icon: 'ri-restaurant-2-line',
				route: '/sales/kitchen',
				permission: 'sales.kitchen',
				color: 'warning'
			},
			{
				title: 'Orders',
				icon: 'ri-clipboard-line',
				route: '/sales/orders/list',
				permission: 'sales.orderlist',
				color: 'info'
			},
			{
				title: 'Customers',
				icon: 'ri-user-3-line',
				route: '/customers/list',
				permission: 'customers.list',
				color: 'purple'
			},
			{
				title: 'Products',
				icon: 'ri-restaurant-line',
				route: '/products/items/list',
				permission: 'products.itemlist',
				color: 'pink'
			},
			{
				title: 'Inventory',
				icon: 'ri-box-3-line',
				route: '/inventory/stocks',
				permission: 'inventory.stocks',
				color: 'teal'
			},
			{
				title: 'Reports',
				icon: 'ri-file-list-3-line',
				route: '/reports/salereport',
				permission: 'reports',
				color: 'danger'
			},
			{
				title: 'Settings',
				icon: 'ri-settings-5-line',
				route: '/settings/systemconfig',
				permission: 'settings.systemconfig',
				color: 'secondary'
			}
		];

		// Filter menus based on user permissions
		this.quickAccessMenus = allMenus.filter(menu =>
			this.app.hasSomePermission(menu.permission)
		);
	}

	public navigateTo(route: string): void {
		this.router.navigate([route]);
	}

	public getGreeting(): string {
		const hour = new Date().getHours();
		if (hour < 12) return this.app.localize('Good Morning');
		if (hour < 18) return this.app.localize('Good Afternoon');
		return this.app.localize('Good Evening');
	}

	public getUserName(): string {
		return this.app.getUserAttribute('fullName') || this.app.localize('User');
	}

	public getUserImage(): string {
		return this.app.apiUrl('/api/media/userimage/' + this.app.getUserAttribute('profileImageUrl'));
	}
}