import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppService } from '../services/app.service';
import * as signalR from '@microsoft/signalr';
import { SoundService } from '../services/sound.service';
import { AppImports } from '../app.imports';

export enum OrderStatus {
	Pending = 1,
	InProgress = 2,
	Ready = 3,
	Completed = 4,
	Cancelled = 5
}

export enum OrderType {
	DineIn = 1,
	Takeaway = 2,
	Delivery = 3,
	Online = 4
}

@Component({
	selector: 'app-waiter',
	templateUrl: './waiter.component.html',
	standalone: true,
	imports: [AppImports]
})
export class WaiterComponent implements OnInit, OnDestroy {

	private hubConnection?: signalR.HubConnection;

	// Connection state
	public signalRState: 'Connected' | 'Disconnected' | 'Connecting' = 'Disconnected';

	// Enums for template
	OrderStatus = OrderStatus;
	OrderType = OrderType;

	// Loading states
	public isLoading = false;

	// Waiter data
	private allOrdersCache: any[] = [];
	public filteredOrders: any[] = [];

	// Detail modal state
	public detailModal = {
		show: false,
		loading: false,
		title: ''
	};

	// Selected order for modal
	public selectedOrder: any = null;

	// Filter options
	public activeFilter: number = 0;

	// Search
	public searchTerm: string = '';

	constructor(
		private http: HttpClient,
		public app: AppService,
		private sound: SoundService
	) { }

	// --- Lifecycle Hooks ---

	ngOnInit(): void {
		this.loadWaiterOrders();
		this.setupSignalR();
		window.addEventListener('popstate', this.onPopState);
	}

	ngOnDestroy(): void {
		if (this.hubConnection) {
			this.hubConnection.stop().catch(err => console.error('Error stopping SignalR connection:', err));
		}
		window.removeEventListener('popstate', this.onPopState);
	}

	// --- Data Loading Methods ---

	/**
	 * Load waiter orders from API
	 */
	private loadWaiterOrders(): void {
		this.isLoading = true;

		this.http.get<any>('/api/waiter/getwaiterorders', {
			params: { locationId: this.app.getSelectedLocationId().toString() }
		}).subscribe({
			next: (response) => {
				this.allOrdersCache = response.data || [];
				this.applyCurrentFilter();
				this.isLoading = false;
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.allOrdersCache = [];
				this.filteredOrders = [];
				this.isLoading = false;
			}
		});
	}

	// --- Filter Methods ---

	/**
	 * Apply filters to orders
	 */
	public applyFilters(statusFilter: number): void {
		if (this.activeFilter === statusFilter) {
			this.filteredOrders = this.allOrdersCache;
			this.activeFilter = 0;
			return;
		}
		this.activeFilter = statusFilter;
		this.filteredOrders = this.allOrdersCache.filter(order => {
			return order.status === statusFilter;
		});
	}

	/**
	 * Search orders by customer name, order number, or table
	 */
	public searchOrders(): void {
		const searchTerm = this.searchTerm.toLowerCase().trim();
		if (!searchTerm) {
			this.applyCurrentFilter();
			return;
		}

		let ordersToFilter = this.activeFilter !== 0
			? this.allOrdersCache.filter(order => order.status === this.activeFilter)
			: this.allOrdersCache;

		this.filteredOrders = ordersToFilter.filter(order => {
			return order.customer?.fullName?.toLowerCase().includes(searchTerm) ||
				order.id.toString().includes(searchTerm) ||
				order.table?.tableNumber?.toLowerCase().includes(searchTerm);
		});
	}

	/**
	 * Reapply current filter
	 */
	private applyCurrentFilter(): void {
		if (this.activeFilter !== 0) {
			this.filteredOrders = this.allOrdersCache.filter(order => order.status === this.activeFilter);
		} else {
			this.filteredOrders = [...this.allOrdersCache];
		}

		// Reapply search if active
		if (this.searchTerm.trim()) {
			this.searchOrders();
		}
	}

	// --- SignalR Methods ---

	/**
	 * Setup SignalR connection
	 */
	private setupSignalR(): void {
		this.signalRState = 'Connecting';

		this.hubConnection = new signalR.HubConnectionBuilder()
			.withUrl(this.app.hubUrl(), {
				accessTokenFactory: () => this.app.getJwtToken() || ''
			})
			.withAutomaticReconnect()
			.build();

		this.hubConnection.onreconnecting(() => {
			this.signalRState = 'Connecting';
		});

		this.hubConnection.onreconnected(() => {
			this.signalRState = 'Connected';
		});

		this.hubConnection.onclose(() => {
			this.signalRState = 'Disconnected';
		});

		// Handle order updates
		this.hubConnection.on('Order', (orderData: any) => {
			this.handleOrderUpdate(orderData);
		});

		// Start connection
		this.hubConnection.start()
			.then(() => {
				this.signalRState = 'Connected';
			})
			.catch(() => {
				this.signalRState = 'Disconnected';
				setTimeout(() => this.setupSignalR(), 5000);
			});
	}

