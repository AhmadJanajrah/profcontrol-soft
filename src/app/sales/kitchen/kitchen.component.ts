import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppService } from '../../services/app.service';
import * as signalR from '@microsoft/signalr';
import { SoundService } from '../../services/sound.service';
import { AppImports } from '../../app.imports';

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
  selector: 'app-kitchen',
  templateUrl: './kitchen.component.html',
  standalone: true,
  imports: [AppImports]
})
export class KitchenComponent implements OnInit, OnDestroy {

  private hubConnection?: signalR.HubConnection;

  // Connection state
  public signalRState: 'Connected' | 'Disconnected' | 'Connecting' = 'Disconnected';

  OrderStatus = OrderStatus;

  // Loading states
  public isLoading = false;
  public isMarkingReady = false;

  // Kitchen data
  private allOrdersCache: any[] = [];
  public filteredOrders: any[] = [];

  // Filter options
  public activeFilter: number = 0;

  public filterOptions = [
    { key: OrderType.DineIn, label: 'Dine In', icon: 'ri-store-2-line' },
    { key: OrderType.Takeaway, label: 'Takeaway', icon: 'ri-shopping-bag-2-line' },
    { key: OrderType.Delivery, label: 'Delivery', icon: 'ri-truck-line' }
  ];

  public selectedOrderType = null as number | null;
  public searchTerm: string = '';

  // Current time for age calculations
  public currentTime: Date = new Date();
  private timeUpdateInterval?: number;

  constructor(
    private http: HttpClient,
    public app: AppService,
    private sound: SoundService
  ) {
    this.filterOptions
  }

  ngOnInit(): void {
    this.loadKitchenOrders();
    this.setupSignalR();
  }

  ngOnDestroy(): void {
    if (this.hubConnection) {
      this.hubConnection.stop().catch(err => console.error('Error stopping SignalR connection:', err));
    }

    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
  }

  /**
   * Load kitchen orders from API
   */
  private loadKitchenOrders(): void {
    this.isLoading = true;

    this.http.get<any>('/api/kitchen/getkitchenorders', {
      params: { locationId: this.app.getSelectedLocationId().toString() }
    }).subscribe({
      next: (response) => {
        this.allOrdersCache = response.data || [];
        this.isLoading = false;
        this.applyFilters(this.activeFilter);
      },
      error: (error) => {
        this.app.handleApiError(error);
        this.allOrdersCache = [];
        this.filteredOrders = [];
        this.isLoading = false;
      }
    });
  }

  /** 
   * Apply filters to orders
   */
  public applyFilters(orderType: number): void {
    if (this.activeFilter === orderType) {
      this.filteredOrders = this.allOrdersCache;
      this.activeFilter = 0;
      return;
    };
    this.activeFilter = orderType;
    this.filteredOrders = this.allOrdersCache.filter(order => {
      return order.orderType === orderType;
    });
  }

  /**
   * Search orders by customer name or order number
   */
  public searchOrders(): void {
    const searchTerm = this.searchTerm.toLowerCase();
    this.filteredOrders = this.allOrdersCache.filter(order => {
      return order.customer?.customerName.toLowerCase().includes(searchTerm) ||
        order.id.toString().includes(searchTerm);
    });
  }

  /**
   * Setup SignalR connection
   */
  private setupSignalR(): void {
    this.signalRState = 'Connecting';

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('/hub/notificationhub', {
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
      console.log('Received order update via SignalR:', orderData);
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
    if (data.status !== OrderStatus.Pending && data.status !== OrderStatus.InProgress && data.status !== OrderStatus.Ready) {
      this.allOrdersCache = this.allOrdersCache.filter(o => o.id !== data.id);
      this.filteredOrders = this.filteredOrders.filter(o => o.id !== data.id);
    } else {
      // Fetch updated order
      this.http.get<any>(`/api/kitchen/getkitchenorder/${data.id}`).subscribe({
        next: (response) => {
          const updatedOrder = response.data || null;
          if (updatedOrder.status !== OrderStatus.Pending && updatedOrder.status !== OrderStatus.InProgress && updatedOrder.status !== OrderStatus.Ready) {
            this.allOrdersCache = this.allOrdersCache.filter(o => o.id !== updatedOrder.id);
            this.filteredOrders = this.filteredOrders.filter(o => o.id !== updatedOrder.id);
            return;
          }
          const index = this.allOrdersCache.findIndex(o => o.id === updatedOrder?.id);

          if (index > -1) {
            this.allOrdersCache[index] = updatedOrder;
          } else {
            this.allOrdersCache.unshift(updatedOrder);
            this.sound.notification();
          }
        }
      });
    }
  }

  /**
   * Mark order as ready
   */
  public markOrderReady(orderId: any): void {
    const order = this.allOrdersCache.find(o => o.id === orderId);
    if (!order || order.status !== OrderStatus.InProgress) return;

    this.app.confirmDialog(
      this.app.localize('Confirm Action'),
      this.app.localize('Are you sure you want to mark this order as ready?'),
      () => {
        this.isMarkingReady = true;
        const dialogId = this.app.showLoadingDialog('Processing...');
        this.http.post<any>('/api/kitchen/markorderready', null, {
          params: {
            orderId: order.id.toString()
          }
        }).subscribe({
          next: () => {
            this.app.showSuccessMessage(
              this.app.localize('Success!'),
              this.app.localize('Order marked as ready.')
            );
            this.isMarkingReady = false;
            this.app.closeLoadingDialog(dialogId);
          },
          error: (error) => {
            this.app.handleApiError(error);
            this.isMarkingReady = false;
            this.app.closeLoadingDialog(dialogId);
          }
        });
      },
      () => { },
      `<i class="ri-check-line"></i>` + this.app.localize('Mark Ready'),
      `<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
      'info'
    );
  }

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
   * Generate avatar initials
   */
  public generateAvatar(customerName: string): string {
    if (!customerName) return 'W';
    const parts = customerName.split(' ');
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return customerName.charAt(0) + (customerName.charAt(1) || '');
  }

  /**
   * Generate avatar color
   */
  public generateAvatarColor(orderId: number): string {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return colors[orderId % colors.length];
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
      case OrderStatus.Ready: return this.app.localize('Ready');
      case OrderStatus.InProgress: return this.app.localize('In Progress');
      default: return this.app.localize('Unknown');
    }
  }

  /**
   * Get status badge class
   */
  public getStatusBadgeClass(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.Pending: return 'badge badge-light';
      case OrderStatus.Ready: return 'badge badge-info';
      case OrderStatus.InProgress: return 'badge badge-warning';
      case OrderStatus.Completed: return 'badge badge-primary';
      case OrderStatus.Cancelled: return 'badge badge-danger';
      default: return 'badge badge-light';
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
}