	/**
	 * Handle real-time order updates
	 */
	private handleOrderUpdate(data: { id: number, status: number }): void {
		// Remove completed/cancelled orders
		if (data.status === OrderStatus.Completed || data.status === OrderStatus.Cancelled) {
			this.allOrdersCache = this.allOrdersCache.filter(o => o.id !== data.id);
			this.applyCurrentFilter();

			// Close modal if the updated order is currently displayed
			if (this.selectedOrder?.id === data.id) {
				this.closeDetailModal();
			}
		} else {
			// Fetch updated order
			this.http.get<any>(`/api/waiter/getwaiterorder/${data.id}`).subscribe({
				next: (response) => {
					const updatedOrder = response.data;
					if (updatedOrder.status === OrderStatus.Completed || updatedOrder.status === OrderStatus.Cancelled) {
						this.allOrdersCache = this.allOrdersCache.filter(o => o.id !== updatedOrder.id);
						this.applyCurrentFilter();

						// Close modal if the updated order is currently displayed
						if (this.selectedOrder?.id === updatedOrder.id) {
							this.closeDetailModal();
						}
						return;
					}
					const index = this.allOrdersCache.findIndex(o => o.id === updatedOrder?.id);

					if (index > -1) {
						// Update existing order
						this.allOrdersCache[index] = updatedOrder;

						// Update modal if this order is currently displayed
						if (this.selectedOrder?.id === updatedOrder.id)
							this.selectedOrder = updatedOrder;
					} else {
						// New order assigned to waiter
						this.allOrdersCache.unshift(updatedOrder);
						this.sound.notification();
					}

					this.applyCurrentFilter();
				},
				error: (error) => {
					// Order might have been removed or access denied
					this.allOrdersCache = this.allOrdersCache.filter(o => o.id !== data.id);
					this.applyCurrentFilter();

					if (this.selectedOrder?.id === data.id) {
						this.closeDetailModal();
					}
				}
			});
		}
	}

	// --- Detail Modal Methods ---

	/**
	 * Open order detail modal
	 */
	public openDetailModal(order: any): void {
		if (!order || order.id <= 0) return;

		this.detailModal.loading = true;
		this.detailModal.title = `${this.app.localize('Order')} #${order.id}`;
		this.detailModal.show = true;
		this.selectedOrder = null;

		// Fetch full order details
		this.http.get<any>(`/api/waiter/getwaiterorder/${order.id}`).subscribe({
			next: (response) => {
				this.selectedOrder = response.data;
				this.detailModal.loading = false;
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.closeDetailModal();
			}
		});

		history.pushState(null, '', `${window.location.pathname}#vieworder`);
	}

	/**
	 * Close order detail modal
	 */
	public closeDetailModal(): void {
		this.detailModal.show = false;
		this.detailModal.loading = false;
		this.selectedOrder = null;
		try {
			history.back();
		} catch {
			/* ignore */
		}
	}

	// --- Helper Methods ---

	/**
	 * Format modifiers for display
	 */
	public formatModifiers(modifiers: any[]): string {
		if (!Array.isArray(modifiers) || modifiers.length === 0) {
			return '';
		}
		return modifiers
			.map(m => m?.modifierOption?.optionName)
			.filter(Boolean)
			.join(', ');
	}

	/**
	 * Get order type display name
	 */
	public getOrderTypeDisplayName(orderType: number): string {
		switch (orderType) {
			case OrderType.DineIn: return this.app.localize('Dine In');
			case OrderType.Takeaway: return this.app.localize('Takeaway');
			case OrderType.Delivery: return this.app.localize('Delivery');
			case OrderType.Online: return this.app.localize('Online');
			default: return this.app.localize('Unknown');
		}
	}

	/**
	 * Get status display name
	 */
	public getStatusDisplayName(status: OrderStatus): string {
		switch (status) {
			case OrderStatus.Pending: return this.app.localize('Pending');
			case OrderStatus.InProgress: return this.app.localize('In Progress');
			case OrderStatus.Ready: return this.app.localize('Ready');
			case OrderStatus.Completed: return this.app.localize('Completed');
			case OrderStatus.Cancelled: return this.app.localize('Cancelled');
			default: return this.app.localize('Unknown');
		}
	}

	/**
	 * Get status badge class
	 */
	public getStatusBadgeClass(status: OrderStatus): string {
		switch (status) {
			case OrderStatus.Pending: return 'badge-warning';
			case OrderStatus.InProgress: return 'badge-primary';
			case OrderStatus.Ready: return 'badge-info';
			case OrderStatus.Completed: return 'badge-success';
			case OrderStatus.Cancelled: return 'badge-danger';
			default: return 'badge-secondary';
		}
	}

	/**
	 * Get order type badge class
	 */
	public getOrderTypeBadgeClass(orderType: number): string {
		switch (orderType) {
			case OrderType.DineIn: return 'badge-primary';
			case OrderType.Takeaway: return 'badge-info';
			case OrderType.Delivery: return 'badge-success';
			case OrderType.Online: return 'badge-light';
			default: return 'badge-secondary';
		}
	}

	/**
	 * Get SignalR status class
	 */
	public getSignalRStatusClass(): string {
		switch (this.signalRState) {
			case 'Connected': return 'text-success';
			case 'Connecting': return 'text-warning';
			case 'Disconnected': return 'text-danger';
		}
	}

	/**
	 * Get SignalR status icon
	 */
	public getSignalRStatusIcon(): string {
		switch (this.signalRState) {
			case 'Connected': return 'ri-wifi-line';
			case 'Connecting': return 'ri-loader-line spin';
			case 'Disconnected': return 'ri-wifi-off-line';
		}
	}

	// --- Window Event Handlers ---

	/**
	 * Handle browser back navigation for modals
	 */
	private onPopState = (): void => {
		if (this.detailModal.show) {
			this.closeDetailModal();
		}
	};
}