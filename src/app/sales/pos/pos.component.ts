import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { AppService } from '../../services/app.service';
import { FloorService, FloorArea, FloorTable } from '../../services/floor.service';
import * as signalR from '@microsoft/signalr';
import { NgForm } from '@angular/forms';
import { SoundService } from '../../services/sound.service';
import { AppImports } from '../../app.imports';

// Enums matching SalesController exactly
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

export enum TableStatus {
  Available = 1,
  Reserved = 2,
  Occupied = 3,
  Maintenance = 4
}

export enum ItemType {
  Recipe = 1,
  Ingredient = 2,
  Retail = 3,
  Combo = 4,
  Service = 5
}

/**
 * Point of Sale (POS) Component
 * 
 * Features:
 * - Accurate server-side calculation matching CalculateOrderTotals
 * - Real-time SignalR integration with NotificationHub
 * - Comprehensive order management (Create, Update, Process, Split, Refund)
 * - Payment processing with multiple methods and validation
 * - Processing fees calculation and display
 * - Cash register operations (Open/Close with session tracking)
 * - Customer and loyalty management with search capabilities
 * - Floor plan and table management with visual selection
 * - Offline order capabilities with automatic synchronization
 * - Kitchen printing and receipt generation
 * - Coupon validation and application
 * - Bill splitting with item-level granularity
 * - Hold/Recall order functionality
 * - Complete modifier support with validation
 * - Mobile-responsive design with touch optimization
 * - Proper item sorting by name, price, and category
 * - Browser back button support for all modals
 */
@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  standalone: true,
  imports: [AppImports]
})
export class POSComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('floorCanvas') floorCanvasRef!: ElementRef<HTMLDivElement>;

  // Lifecycle management
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private hubConnection?: signalR.HubConnection;
  private networkStatus$ = new Subject<boolean>();
  private isOnline = true;

  // Enums for template
  OrderType = OrderType;
  OrderStatus = OrderStatus;
  TableStatus = TableStatus;
  ItemType = ItemType;
  Math = Math;

  // Configuration options
  public orderStatusOptions = [
    { value: OrderStatus.Pending, label: 'Pending', class: 'badge-light' },
    { value: OrderStatus.Ready, label: 'Ready', class: 'badge-info' },
    { value: OrderStatus.InProgress, label: 'In Progress', class: 'badge-warning' },
    { value: OrderStatus.Completed, label: 'Completed', class: 'badge-primary' },
    { value: OrderStatus.Cancelled, label: 'Cancelled', class: 'badge-danger' },
  ];

  public orderTypeOptions = [
    { value: OrderType.DineIn, label: 'Dine In', class: 'badge-primary', icon: 'ri-store-2-line' },
    { value: OrderType.Takeaway, label: 'Takeaway', class: 'badge-info', icon: 'ri-shopping-bag-line' },
    { value: OrderType.Delivery, label: 'Delivery', class: 'badge-success', icon: 'ri-truck-line' },
  ];

  // Loading and connection states
  public isLoading = true;
  public isLoadingItems = false;
  public isSyncing = false;
  public signalRStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

  // Core data
  public locationId = 1;
  public categories: any[] = [];
  public items: any[] = [];
  public filteredItems: any[] = [];
  public cart: any[] = [];
  public paymentMethods: any[] = [];
  public taxRates: any[] = [];
  public discounts: any[] = [];
  public charges: any[] = [];
  public filteredCharges: any[] = [];
  public tables: FloorTable[] = [];
  public floorAreas: FloorArea[] = [];
  public selectedFloor: FloorArea | null = null;
  public cashRegisters: any[] = [];
  public openedCashRegisters: any[] = [];
  public activeOrders: any[] = [];
  public printingOrderId: number | null = null;
  public offlineOrders: any[] = [];
  public heldOrder: any = null;
  public waiterOrDrivers: any[] = [];

  // POS Settings
  public posSettings: any = {
    isTaxInclusive: false,
    isTaxBeforeDiscount: false,
    isTaxOrderLevel: true,
    isDiscountOrderLevel: true,
    isKitchenPrinting: false
  };

  public generalSettings: any = {
    companyName: '',
    companyPhone: '',
    companyEmail: '',
    companyTaxNumber: ''
  };

  // UI state
  public selectedCategoryId: number | null = null;
  public searchTerm = '';
  public viewMode: 'grid' | 'list' = 'grid';
  public sortBy: 'name' | 'price' | 'category' = 'name';
  public sortDirection: 'asc' | 'desc' = 'asc';
  public selectedPaymentMethod: any = null;
  public showMobileCart = false;
  public isMobileView = false;

  // Floor plan properties
  private canvasScale = 1;
  private canvasWidth = 0;
  private canvasHeight = 0;

  // Order state
  public order: any = {
    id: 0,
    orderType: OrderType.DineIn,
    customerId: null,
    customer: null,
    customerName: '',
    guests: 1,
    tableId: null,
    table: null,
    registerId: null,
    taxRateId: null,
    taxRate: null,
    discountId: null,
    discount: null,
    chargeId: null,
    charge: null,
    couponCode: '',
    couponDiscount: 0,
    waiterOrDriver: null,

    // Financial calculations
    subTotal: 0,
    discountAmount: 0,
    discountTotal: 0,
    taxAmount: 0,
    chargeAmount: 0,
    totalAmount: 0,
    totalPayable: 0,

    // Payment fields
    paidAmount: 0,
    changeAmount: 0,
    remainingAmount: 0,
    processingFee: 0,
    tipAmount: 0,
    loyaltyPointsEarned: 0,
    loyaltyPointsRedeemed: 0,

    notes: '',
    specialInstructions: ''
  };

  // Modal states
  public modals = {
    dataSync: {
      show: false,
      loading: false,
      selectedOrderIds: [] as number[],
      syncingOrderIds: [] as number[],
      successIds: [] as number[],
      failedIds: [] as number[],
    },
    cashRegister: {
      show: false,
      loading: false,
      submitted: false,
      openingCash: 0,
      closingCash: 0,
      notes: '',
      registerId: 0
    },
    activeOrders: {
      show: false,
      loading: false
    },
    orderConfig: {
      show: false,
      loading: false,
      validated: false,
      selectedFloorId: 0,
      tableViewMode: 'floor' as 'floor' | 'list'
    },
    itemDetail: {
      show: false,
      loading: false,
      item: null as any,
      selectedModifiers: [] as any[],
      selectedModifierId: null as number | null,
      selectedImageIndex: 0 as number,
      quantity: 1,
      notes: '',
      validated: false,
      isEdit: false,
      cartItemId: null as string | null
    },
    payment: {
      show: false,
      loading: false,
      validated: false,
      paidAmount: '0',
      tipAmount: 0,
      changeAmount: 0,
      processingFee: 0,
      remainingAmount: 0,
      totalPayable: 0,
      paymentReference: '',
      loyaltyPointsRedeemed: 0
    },
    customerChange: {
      show: false,
      loading: false,
      activeTab: 'search',
      searchValue: '',
      newCustomer: {} as any,
      validated: false,
      submitted: false,
      searchResults: [] as any[]
    },
    kitchenPrint: {
      show: false,
      loading: false,
      orderData: null as any
    },
    splitBill: {
      show: false,
      loading: false,
      newCustomerId: 0,
      guestCount: 1,
      splitQuantities: new Map<string, number>()
    }
  };

  constructor(
    private http: HttpClient,
    public app: AppService,
    public floorService: FloorService,
    private sound: SoundService
  ) {
    this.orderStatusOptions.forEach(opt => { opt.label = this.app.localize(opt.label); });
    this.orderTypeOptions.forEach(opt => { opt.label = this.app.localize(opt.label); });

    this.locationId = this.app.getSelectedLocationId() || 1;
    this.setupSearch();
    this.checkMobileView();
    this.setupNetworkListeners();
  }

  public get currentOrder(): any { return this.order; }
  public get selectedCustomer(): any { return this.order?.customer; }
  public get selectedTable(): FloorTable | null { return this.order?.table || null; }

  ngOnInit(): void {
    this.loadPOSData();
    this.loadFloorData();
    this.loadOfflineOrders();
    this.loadHeldOrder();
    this.setupSignalR();
    this.setupFloorService();
    this.startBackgroundSync();
    window.addEventListener('popstate', this.onPopState);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.selectedFloor) {
        this.renderFloorPlan();
      }
      this.app.loadImages('[data-img="true"]');
    }, 500);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('popstate', this.onPopState);
    if (this.hubConnection) {
      this.hubConnection.stop().catch(err => {
        //console.error('Error stopping SignalR connection:', err);
      });
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.checkMobileView();
    if (this.selectedFloor) {
      setTimeout(() => this.renderFloorPlan(), 100);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: any): void {
    if (this.cart.length > 0) {
      event.returnValue = this.app.localize('You have items in your cart. Are you sure you want to leave?');
    }
  }

  @HostListener('window:online')
  onNetworkOnline(): void {
    this.isOnline = true;
    this.networkStatus$.next(true);
    this.setupSignalR();
  }

  @HostListener('window:offline')
  onNetworkOffline(): void {
    this.isOnline = false;
    this.networkStatus$.next(false);
    this.signalRStatus = 'disconnected';
  }

  /*
  |-------------------------------------------------------------------------- 
  | INITIALIZATION & SETUP
  |-------------------------------------------------------------------------- 
  */

  private setupNetworkListeners(): void {
    this.networkStatus$.pipe(
      takeUntil(this.destroy$),
      debounceTime(1000)
    ).subscribe(online => {
      if (online) {
        //console.log('Network connection restored');
        this.checkOfflineOrders();
      } else {
        //console.log('Network connection lost');
      }
    });

    this.isOnline = navigator.onLine;
  }

  private checkMobileView(): void {
    this.isMobileView = window.innerWidth < 992;
    if (!this.isMobileView) {
      this.showMobileCart = false;
    }
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm = term;
      this.filterItems();
    });
  }

  public startBackgroundSync(): void {
    setInterval(() => {
      if (this.isOnline && this.offlineOrders.length > 0 && this.signalRStatus === 'connected') {
        this.checkOfflineOrders();
      }
    }, 300000);
  }

  private checkOfflineOrders(): void {
    if (this.offlineOrders.length > 0) {
      this.app.showInfoMessage(
        this.app.localize('Offline Orders'),
        this.app.localize('You have offline orders that need to be synchronized.')
      );
    }
  }

  /*
  |-------------------------------------------------------------------------- 
  | SIGNALR & REAL-TIME COMMUNICATION
  |-------------------------------------------------------------------------- 
  */

  private setupSignalR(): void {
    if (!this.isOnline || this.signalRStatus === 'connected') {
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.app.hubUrl(), {
        accessTokenFactory: () => this.app.getJwtToken() || ''
      })
      .withAutomaticReconnect()
      .build();

    this.signalRStatus = 'connecting';

    this.hubConnection.start().then(() => {
      this.signalRStatus = 'connected';
      this.getAllActiveOrders();

      this.hubConnection?.on('Order', (obj: { id: number, status: OrderStatus }) => {
        this.getActiveOrder(obj.id, obj.status);
      });
    }).catch(() => {
      this.signalRStatus = 'disconnected';
      setTimeout(() => this.setupSignalR(), 5000);
    });

    this.hubConnection.onclose(() => {
      this.signalRStatus = 'disconnected';
      setTimeout(() => this.setupSignalR(), 5000);
    });

    this.hubConnection.onreconnecting(() => {
      this.signalRStatus = 'connecting';
    });

    this.hubConnection.onreconnected(() => {
      this.signalRStatus = 'connected';
    });
  }

  public getSignalRStatusClass(): string {
    switch (this.signalRStatus) {
      case 'connected': return 'text-success';
      case 'connecting': return 'text-warning';
      case 'disconnected': return 'text-danger';
      default: return 'text-danger';
    }
  }

  public getSignalRStatusText(): string {
    switch (this.signalRStatus) {
      case 'connected': return this.app.localize('Connected');
      case 'connecting': return this.app.localize('Connecting...');
      case 'disconnected': return this.app.localize('Disconnected');
      default: return this.app.localize('Offline');
    }
  }

  /*
  |-------------------------------------------------------------------------- 
  | DATA LOADING
  |-------------------------------------------------------------------------- 
  */

  private async loadPOSData(): Promise<void> {
    try {
      const response = await this.http.get<any>(`/api/sales/getposdata?locationId=${this.locationId}`).toPromise();
      this.loadCashRegisters();
      this.processPOSData(response);
      this.app.saveOfflineData(`posdata_${this.locationId}`, response);
    } catch (error) {
      try {
        const cachedData = await this.app.getOfflineData(`posdata_${this.locationId}`);
        if (cachedData) {
          this.processPOSData(cachedData);
          //console.log('Loaded POS data from cache');
        }
      } catch (cacheError) {
        //console.error('Failed to load POS data from cache', cacheError);
        this.app.showErrorMessage(
          this.app.localize('Error!'),
          this.app.localize('Failed to load POS data. Please check your connection and try again.')
        );
      }
    } finally {
      this.isLoading = false;
    }
  }

  private processPOSData(response: any): void {
    if (!response) return;

    this.categories = response.categories || [];
    this.items = response.items || [];
    this.paymentMethods = response.paymentMethods || [];
    this.taxRates = (response.taxRates || []).map((t: any) => ({ ...t, taxRateName: t.taxName }));
    this.discounts = response.discounts || [];
    this.charges = response.charges || [];
    this.waiterOrDrivers = response.waiterOrDrivers || [];

    if (response.pos) {
      this.posSettings = {
        isTaxInclusive: response.pos.isTaxInclusive || false,
        isTaxBeforeDiscount: response.pos.isTaxBeforeDiscount || false,
        isTaxOrderLevel: response.pos.isTaxOrderLevel !== false,
        isDiscountOrderLevel: response.pos.isDiscountOrderLevel !== false,
        isKitchenPrinting: response.pos.isKitchenPrinting || false
      };
    }

    if (response.general) {
      this.generalSettings = response.general;
    }

    this.categories.forEach((cat: any) => {
      cat.imageUrl = cat.imageUrl ? this.app.apiUrl(`/api/media/getthumbnailimage/categories/${cat.imageUrl}`) : '';
    });

    this.items.forEach((item: any) => {
      item.imageUrl = this.app.itemImageUrl(item.itemImages?.[0]?.imageUrl || item.imageUrl);
    });

    this.taxRates.forEach((tax: any) => {
      tax.displayName = tax.isPercentage ?
        `${tax.taxName} (${this.app.formatPercent(tax.taxValue)})` :
        `${tax.taxName} (${this.app.formatCurrency(tax.taxValue)})`;
    });

    this.discounts.forEach((disc: any) => {
      disc.displayName = disc.isPercentage ?
        `${disc.discountName} (${this.app.formatPercent(disc.discountValue)})` :
        `${disc.discountName} (${this.app.formatCurrency(disc.discountValue)})`;
    });

    this.charges.forEach((chrg: any) => {
      chrg.displayName = chrg.isPercentage ?
        `${chrg.chargeName} (${this.app.formatPercent(chrg.chargeValue)})` :
        `${chrg.chargeName} (${this.app.formatCurrency(chrg.chargeValue)})`;
    });
    this.filteredCharges = this.charges.filter((c: any) => c.applyTo === this.order.orderType);

    if (response.walkInCustomer) {
      this.order.customer = response.walkInCustomer;
      this.order.customerId = response.walkInCustomer.id;
      this.order.customerName = response.walkInCustomer.fullName || 'Walk-in Customer';
    }

    this.order.taxRate = this.taxRates.find((t: any) => t.isDefault) || null;
    this.order.discount = this.discounts.find((d: any) => d.isDefault) || null;
    this.order.charge = this.filteredCharges.find((c: any) => c.isDefault) || null;

    this.order.taxRateId = this.order.taxRate ? this.order.taxRate.id : null;
    this.order.discountId = this.order.discount ? this.order.discount.id : null;
    this.order.chargeId = this.order.charge ? this.order.charge.id : null;

    this.filteredItems = [...this.items];
    this.calculateOrderTotals();
    this.app.loadImages('[data-img="true"]');
  }

  private async loadFloorData(): Promise<void> {
    try {
      const response = await this.http.get<any>(`/api/sales/getfloors?locationId=${this.locationId}`).toPromise();
      this.floorAreas = response.floorAreas || [];
      this.app.saveOfflineData(`floors_${this.locationId}`, this.floorAreas);

      if (this.floorAreas.length > 0) {
        this.modals.orderConfig.selectedFloorId = this.floorAreas[0].id;
      }
    } catch (error) {
      try {
        const cachedFloors = (await this.app.getOfflineData(`floors_${this.locationId}`)) || [];
        if (Array.isArray(cachedFloors)) {
          this.floorAreas = cachedFloors as FloorArea[];
          //console.log('Loaded floor data from cache');

          if (this.floorAreas.length > 0) {
            this.modals.orderConfig.selectedFloorId = this.floorAreas[0].id;
          }
        }
      } catch (cacheError) {
        //console.error('Failed to load floor data from cache', cacheError);
      }
    }
  }

  /**
   * Load cash registers - NO auto-selection
   */
  private async loadCashRegisters(): Promise<void> {
    try {
      const response = await this.http.get<any>(`/api/sales/getcashregisters?locationId=${this.locationId}`).toPromise();
      this.cashRegisters = response.registers || [];
      this.app.saveOfflineData(`registers_${this.locationId}`, this.cashRegisters);
      this.openedCashRegisters = this.cashRegisters.filter(reg => reg.isOpened);
    } catch (error) {
      try {
        const cachedRegisters = await this.app.getOfflineData(`registers_${this.locationId}`);
        if (cachedRegisters) {
          this.cashRegisters = cachedRegisters as any[];
          //console.log('Loaded cash registers data from cache');
        }
      } catch (cacheError) {
        //console.error('Failed to load cash registers data from cache', cacheError);
      }
    }
  }

  private async loadOfflineOrders(): Promise<void> {
    try {
      this.offlineOrders = await this.app.getOfflineData(`offlineorders_${this.locationId}`) || [];
    } catch (error) {
      //console.error('Failed to load offline orders:', error);
      this.offlineOrders = [];
    }
  }

  private async loadHeldOrder(): Promise<void> {
    try {
      this.heldOrder = await this.app.getOfflineData(`heldorder_${this.locationId}`);
    } catch (error) {
      //console.error('Failed to load held order:', error);
      this.heldOrder = null;
    }
  }

  private getAllActiveOrders(): void {
    this.modals.activeOrders.loading = true;
    this.http.get<any>(`/api/sales/getactiveorders?locationId=${this.locationId}`).subscribe({
      next: (response) => {
        this.activeOrders = response.data || [];
        this.modals.activeOrders.loading = false;
      },
      error: (error) => {
        this.modals.activeOrders.loading = false;
      }
    });
  }

  private getActiveOrder(orderId: number, orderStatus: number): void {
    if (orderStatus === OrderStatus.Completed || orderStatus === OrderStatus.Cancelled) {
      this.activeOrders = this.activeOrders.filter(order => order.id !== orderId);
      return;
    }

    this.http.get<any>(`/api/sales/getactiveorder/${orderId}`).subscribe({
      next: (response) => {
        const activeOrder = response.data || null;
        if (activeOrder.status === OrderStatus.Completed || activeOrder.status === OrderStatus.Cancelled) {
          this.activeOrders = this.activeOrders.filter(order => order.id !== orderId);
          return;
        }
        if (activeOrder) {
          this.activeOrders = this.activeOrders.filter(order => order.id !== orderId);
          this.activeOrders.push(activeOrder);
          this.activeOrders.sort((a) => a.id === orderId ? -1 : 1);
          this.sound.notification();
        }
      },
      error: (error) => {
        //console.error('Error fetching active order:', error);
      }
    });
  }

  private setupFloorService(): void {
    this.floorService.selectedTable$.pipe(takeUntil(this.destroy$)).subscribe(table => {
      this.order.table = table;
      this.order.tableId = table?.id || null;
      this.renderFloorPlan();
    });

    this.floorService.selectedFloor$.pipe(takeUntil(this.destroy$)).subscribe(floor => {
      this.selectedFloor = floor;
    });
  }

  /*
  |-------------------------------------------------------------------------- 
  | BROWSER BACK BUTTON HANDLING
  |-------------------------------------------------------------------------- 
  */

  /**
   * Handle browser back navigation for modals
   * IMPORTANT: Only resets state, does NOT call history.back()
   */
  private onPopState = (): void => {
    if (this.modals.payment.show) {
      this.resetPaymentModal();
    } else if (this.modals.itemDetail.show) {
      this.resetItemDetailModal();
    } else if (this.modals.customerChange.show) {
      this.resetCustomerChangeModal();
    } else if (this.modals.orderConfig.show) {
      this.resetOrderConfigModal();
    } else if (this.modals.cashRegister.show) {
      this.resetCashRegisterModal();
    } else if (this.modals.activeOrders.show) {
      this.resetActiveOrdersModal();
    } else if (this.modals.splitBill.show) {
      this.resetSplitBillModal();
    } else if (this.modals.kitchenPrint.show) {
      this.resetKitchenPrintModal();
    } else if (this.modals.dataSync.show) {
      this.resetDataSyncModal();
    }

    if (this.showMobileCart) {
      this.showMobileCart = false;
      return;
    }
  };

  /*
  |-------------------------------------------------------------------------- 
  | MODAL RESET METHODS (Called by onPopState)
  |-------------------------------------------------------------------------- 
  */

  private resetPaymentModal(): void {
    this.modals.payment.show = false;
    this.modals.payment.validated = false;
    this.modals.payment.loading = false;
    this.modals.payment.paidAmount = '0';
    this.modals.payment.tipAmount = 0;
    this.modals.payment.changeAmount = 0;
    this.modals.payment.processingFee = 0;
    this.modals.payment.remainingAmount = 0;
    this.modals.payment.totalPayable = 0;
    this.modals.payment.paymentReference = '';
    this.modals.payment.loyaltyPointsRedeemed = 0;
    this.selectedPaymentMethod = null;
  }

  private resetItemDetailModal(): void {
    this.modals.itemDetail.show = false;
    this.modals.itemDetail.loading = false;
    this.modals.itemDetail.item = null;
    this.modals.itemDetail.selectedModifiers = [];
    this.modals.itemDetail.selectedModifierId = null;
    this.modals.itemDetail.selectedImageIndex = 0;
    this.modals.itemDetail.quantity = 1;
    this.modals.itemDetail.notes = '';
    this.modals.itemDetail.validated = false;
    this.modals.itemDetail.isEdit = false;
    this.modals.itemDetail.cartItemId = null;
  }

  private resetOrderConfigModal(): void {
    this.modals.orderConfig.show = false;
    this.modals.orderConfig.loading = false;
    this.modals.orderConfig.validated = false;
  }

  private resetCustomerChangeModal(): void {
    this.modals.customerChange.show = false;
    this.modals.customerChange.loading = false;
    this.modals.customerChange.validated = false;
    this.modals.customerChange.submitted = false;
    this.modals.customerChange.activeTab = 'search';
    this.modals.customerChange.searchValue = '';
    this.modals.customerChange.searchResults = [];
    this.modals.customerChange.newCustomer = { customerType: null, isActive: true };
  }

  private resetCashRegisterModal(): void {
    this.modals.cashRegister.show = false;
    this.modals.cashRegister.loading = false;
    this.modals.cashRegister.submitted = false;
    this.modals.cashRegister.openingCash = 0;
    this.modals.cashRegister.closingCash = 0;
    this.modals.cashRegister.notes = '';
    this.modals.cashRegister.registerId = 0;
  }

  private resetActiveOrdersModal(): void {
    this.modals.activeOrders.show = false;
    this.modals.activeOrders.loading = false;
    this.printingOrderId = null;
  }

  private resetSplitBillModal(): void {
    this.modals.splitBill.show = false;
    this.modals.splitBill.loading = false;
    this.modals.splitBill.newCustomerId = 0;
    this.modals.splitBill.guestCount = 1;
    this.modals.splitBill.splitQuantities.clear();
  }

  private resetKitchenPrintModal(): void {
    this.modals.kitchenPrint.show = false;
    this.modals.kitchenPrint.loading = false;
    this.modals.kitchenPrint.orderData = null;
  }

  private resetDataSyncModal(): void {
    this.modals.dataSync.show = false;
    this.modals.dataSync.loading = false;
    this.modals.dataSync.selectedOrderIds = [];
    this.modals.dataSync.syncingOrderIds = [];
    this.modals.dataSync.successIds = [];
    this.modals.dataSync.failedIds = [];
  }

  /*
  |-------------------------------------------------------------------------- 
  | ORDER CALCULATIONS
  |-------------------------------------------------------------------------- 
  */

  public calculateOrderTotals(): void {
    const R2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

    // Initialize cart items
    this.cart.forEach((ci: any) => {
      ci.quantity = Number(ci.quantity || 0);
      ci.unitPrice = Number(ci.unitPrice || 0);
      ci.modifiers = Array.isArray(ci.modifiers) ? ci.modifiers : [];
      ci.modifiersTotal = Number(ci.modifiersTotal || ci.modifiers.reduce((s: number, m: any) => s + (Number(m.unitPrice || 0)), 0));
    });

    // Calculate subtotal
    this.order.subTotal = 0;
    this.order.cogsAmount = 0;
    this.cart.forEach((item: any) => {
      const modifiersTotal = item.modifiers.reduce((sum: number, mod: any) => sum + (Number(mod.unitPrice || 0)), 0);
      item.modifiersTotal = R2(modifiersTotal);
      item.totalAmount = R2((Number(item.unitPrice || 0) + item.modifiersTotal) * Number(item.quantity || 0));

      const baseCostPerUnit = Number(item.item?.cost ?? 0);
      const modifierCostPerUnit = item.modifiers.reduce((s: number, mm: any) => s + (Number(mm.unitPrice || 0)), 0);
      item.cogsAmount = R2((baseCostPerUnit + modifierCostPerUnit) * Number(item.quantity || 0));

      item.discountAmount = 0;
      item.taxAmount = 0;

      this.order.subTotal += item.totalAmount;
      this.order.cogsAmount += item.cogsAmount;
    });

    this.order.subTotal = R2(this.order.subTotal);
    this.order.cogsAmount = R2(this.order.cogsAmount);

    // Initialize discount and tax
    this.order.discountAmount = 0;
    this.order.couponDiscount = Number(this.order.couponDiscount || 0);
    this.order.taxAmount = 0;
    this.order.chargeAmount = 0;

    // ITEM-LEVEL DISCOUNT: Use each item's discount
    if (!this.posSettings.isDiscountOrderLevel) {
      this.cart.forEach((item: any) => {
        const itemDiscount = item.item?.discount;
        if (itemDiscount) {
          const discountValue = itemDiscount.isPercentage
            ? item.totalAmount * (Number(itemDiscount.discountValue || 0) / 100)
            : Number(itemDiscount.discountValue || 0);

          item.discountAmount = R2(Math.min(discountValue, item.totalAmount));
          this.order.discountAmount = R2((Number(this.order.discountAmount || 0) + item.discountAmount));
        }
      });
    } else {
      // Reset item discounts for order-level
      this.cart.forEach((item: any) => item.discountAmount = 0);
      this.order.discountAmount = 0;
    }

    // Coupon discount
    this.order.couponDiscount = R2(Number(this.order.couponDiscount || 0));
    if (this.order.couponDiscount < 0) this.order.couponDiscount = 0;

    // ORDER-LEVEL DISCOUNT: Use order's discount
    if (this.posSettings.isDiscountOrderLevel && this.order.discount) {
      const discount = this.order.discount;
      const eligibleAmount = Math.max(0, this.order.subTotal - this.order.couponDiscount);
      let calculated = discount.isPercentage
        ? eligibleAmount * (Number(discount.discountValue || 0) / 100)
        : Number(discount.discountValue || 0);

      calculated = Math.min(calculated, eligibleAmount);
      this.order.discountAmount = R2(calculated);
    }

    this.order.discountTotal = R2(Number(this.order.discountAmount || 0) + Number(this.order.couponDiscount || 0));

    // Calculate taxable amount
    let taxableAmount = this.order.subTotal - this.order.discountTotal;
    if (this.posSettings.isTaxBeforeDiscount) {
      taxableAmount = this.order.subTotal;
    }
    taxableAmount = R2(Math.max(0, taxableAmount));

    this.order.taxAmount = 0;

    // ITEM-LEVEL TAX: Use each item's tax rate
    if (!this.posSettings.isTaxOrderLevel) {
      this.cart.forEach((item: any) => {
        const itemTaxRate = item.item?.taxRate;
        if (itemTaxRate) {
          let itemTaxableAmount = item.totalAmount - (item.discountAmount || 0);
          if (this.posSettings.isTaxBeforeDiscount) {
            itemTaxableAmount = item.totalAmount;
          }

          const taxValue = Number(itemTaxRate.taxValue || 0);
          const isPercentage = !!itemTaxRate.isPercentage;

          let computedTax = 0;
          if (isPercentage) {
            computedTax = itemTaxableAmount * (taxValue / 100);
          } else {
            computedTax = taxValue;
          }

          if (this.posSettings.isTaxInclusive) {
            const divisor = isPercentage ? (100 + taxValue) / 100 : 1;
            item.taxAmount = R2(itemTaxableAmount - (itemTaxableAmount / divisor));
          } else {
            item.taxAmount = R2(computedTax);
          }

          this.order.taxAmount = R2(Number(this.order.taxAmount || 0) + Number(item.taxAmount || 0));
        }
      });
    }
    // ORDER-LEVEL TAX: Use order's tax rate
    else if (this.order.taxRate) {
      const taxRate = this.order.taxRate;
      const taxValue = Number(taxRate.taxValue || 0);
      const isPercentage = !!taxRate.isPercentage;

      if (isPercentage) {
        this.order.taxAmount = R2(taxableAmount * (taxValue / 100));
      } else {
        this.order.taxAmount = R2(taxValue);
      }

      if (this.posSettings.isTaxInclusive) {
        const divisor = isPercentage ? (100 + taxValue) / 100 : 1;
        this.order.taxAmount = R2(taxableAmount - (taxableAmount / divisor));
      }
    }

    // Calculate charges
    if (this.order.charge) {
      const ch = this.order.charge;
      const base = R2(this.order.subTotal - this.order.discountTotal + this.order.taxAmount);
      if (ch.isPercentage) {
        this.order.chargeAmount = R2(base * (Number(ch.chargeValue || 0) / 100));
      } else {
        this.order.chargeAmount = R2(Number(ch.chargeValue || 0));
      }
    } else {
      this.order.chargeAmount = 0;
    }

    // Calculate total amount
    if (this.posSettings.isTaxInclusive) {
      this.order.totalAmount = R2(this.order.subTotal - this.order.discountTotal + this.order.chargeAmount);
    } else {
      this.order.totalAmount = R2(this.order.subTotal - this.order.discountTotal + this.order.taxAmount + this.order.chargeAmount);
    }

    // Calculate total payable
    this.order.tipAmount = Number(this.order.tipAmount || 0);
    this.order.processingFee = Number(this.order.processingFee || 0);
    this.order.totalPayable = R2(this.order.totalAmount + this.order.tipAmount + this.order.processingFee);

    this.order.paidAmount = Number(this.order.paidAmount || 0);
    this.order.changeAmount = Number(this.order.changeAmount || 0);
    this.order.remainingAmount = Math.max(0, R2(this.order.totalPayable - this.order.paidAmount));
    this.order.refundedAmount = Number(this.order.refundedAmount || 0);
    this.order.loyaltyPointsEarned = Number(this.order.loyaltyPointsEarned || 0);
    this.order.loyaltyPointsRedeemed = Number(this.order.loyaltyPointsRedeemed || 0);

    // Round all values
    this.cart.forEach((item: any) => {
      item.totalAmount = R2(Number(item.totalAmount || 0));
      item.discountAmount = R2(Number(item.discountAmount || 0));
      item.taxAmount = R2(Number(item.taxAmount || 0));
      item.cogsAmount = R2(Number(item.cogsAmount || 0));
    });

    this.order.subTotal = R2(this.order.subTotal);
    this.order.discountAmount = R2(this.order.discountAmount);
    this.order.couponDiscount = R2(this.order.couponDiscount);
    this.order.discountTotal = R2(this.order.discountTotal);
    this.order.taxAmount = R2(this.order.taxAmount);
    this.order.chargeAmount = R2(this.order.chargeAmount);
    this.order.totalAmount = R2(this.order.totalAmount);
    this.order.cogsAmount = R2(this.order.cogsAmount);
    this.order.remainingAmount = R2(this.order.remainingAmount);
    this.order.totalPayable = R2(this.order.totalPayable);
  }

  public calculateTotals(): void {
    this.calculateOrderTotals();
  }

  /*
  |-------------------------------------------------------------------------- 
  | ITEM MANAGEMENT & FILTERING
  |-------------------------------------------------------------------------- 
  */

  public onSearch(term: string): void {
    this.searchSubject.next(term);
  }

  public selectCategory(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    this.filterItems();
  }

  public toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  public changeSort(sortBy: 'name' | 'price' | 'category'): void {
    if (this.sortBy === sortBy) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = sortBy;
      this.sortDirection = 'asc';
    }
    this.filterItems();
  }

  private filterItems(): void {
    let filtered = [...this.items];

    if (this.selectedCategoryId) {
      filtered = filtered.filter(item => item.categoryId === this.selectedCategoryId);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.itemName.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term) ||
        item.barcode?.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (this.sortBy) {
        case 'name':
          comparison = a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' });
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'category':
          const catA = this.categories.find(c => c.id === a.categoryId)?.categoryName || '';
          const catB = this.categories.find(c => c.id === b.categoryId)?.categoryName || '';
          comparison = catA.localeCompare(catB, undefined, { sensitivity: 'base' });
          if (comparison === 0) {
            comparison = a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' });
          }
          break;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.filteredItems = filtered;
    this.app.loadImages('[data-img="true"]');
  }

  /*
  |-------------------------------------------------------------------------- 
  | CART MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  public addToCart(item: any): void {
    if (item.itemModifiers && item.itemModifiers.length > 0) {
      this.showItemDetailModal(item);
    } else {
      this.addItemToCart(item, 1, []);
    }
  }

  public showCartItemDetail(cartItem: any): void {
    this.modals.itemDetail.show = true;
    this.modals.itemDetail.item = cartItem.item;
    this.modals.itemDetail.quantity = cartItem.quantity;
    this.modals.itemDetail.notes = cartItem.notes || '';
    this.modals.itemDetail.isEdit = true;
    this.modals.itemDetail.cartItemId = cartItem.id;
    this.modals.itemDetail.selectedModifiers = [...cartItem.modifiers];
    this.modals.itemDetail.selectedModifierId = null;
    this.modals.itemDetail.selectedImageIndex = 0;
    this.modals.itemDetail.validated = false;

    if (this.modals.itemDetail.item?.itemImages) {
      this.app.loadImages('[data-gallery-img="true"]');
    }

    history.pushState(null, '', window.location.pathname);
  }

  private addItemToCart(item: any, quantity: number, modifiers: any[], notes?: string): void {
    if (this.cart.filter(ci => ci.itemId === item.id).length > 0)
      return;

    const cartItemId = `${item.id}_${Date.now()}_${Math.random()}`;
    const modifiersTotal = modifiers.reduce((sum, mod) => sum + (mod.unitPrice || 0), 0);
    const lineTotal = (item.price + modifiersTotal) * quantity;

    const cartItem = {
      id: cartItemId,
      itemId: item.id,
      modifiersTotal: modifiersTotal,
      quantity: quantity,
      unitPrice: item.price,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: lineTotal,
      notes: notes || '',
      item: item,
      modifiers: modifiers,
      cogsAmount: 0
    };

    this.cart.push(cartItem);
    this.calculateOrderTotals();
    this.app.loadImages('[data-cart-img="true"]');
    this.sound.addItem();
  }

  private updateCartItem(cartItemId: string, quantity: number, modifiers: any[], notes: string): void {
    const cartItemIndex = this.cart.findIndex((item: any) => item.id === cartItemId);
    if (cartItemIndex !== -1) {
      const cartItem = this.cart[cartItemIndex];
      const modifiersTotal = modifiers.reduce((sum: number, mod: any) => sum + (mod.unitPrice || 0), 0);
      const lineTotal = (cartItem.unitPrice + modifiersTotal) * quantity;

      cartItem.quantity = quantity;
      cartItem.modifiers = modifiers;
      cartItem.notes = notes;
      cartItem.modifiersTotal = modifiersTotal;
      cartItem.totalAmount = lineTotal;

      this.calculateOrderTotals();
    }
  }

  public removeFromCart(cartItemId: string): void {
    this.cart = this.cart.filter((item: any) => item.id !== cartItemId);
    this.sound.trash();
    this.calculateOrderTotals();
  }

  public updateCartItemQuantity(cartItemId: string, quantity: number): void {
    const item = this.cart.find((i: any) => i.id === cartItemId);
    if (item && quantity > 0) {
      item.quantity = quantity;
      item.totalAmount = (item.unitPrice + item.modifiersTotal) * quantity;
      this.calculateOrderTotals();
      this.sound.click();
    } else if (quantity <= 0) {
      this.removeFromCart(cartItemId);
    }
  }

  public clearCart(): void {
    this.cart = [];
    this.calculateOrderTotals();
  }

  public toggleMobileCart(): void {
    this.showMobileCart = !this.showMobileCart;

    if (this.showMobileCart) {
      history.pushState(null, '', window.location.pathname);
    } else {
      history.back();
    }
  }

  /*
  |-------------------------------------------------------------------------- 
  | COUPON MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  public applyCoupon(): void {
    if (!this.order.couponCode?.trim()) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Please enter coupon code'));
      return;
    }

    this.http.get<any>(`/api/sales/checkcouponcode?couponCode=${encodeURIComponent(this.order.couponCode)}`).subscribe({
      next: (response) => {
        const subTotal = this.order.subTotal || 0;

        if (response.minimumOrderAmount && subTotal < response.minimumOrderAmount) {
          this.app.showErrorMessage(
            this.app.localize('Error!'),
            `${this.app.localize('Minimum order amount required')}: ${this.app.formatCurrency(response.minimumOrderAmount)}`
          );
          return;
        }

        const eligibleAmount = this.order.subTotal - this.order.discountAmount;
        this.order.couponDiscount = response.isPercentage
          ? Math.min(eligibleAmount * (response.discountValue / 100), eligibleAmount)
          : Math.min(response.discountValue, eligibleAmount);

        this.calculateOrderTotals();

        this.app.showSuccessMessage(
          this.app.localize('Success'),
          `${this.app.localize('Coupon applied')}: ${this.app.formatCurrency(this.order.couponDiscount)} ${this.app.localize('discount')}`
        );
      },
      error: (error) => {
        this.app.handleApiError(error);
        this.order.couponCode = '';
        this.order.couponDiscount = 0;
        this.calculateOrderTotals();
      }
    });
  }

  public removeCoupon(): void {
    this.order.couponCode = '';
    this.order.couponDiscount = 0;
    this.calculateOrderTotals();
  }

  /*
  |-------------------------------------------------------------------------- 
  | CUSTOMER MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  public showCustomerChangeModal(): void {
    this.modals.customerChange.show = true;
    this.modals.customerChange.activeTab = 'search';
    this.modals.customerChange.loading = false;
    this.modals.customerChange.validated = false;
    this.modals.customerChange.submitted = false;
    this.modals.customerChange.searchValue = '';
    this.modals.customerChange.searchResults = [];
    this.modals.customerChange.newCustomer = { customerType: null, isActive: true };
    history.pushState(null, '', window.location.pathname);
  }

  public closeCustomerChangeModal(): void {
    this.resetCustomerChangeModal();
    if (!this.modals.orderConfig.show && !this.modals.payment.show && !this.modals.orderConfig.show && !this.showMobileCart) {
      history.back();
    }
  }

  public searchCustomers(): void {
    if (!this.modals.customerChange.searchValue?.trim()) {
      this.modals.customerChange.searchResults = [];
      return;
    }

    this.modals.customerChange.loading = true;

    this.http.get<any>(`/api/sales/searchcustomers?searchValue=${encodeURIComponent(this.modals.customerChange.searchValue)}&limit=20`).subscribe({
      next: (response) => {
        this.modals.customerChange.searchResults = response.data || [];
        this.modals.customerChange.loading = false;
      },
      error: (error) => {
        this.app.handleApiError(error);
        this.modals.customerChange.loading = false;
      }
    });
  }

  public selectCustomer(customer: any): void {
    this.order.customer = customer;
    this.order.customerId = customer.id;
    this.order.customerName = customer.fullName || '';
    this.closeCustomerChangeModal();
  }

  public addNewCustomer(form: NgForm): void {
    this.modals.customerChange.validated = true;

    if (!form.valid) {
      return;
    }

    this.modals.customerChange.submitted = true;

    this.http.post<any>('/api/customers/createcustomer', form.value).subscribe({
      next: (response) => {
        this.order.customer = response.customer;
        this.order.customerId = response.customer.id;
        this.order.customerName = response.customer.fullName || '';
        this.modals.customerChange.submitted = false;
        this.modals.customerChange.validated = false;
        this.closeCustomerChangeModal();
        this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Customer created successfully.'));
      },
      error: (error) => {
        this.app.handleApiError(error);
        this.modals.customerChange.submitted = false;
        this.modals.customerChange.validated = false;
      }
    });
  }

  /*
  |-------------------------------------------------------------------------- 
  | FLOOR PLAN & TABLE MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  public selectFloorForConfig(floorId: number): void {
    this.modals.orderConfig.selectedFloorId = floorId;
    this.loadFloorPlan(floorId);
  }

  public setTableViewMode(mode: 'floor' | 'list'): void {
    this.modals.orderConfig.tableViewMode = mode;
  }

  private loadFloorPlan(floorId: number): void {
    const floor = this.floorAreas.find(f => f.id === floorId);

    if (!floor) return;

    this.selectedFloor = floor;
    this.tables = floor.tables || [];
    this.floorService.setSelectedFloor(this.selectedFloor);
    setTimeout(() => this.renderFloorPlan(), 100);
  }

  private renderFloorPlan(): void {
    if (!this.floorCanvasRef || !this.selectedFloor) return;

    const container = this.floorCanvasRef.nativeElement;
    container.innerHTML = '';
    this.calculateCanvasScale();

    const canvas = this.floorService.createFloorCanvas();

    this.tables.forEach(table => {
      const tableEl = this.createTableElement(table);
      canvas.appendChild(tableEl);
    });

    container.appendChild(canvas);
    this.addTableClickListeners();
  }

  private calculateCanvasScale(): void {
    if (!this.floorCanvasRef || !this.selectedFloor) return;
    const container = this.floorCanvasRef.nativeElement;
    this.canvasWidth = container.clientWidth;
    this.canvasHeight = container.clientHeight;
    this.canvasScale = this.floorService.calculateCanvasScale(
      this.canvasWidth,
      this.canvasHeight,
      this.selectedFloor.width,
      this.selectedFloor.height,
      { minScale: 0.1, maxScale: 2.0 } as any
    );
  }

  private createTableElement(table: FloorTable): HTMLElement {
    const canvasPos = this.floorService.floorToCanvas(
      table.posX, table.posY,
      this.canvasWidth, this.canvasHeight,
      this.selectedFloor!.width, this.selectedFloor!.height
    );

    const tableSize = this.floorService.getScaledTableSize(table, this.canvasScale);
    const isSelected = this.order.table?.id === table.id;

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.style.cssText = this.floorService.getWrapperStyles(table, canvasPos, isSelected);
    wrapper.setAttribute('data-table-id', String(table.id));
    wrapper.style.cursor = table.status === TableStatus.Available ? 'pointer' : 'not-allowed';

    const shape = document.createElement('div');
    shape.className = 'table-shape';
    shape.style.cssText = this.floorService.getTableStyles(table, this.canvasScale, isSelected);

    const content = document.createElement('div');
    content.className = 'table-content';
    const number = document.createElement('div');
    number.className = 'table-number';
    number.textContent = table.tableNumber;
    content.appendChild(number);

    shape.appendChild(content);

    const chairPositions = this.floorService.getDynamicChairPositions(table, tableSize);
    const chairSize = Math.max(8, 12 * this.canvasScale);
    chairPositions.forEach(pos => {
      const node = document.createElement('div');
      node.className = 'chair-node position-absolute';
      node.style.cssText = `
                left: ${pos.x - chairSize / 2}px; top: ${pos.y - chairSize / 2}px;
                width: ${chairSize}px; height: ${chairSize}px; pointer-events: none; z-index: -1;
                transform: rotate(${pos.angle}deg); transform-origin: center center;
            `;
      node.appendChild(this.floorService.createChairElement(chairSize, this.canvasScale).firstElementChild!);
      wrapper.appendChild(node);
    });

    wrapper.appendChild(shape);
    return wrapper;
  }

  private addTableClickListeners(): void {
    if (!this.floorCanvasRef) return;

    this.floorCanvasRef.nativeElement.querySelectorAll('.table-wrapper').forEach(wrapper => {
      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        const tableId = parseInt(wrapper.getAttribute('data-table-id') || '0', 10);
        const table = this.tables.find(t => t.id === tableId);
        if (table && table.status === TableStatus.Available) {
          this.floorService.setSelectedTable(this.order.table?.id === tableId ? null : table);
        }
      });
    });
  }

  /*
  |-------------------------------------------------------------------------- 
  | ORDER CONFIGURATION
  |-------------------------------------------------------------------------- 
  */

  public selectOrderType(orderType: OrderType): void {
    this.order.orderType = orderType;

    this.filteredCharges = this.charges.filter((c: any) => c.applyTo === orderType);
    const defaultCharge = this.filteredCharges.find((c: any) => c.isDefault);
    this.selectCharge(defaultCharge ? defaultCharge.id : null);

    if (orderType !== OrderType.DineIn) {
      this.order.table = null;
      this.order.tableId = null;
      this.floorService.setSelectedTable(null);
    }
  }

  public selectTaxRate(taxRateId: number | null): void {
    this.order.taxRateId = taxRateId;
    this.order.taxRate = this.taxRates.find((t: any) => t.id === taxRateId) || null;
    this.calculateOrderTotals();
  }

  public selectDiscount(discountId: number | null): void {
    this.order.discountId = discountId;
    this.order.discount = this.discounts.find((d: any) => d.id === discountId) || null;
    this.calculateOrderTotals();
  }

  public selectCharge(chargeId: number | null): void {
    this.order.chargeId = chargeId;
    this.order.charge = this.charges.find((c: any) => c.id === chargeId) || null;
    this.calculateOrderTotals();
  }

  public incrementGuests(): void {
    if (this.order.guests < 255) {
      this.order.guests++;
    }
  }

  public decrementGuests(): void {
    if (this.order.guests > 1) {
      this.order.guests--;
    }
  }

  /*
  |-------------------------------------------------------------------------- 
  | CASH REGISTER OPERATIONS
  |-------------------------------------------------------------------------- 
  */

  public showCashRegisterModal(): void {
    this.modals.cashRegister.show = true;
    this.modals.cashRegister.loading = true;

    this.loadCashRegisters().then(() => {
      this.modals.cashRegister.loading = false;
      this.modals.cashRegister.submitted = false;
    }).catch(error => {
      this.app.handleApiError(error);
      this.modals.cashRegister.loading = false;
      this.modals.cashRegister.submitted = false;
    });

    history.pushState(null, '', window.location.pathname);
  }

  public closeCashRegisterModal(): void {
    this.resetCashRegisterModal();
    history.back();
  }

  public isCashRegisterOpen(register: any): boolean {
    return register.isOpened;
  }

  public openCashRegister(form: NgForm, registerId: number): void {
    if (!form.valid) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Please fill in all required fields.'));
      return;
    }

    this.modals.cashRegister.submitted = true;
    const payload = {
      locationId: this.locationId,
      registerId: registerId,
      openingCash: this.app.localeToAPINumber(form.value.openingCash || 0),
      notes: form.value.notes
    };

    this.http.post<any>('/api/sales/opencashregister', payload).subscribe({
      next: () => {
        this.app.showSuccessMessage(
          this.app.localize('Success!'),
          this.app.localize('Cash register opened successfully.')
        );
        form.resetForm();
        this.showCashRegisterModal();
      },
      error: (error) => {
        this.app.handleApiError(error);
        this.modals.cashRegister.submitted = false;
      }
    });
  }

  public closeCashRegister(form: NgForm, registerId: number): void {
    if (!form.valid) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Please fill in all required fields.'));
      return;
    }

    this.modals.cashRegister.submitted = true;
    const payload = {
      locationId: this.locationId,
      registerId: registerId,
      closingCash: this.app.localeToAPINumber(form.value.closingCash || 0),
      notes: form.value.notes
    };

    this.http.post<any>('/api/sales/closecashregister', payload).subscribe({
      next: () => {
        this.app.showSuccessMessage(
          this.app.localize('Success!'),
          this.app.localize('Cash register closed successfully.')
        );
        form.resetForm();
        this.showCashRegisterModal();
      },
      error: (error) => {
        this.app.handleApiError(error);
        this.modals.cashRegister.submitted = false;
      }
    });
  }

  /*
  |-------------------------------------------------------------------------- 
  | ORDER MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  /**
   * Validates order
   */
  public isOrderValid(): boolean {
    if (this.cart.length === 0) {
      return false;
    }

    if (this.order.orderType === OrderType.DineIn && !this.order.tableId) {
      return false;
    }

    return true;
  }

  /**
   * Save order
   */
  public saveOrder(): void {
    const orderRequest = {
      orderId: this.order.id,
      locationId: this.locationId,
      customerId: this.order.customerId,
      orderType: this.order.orderType,
      tableId: this.order.tableId || null,
      registerId: null,
      taxRateId: this.order.taxRateId || null,
      discountId: this.order.discountId || null,
      chargeId: this.order.chargeId || null,
      guests: this.order.guests,
      notes: this.order.notes,
      specialInstructions: this.order.specialInstructions,
      waiterOrDriver: this.order.waiterOrDriver,
      couponCode: this.order.couponCode || null,
      items: this.cart.map((item: any) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        modifiers: item.modifiers.map((m: any) => ({
          modifierOptionId: m.modifierOptionId
        }))
      }))
    };

    if (!this.isOnline) {
      this.saveOrderOffline(orderRequest);
      return;
    }

    const apiCall = this.order.id > 0
      ? this.http.put<any>('/api/sales/updateorder', orderRequest)
      : this.http.post<any>('/api/sales/createorder', orderRequest);

    apiCall.subscribe({
      next: (response) => {
        this.app.showSuccessMessage(
          this.app.localize('Success!'),
          this.order.id > 0
            ? this.app.localize('Order updated successfully.')
            : this.app.localize('Order created successfully.')
        );

        if (response.orderId) {
          this.order.id = response.orderId;
        }

        this.loadFloorData();
        this.loadCashRegisters();

        this.clearCart();
        this.resetOrderState();

        this.showMobileCart = false;
      },
      error: (error) => {
        this.app.handleApiError(error);
        if (error.status === 0) {
          this.saveOrderOffline(orderRequest);
        }
      }
    });
  }

  private async saveOrderOffline(orderRequest: any): Promise<void> {
    try {
      const offlineOrder = {
        ...orderRequest,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        status: 'offline'
      };

      this.offlineOrders.push(offlineOrder);
      this.app.saveOfflineData(`offlineorders_${this.locationId}`, this.offlineOrders);
      await this.loadOfflineOrders();

      this.app.showInfoMessage(
        this.app.localize('Offline Mode'),
        this.app.localize('Order saved offline. Will sync when connection is restored.')
      );

      this.clearCart();
      this.resetOrderState();
    } catch (error) {
      //console.error('Failed to save order offline:', error);
      this.app.showErrorMessage(
        this.app.localize('Error!'),
        this.app.localize('Failed to save order offline.')
      );
    }
  }

  /*
  |-------------------------------------------------------------------------- 
  | PAYMENT PROCESSING
  |-------------------------------------------------------------------------- 
  */

  public showPaymentModal(): void {
    this.modals.payment.show = true;
    this.modals.payment.tipAmount = 0;
    this.modals.payment.processingFee = 0;
    this.modals.payment.changeAmount = 0;
    this.modals.payment.paymentReference = '';
    this.selectedPaymentMethod = null;

    this.modals.payment.paidAmount = this.app.apiNumberToLocale(this.order.totalAmount);
    this.modals.payment.totalPayable = this.order.totalAmount;
    this.modals.payment.remainingAmount = this.order.totalAmount;

    if (this.paymentMethods.length > 0) {
      this.selectPaymentMethod(this.paymentMethods[0]);
    }

    history.pushState(null, '', window.location.pathname);
  }

  public closePaymentModal(): void {
    this.resetPaymentModal();
    if (!this.showMobileCart && !this.modals.orderConfig.show) {
      history.back();
    }
  }

  public selectPaymentMethod(method: any): void {
    this.selectedPaymentMethod = method;
    this.updatePaidAmount();
    this.modals.payment.paidAmount = this.app.apiNumberToLocale(this.calculatePaymentTotal());
    this.modals.payment.totalPayable = this.calculatePaymentTotal();
    this.modals.payment.paymentReference = '';
    this.modals.payment.changeAmount = 0;
    this.modals.payment.remainingAmount = 0;

    if (method.id == 3 && this.openedCashRegisters.length > 0) {
      this.order.registerId = this.openedCashRegisters[0].id ?? null;
    }
  }

  public calculatePaymentTotal(): number {
    const tipAmount = Number(this.modals.payment.tipAmount || 0);
    const processingFee = Number(this.modals.payment.processingFee || 0);
    return this.order.totalAmount + tipAmount + processingFee;
  }

  public updatePaidAmount(): void {
    const tipAmount = Number(this.modals.payment.tipAmount || 0);

    let processingFee = 0;
    if (this.selectedPaymentMethod && this.selectedPaymentMethod.processorFee > 0) {
      const baseAmount = this.order.totalAmount;
      processingFee = this.selectedPaymentMethod.isFeePercentage
        ? baseAmount * (this.selectedPaymentMethod.processorFee / 100)
        : this.selectedPaymentMethod.processorFee;
    }

    this.modals.payment.processingFee = processingFee;
    const totalPayable = this.order.totalAmount + tipAmount + processingFee;
    this.modals.payment.totalPayable = totalPayable;

    const paidAmount = this.app.localeToAPINumber(this.modals.payment.paidAmount.toString());

    if (paidAmount >= totalPayable) {
      this.modals.payment.changeAmount = paidAmount - totalPayable;
      this.modals.payment.remainingAmount = 0;
    } else {
      this.modals.payment.changeAmount = 0;
      this.modals.payment.remainingAmount = totalPayable - paidAmount;
    }
  }

  public keypadInput(value: string): void {
    const separator = this.app.getNumberFormat().decimalSeparator;
    const paidAmount = this.modals.payment.paidAmount.toString();

    if (value === 'clear') {
      this.modals.payment.paidAmount = '0';
    } else if (value === 'backspace') {
      if (paidAmount.length <= 1) {
        this.modals.payment.paidAmount = '0';
      } else {
        this.modals.payment.paidAmount = paidAmount.slice(0, -1) || '0';
      }
    } else if (value === separator) {
      if (!paidAmount.includes(separator)) {
        this.modals.payment.paidAmount = paidAmount + separator;
      }
    } else {
      if (paidAmount.includes(separator)) {
        const parts = paidAmount.split(separator);
        if (parts[1].length >= 2) {
          return;
        }
      }
      if (paidAmount === '0') {
        this.modals.payment.paidAmount = value;
      } else {
        this.modals.payment.paidAmount = paidAmount + value;
      }
    }

    this.updatePaidAmount();
  }

  public exactCash(): void {
    this.modals.payment.paidAmount = this.app.apiNumberToLocale(this.modals.payment.totalPayable);
    this.updatePaidAmount();
  }

  /**
   * Validates payment - Register required ONLY for cash (ID = 3)
   */
  public validatePayment(): boolean {
    if (!this.selectedPaymentMethod) {
      return false;
    }

    const totalPayable = this.modals.payment.totalPayable;
    const paidAmount = this.app.localeToAPINumber(this.modals.payment.paidAmount.toString());

    if ((this.selectedPaymentMethod.id === 4 || this.selectedPaymentMethod.id === 5) && paidAmount < totalPayable) {
      return false;
    }

    // Cash register ONLY required for cash payments (ID = 3)
    if (this.selectedPaymentMethod.id === 3) {
      if (!this.order.registerId) {
        return false;
      }

      const register = this.cashRegisters.find(r => r.id === this.order.registerId);
      if (!register || !register.isOpened) {
        return false;
      }
    }

    if (this.selectedPaymentMethod.id === 4 && !this.modals.payment.paymentReference) {
      return false;
    }

    return true;
  }

  /**
   * Process payment
   */
  public processPayment(): void {
    if (!this.selectedPaymentMethod) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Please select payment method.'));
      return;
    }

    // Validate cash register for cash payments
    if (this.selectedPaymentMethod.id === 3) {
      if (!this.order.registerId) {
        this.app.showErrorMessage(
          this.app.localize('Error!'),
          this.app.localize('Please select a cash register for cash payments.')
        );
        return;
      }

      const register = this.cashRegisters.find(r => r.id === this.order.registerId);
      if (!register) {
        this.app.showErrorMessage(
          this.app.localize('Error!'),
          this.app.localize('Invalid cash register selected.')
        );
        return;
      }

      if (!register.isOpened) {
        this.app.showErrorMessage(
          this.app.localize('Error!'),
          this.app.localize('Cash register is not open. Please open the register before processing cash payments.')
        );
        return;
      }
    }

    const totalPayable = this.modals.payment.totalPayable;
    const paidAmount = this.app.localeToAPINumber(this.modals.payment.paidAmount.toString());

    if ((this.selectedPaymentMethod.id === 4 || this.selectedPaymentMethod.id === 5) && paidAmount < totalPayable) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Insufficient payment amount.'));
      return;
    }

    if (this.selectedPaymentMethod.id === 4 && !this.modals.payment.paymentReference) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Gift card number is required.'));
      return;
    }

    const orderRequest = {
      orderId: this.order.id,
      locationId: this.locationId,
      customerId: this.order.customerId,
      orderType: this.order.orderType,
      tableId: this.order.table?.id || null,
      registerId: null,
      taxRateId: this.order.taxRate?.id || null,
      discountId: this.order.discount?.id || null,
      chargeId: this.order.charge?.id || null,
      guests: this.order.guests,
      notes: this.order.notes,
      specialInstructions: this.order.specialInstructions,
      waiterOrDriver: this.order.waiterOrDriver,
      couponCode: this.order.couponCode || null,
      items: this.cart.map((item: any) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        modifiers: item.modifiers.map((m: any) => ({
          modifierOptionId: m.modifierOptionId
        }))
      }))
    };

    const createOrderCall = this.order.id > 0
      ? this.http.put<any>('/api/sales/updateorder', orderRequest)
      : this.http.post<any>('/api/sales/createorder', orderRequest);

    this.modals.payment.loading = true;

    createOrderCall.subscribe({
      next: (response) => {
        const orderId = response.orderId || this.order.id;

        const paymentRequest = {
          locationId: this.locationId,
          orderId: orderId,
          registerId: this.selectedPaymentMethod!.id === 3 ? this.order.registerId : null,
          paymentMethodId: this.selectedPaymentMethod!.id,
          paymentReference: this.modals.payment.paymentReference,
          paidAmount: this.app.localeToAPINumber(this.modals.payment.paidAmount.toString()),
          tipAmount: this.modals.payment.tipAmount
        };

        this.http.post<any>('/api/sales/processorder', paymentRequest).subscribe({
          next: (response) => {
            this.app.showSuccessMessage(
              this.app.localize('Success!'),
              this.app.localize('Payment processed successfully.')
            );

            setTimeout(() => {
              this.printReceiptAfterPayment(response.invoice);
            }, 300);

            this.clearCart();
            this.resetOrderState();
            this.closePaymentModal();
            this.showMobileCart = false;

            this.loadFloorData();

            this.modals.payment.loading = false;
          },
          error: (error) => {
            this.app.handleApiError(error);
            this.modals.payment.loading = false;
          }
        });
      },
      error: (error) => {
        this.app.handleApiError(error);
        this.modals.payment.loading = false;
      }
    });
  }

  private printReceiptAfterPayment(html: any): void {
    const printWindow = window.open('', '', 'width=900,height=650');
    if (!printWindow) {
      this.app.showErrorMessage(
        this.app.localize('Error!'),
        this.app.localize('Popup blocked. Please allow popups to print receipts.')
      );
      return;
    }

    try {
      const content = String(html || '');
      if (printWindow.document && printWindow.document.documentElement) {
        printWindow.document.documentElement.innerHTML = content;
      } else if (printWindow.document && printWindow.document.body) {
        printWindow.document.body.innerHTML = content;
      } else {
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        printWindow.location.href = url;
      }
    } catch (e) {
      const blob = new Blob([String(html || '')], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      printWindow.location.href = url;
    }

    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        // ignore
      } finally {
        try { printWindow.close(); } catch { /* ignore */ }
      }
    }, 600);
  }

  /*
  |-------------------------------------------------------------------------- 
  | OFFLINE DATA SYNC MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  public showDataSyncModal(): void {
    this.modals.dataSync.show = true;
    this.modals.dataSync.loading = false;
    this.modals.dataSync.selectedOrderIds = [];
    this.modals.dataSync.syncingOrderIds = [];
    this.modals.dataSync.successIds = [];
    this.modals.dataSync.failedIds = [];
    history.pushState(null, '', window.location.pathname);
  }

  public closeDataSyncModal(): void {
    this.resetDataSyncModal();
    history.back();
  }

  public toggleOrderSelection(orderId: number): void {
    const index = this.modals.dataSync.selectedOrderIds.indexOf(orderId);
    if (index === -1) {
      this.modals.dataSync.selectedOrderIds.push(orderId);
    } else {
      this.modals.dataSync.selectedOrderIds.splice(index, 1);
    }
  }

  public selectAllOrders(): void {
    this.modals.dataSync.selectedOrderIds = this.offlineOrders.map(order => order.id);
  }

  public clearOrderSelection(): void {
    this.modals.dataSync.selectedOrderIds = [];
  }

  public syncSelectedOrders(): void {
    if (!this.isOnline) {
      this.app.showErrorMessage(
        this.app.localize('Error!'),
        this.app.localize('Cannot sync orders while offline. Please check your connection.')
      );
      return;
    }

    if (this.modals.dataSync.selectedOrderIds.length === 0) {
      this.app.showErrorMessage(
        this.app.localize('Error!'),
        this.app.localize('Please select at least one order to sync.')
      );
      return;
    }

    this.modals.dataSync.loading = true;
    this.modals.dataSync.syncingOrderIds = [...this.modals.dataSync.selectedOrderIds];
    this.modals.dataSync.successIds = [];
    this.modals.dataSync.failedIds = [];

    const ordersToSync = this.offlineOrders.filter(order =>
      this.modals.dataSync.selectedOrderIds.includes(order.id));

    this.syncNextOfflineOrder(ordersToSync, 0);
  }

  private syncNextOfflineOrder(orders: any[], index: number): void {
    if (index >= orders.length) {
      this.modals.dataSync.loading = false;
      this.loadOfflineOrders();

      const successCount = this.modals.dataSync.successIds.length;
      const failedCount = this.modals.dataSync.failedIds.length;

      this.app.showSuccessMessage(
        this.app.localize('Sync Complete'),
        `${successCount} ${this.app.localize('orders synced successfully')}${failedCount > 0 ? `, ${failedCount} ${this.app.localize('failed')}` : ''}`
      );
      return;
    }

    const order = orders[index];
    this.syncOrderWithServer(order)
      .then(success => {
        if (success) {
          this.modals.dataSync.successIds.push(order.id);
        } else {
          this.modals.dataSync.failedIds.push(order.id);
        }
        this.syncNextOfflineOrder(orders, index + 1);
      })
      .catch(() => {
        this.modals.dataSync.failedIds.push(order.id);
        this.syncNextOfflineOrder(orders, index + 1);
      });
  }

  private syncOrderWithServer(order: any): Promise<boolean> {
    return new Promise((resolve) => {
      const apiCall = order.orderId > 0
        ? this.http.put<any>('/api/sales/updateorder', order)
        : this.http.post<any>('/api/sales/createorder', order);

      apiCall.subscribe({
        next: async () => {
          try {
            this.offlineOrders = this.offlineOrders.filter(o => o.id !== order.id);
            this.app.saveOfflineData(`offlineorders_${this.locationId}`, this.offlineOrders);
            resolve(true);
          } catch (error) {
            //console.error('Failed to delete synced order:', error);
            resolve(false);
          }
        },
        error: () => {
          resolve(false);
        }
      });
    });
  }

  public async deleteOfflineOrder(orderId: number): Promise<void> {
    try {
      this.offlineOrders = this.offlineOrders.filter(o => o.id !== orderId);
      this.app.saveOfflineData(`offlineorders_${this.locationId}`, this.offlineOrders);
      this.app.showSuccessMessage(
        this.app.localize('Success'),
        this.app.localize('Offline order deleted successfully.')
      );
    } catch (error) {
      //console.error('Failed to delete offline order:', error);
      this.app.showErrorMessage(
        this.app.localize('Error!'),
        this.app.localize('Failed to delete offline order.')
      );
    }
  }

  public syncOfflineOrders(): void {
    if (this.offlineOrders.length === 0) {
      this.app.showInfoMessage(
        this.app.localize('Info'),
        this.app.localize('No offline orders to sync.')
      );
      return;
    }

    this.showDataSyncModal();
  }

  /*
  |-------------------------------------------------------------------------- 
  | SPLIT BILL OPERATIONS
  |-------------------------------------------------------------------------- 
  */

  public showSplitBillModal(): void {
    if (this.cart.length < 1) {
      this.app.showErrorMessage(
        this.app.localize('Error!'),
        this.app.localize('At least 1 items required to split bill')
      );
      return;
    }

    if (this.order.id === 0) {
      this.app.showErrorMessage(
        this.app.localize('Error!'),
        this.app.localize('Please save the order first before splitting')
      );
      return;
    }

    this.modals.splitBill.show = true;
    this.modals.splitBill.newCustomerId = this.order.customerId;
    this.modals.splitBill.guestCount = 1;
    this.modals.splitBill.splitQuantities.clear();
    history.pushState(null, '', window.location.pathname);
  }

  public closeSplitBillModal(): void {
    this.resetSplitBillModal();
    history.back();
  }

  public getSplitQuantity(cartItem: any): number {
    return this.modals.splitBill.splitQuantities.get(cartItem.itemId) || 0;
  }

  public setSplitQuantity(cartItem: any, quantity: string | number): void {
    const qty = Math.max(0, Math.min(Number(quantity), cartItem.quantity));
    if (qty > 0) {
      this.modals.splitBill.splitQuantities.set(cartItem.itemId, qty);
    } else {
      this.modals.splitBill.splitQuantities.delete(cartItem.itemId);
    }
  }

  public incrementSplitQuantity(cartItem: any): void {
    const current = this.getSplitQuantity(cartItem);
    if (current < cartItem.quantity) {
      this.modals.splitBill.splitQuantities.set(cartItem.itemId, current + 1);
    }
  }

  public decrementSplitQuantity(cartItem: any): void {
    const current = this.getSplitQuantity(cartItem);
    if (current > 1) {
      this.modals.splitBill.splitQuantities.set(cartItem.itemId, current - 1);
    } else if (current === 1) {
      this.modals.splitBill.splitQuantities.delete(cartItem.itemId);
    }
  }

  public getSplitItems(): any[] {
    const splitItems: any[] = [];

    for (const [itemId, quantity] of this.modals.splitBill.splitQuantities.entries()) {
      const cartItem = this.cart.find(item => item.itemId === itemId);
      if (cartItem && quantity > 0) {
        const modifiersTotal = cartItem.modifiers.reduce((sum: number, mod: any) => sum + (mod.unitPrice || 0), 0);
        const unitTotal = cartItem.unitPrice + modifiersTotal;

        splitItems.push({
          cartItemId: cartItem.id,
          itemName: cartItem.item.itemName,
          quantity: quantity,
          unitPrice: cartItem.unitPrice,
          modifiers: cartItem.modifiers.map((m: any) => m.optionName).join(', '),
          totalAmount: unitTotal * quantity
        });
      }
    }

    return splitItems;
  }

  public getSplitTotal(): number {
    return this.getSplitItems().reduce((total, item) => total + item.totalAmount, 0);
  }

  public canProcessSplit(): boolean {
    const splitItems = this.getSplitItems();

    if (splitItems.length === 0) {
      return false;
    }

    const totalSplitItems = splitItems.length;
    const totalOriginalItems = this.cart.length;

    if (totalSplitItems >= totalOriginalItems) {
      return false;
    }

    let hasPartialSplit = false;
    for (const [itemId, splitQty] of this.modals.splitBill.splitQuantities.entries()) {
      const cartItem = this.cart.find(item => item.itemId === itemId);
      if (cartItem && splitQty < cartItem.quantity) {
        hasPartialSplit = true;
        break;
      }
    }

    if (!hasPartialSplit) {
      let wholeSplitCount = 0;
      for (const [itemId, splitQty] of this.modals.splitBill.splitQuantities.entries()) {
        const cartItem = this.cart.find(item => item.itemId === itemId);
        if (cartItem && splitQty === cartItem.quantity) {
          wholeSplitCount++;
        }
      }
      if (wholeSplitCount >= totalOriginalItems) {
        return false;
      }
    }

    return true;
  }

  public processSplitBill(): void {
    if (!this.canProcessSplit()) {
      this.app.showErrorMessage(
        this.app.localize('Error!'),
        this.app.localize('Invalid split configuration. Please review your selections.')
      );
      return;
    }

    this.modals.splitBill.loading = true;

    const splitRequest = {
      locationId: this.locationId,
      originalOrderId: this.order.id,
      customerId: this.modals.splitBill.newCustomerId,
      guestCount: this.modals.splitBill.guestCount,
      items: this.buildSplitItemsForAPI()
    };

    this.http.post<any>('/api/sales/splitbill', splitRequest).subscribe({
      next: (response) => {
        this.modals.splitBill.loading = false;
        this.closeSplitBillModal();

        this.updateCartAfterSplit();

        this.app.showSuccessMessage(
          this.app.localize('Success!'),
          this.app.localize('Bill split successfully.')
        );

        this.clearCart();
        this.resetOrderState();
      },
      error: (error) => {
        this.app.handleApiError(error);
        this.modals.splitBill.loading = false;
      }
    });
  }

  private buildSplitItemsForAPI(): any[] {
    const splitItems: any[] = [];

    for (const [itemId, splitQuantity] of this.modals.splitBill.splitQuantities.entries()) {
      const cartItem = this.cart.find(item => item.itemId === itemId);
      if (cartItem && splitQuantity > 0) {
        splitItems.push({
          itemId: cartItem.itemId,
          quantity: splitQuantity
        });
      }
    }

    return splitItems;
  }

  private updateCartAfterSplit(): void {
    const itemsToRemove: string[] = [];

    for (const [itemId, splitQuantity] of this.modals.splitBill.splitQuantities.entries()) {
      const cartItem = this.cart.find(item => item.itemId === itemId);
      if (cartItem) {
        if (splitQuantity >= cartItem.quantity) {
          itemsToRemove.push(itemId);
        } else {
          cartItem.quantity -= splitQuantity;
          cartItem.totalAmount = (cartItem.unitPrice + cartItem.modifiersTotal) * cartItem.quantity;
        }
      }
    }

    this.cart = this.cart.filter(item => !itemsToRemove.includes(item.itemId));
    this.calculateOrderTotals();
  }

  public getCombinedModifierNames(cartItem: any): string {
    return cartItem.modifiers.map((m: any) => m.optionName).join(', ');
  }

  /*
  |-------------------------------------------------------------------------- 
  | ORDER HOLD/RECALL OPERATIONS
  |-------------------------------------------------------------------------- 
  */

  public holdOrder(): void {
    if (this.cart.length === 0) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Cart is empty.'));
      return;
    }

    const heldOrder = {
      id: 1,
      cart: [...this.cart],
      customer: this.order.customer,
      table: this.order.table,
      orderType: this.order.orderType,
      guests: this.order.guests,
      notes: this.order.notes,
      specialInstructions: this.order.specialInstructions,
      taxRate: this.order.taxRate,
      discount: this.order.discount,
      charge: this.order.charge,
      couponCode: this.order.couponCode,
      couponDiscount: this.order.couponDiscount,
      timestamp: new Date().toISOString()
    };

    this.app.saveOfflineData(`heldorder_${this.locationId}`, heldOrder);
    this.app.showSuccessMessage(this.app.localize('Success'), this.app.localize('Order held successfully'));
  }

  public recallOrder(): void {
    this.loadHeldOrder().then(() => {
      if (!this.heldOrder) {
        this.app.showInfoMessage(this.app.localize('Info'), this.app.localize('No held orders'));
        return;
      }

      if (this.cart.length > 0) {
        this.app.confirmDialog(
          this.app.localize('Confirm'),
          this.app.localize('This will replace your current cart. Continue?'),
          () => this.loadHeldOrderToCart(),
          () => { },
          `<i class="ri-check-line"></i>` + this.app.localize('Yes'),
          `<i class="ri-close-line"></i>` + this.app.localize('No')
        );
      } else {
        this.loadHeldOrderToCart();
      }
    });
  }

  private loadHeldOrderToCart(): void {
    if (!this.heldOrder) return;

    this.cart = [...this.heldOrder.cart];
    this.order.customer = this.heldOrder.customer;
    this.order.customerId = this.heldOrder.customer?.id || this.order.customerId;
    this.order.customerName = this.heldOrder.customer?.fullName || this.order.customerName;
    this.order.table = this.heldOrder.table;
    this.order.tableId = this.heldOrder.table?.id || null;
    this.order.orderType = this.heldOrder.orderType;
    this.order.guests = this.heldOrder.guests;
    this.order.notes = this.heldOrder.notes;
    this.order.specialInstructions = this.heldOrder.specialInstructions;
    this.order.taxRate = this.heldOrder.taxRate;
    this.order.taxRateId = this.heldOrder.taxRate?.id || null;
    this.order.discount = this.heldOrder.discount;
    this.order.discountId = this.heldOrder.discount?.id || null;
    this.order.charge = this.heldOrder.charge;
    this.order.chargeId = this.heldOrder.charge?.id || null;
    this.order.couponCode = this.heldOrder.couponCode || '';
    this.order.couponDiscount = this.heldOrder.couponDiscount || 0;

    this.app.deleteOfflineData(`heldorder_${this.locationId}`);
    this.heldOrder = null;
    this.calculateOrderTotals();
    this.app.showSuccessMessage(this.app.localize('Success'), this.app.localize('Order recalled successfully'));
  }

  /*
  |-------------------------------------------------------------------------- 
  | ITEM DETAIL & MODIFIER MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  public showItemDetailModal(item: any): void {
    this.modals.itemDetail.show = true;
    this.modals.itemDetail.item = item;
    this.modals.itemDetail.selectedModifiers = [];
    this.modals.itemDetail.selectedModifierId = null;
    this.modals.itemDetail.quantity = 1;
    this.modals.itemDetail.notes = '';
    this.modals.itemDetail.validated = false;
    this.modals.itemDetail.isEdit = false;
    this.modals.itemDetail.cartItemId = null;

    if (this.modals.itemDetail.item?.itemImages) {
      this.modals.itemDetail.selectedImageIndex = 0;
      this.app.loadImages('[data-gallery-img="true"]');
    }

    if (item.itemModifiers) {
      item.itemModifiers.forEach((itemMod: any) => {
        if (itemMod.isRequired && itemMod.modifier.modifierOptions) {
          const defaultOption = itemMod.modifier.modifierOptions.find((opt: any) => opt.isDefault);
          if (defaultOption) {
            this.modals.itemDetail.selectedModifiers.push({
              modifierId: itemMod.modifierId,
              modifierOptionId: defaultOption.id,
              optionName: defaultOption.optionName,
              unitPrice: defaultOption.price,
              modifierName: itemMod.modifier.modifierName
            });
          }
        }
      });
    }

    history.pushState(null, '', window.location.pathname);
  }

  public closeItemDetailModal(): void {
    this.resetItemDetailModal();
    history.back();
  }

  public selectModifier(modifierId: number): void {
    this.modals.itemDetail.selectedModifierId =
      this.modals.itemDetail.selectedModifierId === modifierId ? null : modifierId;
  }

  public toggleModifierOption(modifier: any, option: any): void {
    const existingIndex = this.modals.itemDetail.selectedModifiers.findIndex(
      (m: any) => m.modifierOptionId === option.id
    );

    if (existingIndex !== -1) {
      this.modals.itemDetail.selectedModifiers.splice(existingIndex, 1);
    } else {
      const itemMod = this.modals.itemDetail.item?.itemModifiers?.find(
        (im: any) => im.modifierId === modifier.id
      );

      if (itemMod) {
        const currentSelections = this.modals.itemDetail.selectedModifiers.filter(
          (m: any) => m.modifierId === modifier.id
        ).length;

        if (currentSelections >= itemMod.maxSelection) {
          return;
        }

        this.modals.itemDetail.selectedModifiers.push({
          modifierId: modifier.id,
          modifierOptionId: option.id,
          optionName: option.optionName,
          unitPrice: option.price,
          modifierName: modifier.modifierName
        });
      }
    }
  }

  public isModifierOptionSelected(optionId: number): boolean {
    return this.modals.itemDetail.selectedModifiers.some((m: any) => m.modifierOptionId === optionId);
  }

  public getModifierSelectionCount(modifierId: number): number {
    return this.modals.itemDetail.selectedModifiers.filter((m: any) => m.modifierId === modifierId).length;
  }

  public addItemWithModifiers(): void {
    if (!this.modals.itemDetail.item) return;

    if (this.modals.itemDetail.item.itemModifiers) {
      for (const itemMod of this.modals.itemDetail.item.itemModifiers) {
        if (itemMod.isRequired) {
          const selectedCount = this.modals.itemDetail.selectedModifiers.filter(
            (m: any) => m.modifierId === itemMod.modifierId
          ).length;

          if (selectedCount < itemMod.minSelection) {
            this.app.showErrorMessage(
              this.app.localize('Error!'),
              `${itemMod.modifier.modifierName} ${this.app.localize('requires at least')} ${itemMod.minSelection} ${this.app.localize('selection(s)')}`
            );
            return;
          }

          if (selectedCount > itemMod.maxSelection) {
            this.app.showErrorMessage(
              this.app.localize('Error!'),
              `${itemMod.modifier.modifierName} ${this.app.localize('allows maximum')} ${itemMod.maxSelection} ${this.app.localize('selection(s)')}`
            );
            return;
          }
        }
      }
    }

    if (this.modals.itemDetail.isEdit && this.modals.itemDetail.cartItemId) {
      this.updateCartItem(
        this.modals.itemDetail.cartItemId,
        this.modals.itemDetail.quantity,
        this.modals.itemDetail.selectedModifiers,
        this.modals.itemDetail.notes
      );
    } else {
      this.addItemToCart(
        this.modals.itemDetail.item,
        this.modals.itemDetail.quantity,
        this.modals.itemDetail.selectedModifiers,
        this.modals.itemDetail.notes
      );
    }

    this.closeItemDetailModal();
  }

  public getItemDetailTotal(): number {
    if (!this.modals.itemDetail.item) return 0;

    const modifiersTotal = this.modals.itemDetail.selectedModifiers.reduce(
      (sum: number, mod: any) => sum + (mod.unitPrice || 0), 0
    );

    return (this.modals.itemDetail.item.price + modifiersTotal) * this.modals.itemDetail.quantity;
  }

  public getCurrentImage(): any {
    if (this.modals.itemDetail.item?.itemImages) {
      const image = this.modals.itemDetail.item.itemImages[this.modals.itemDetail.selectedImageIndex] || null;
      return this.app.itemImageUrl(image?.imageUrl, false) || 'assets/images/default.png';
    }
    return 'assets/images/default.png';
  }

  public previousImage(): void {
    if (this.modals.itemDetail.item?.itemImages) {
      this.modals.itemDetail.selectedImageIndex = this.modals.itemDetail.selectedImageIndex > 0
        ? this.modals.itemDetail.selectedImageIndex - 1
        : this.modals.itemDetail.item.itemImages.length - 1;
      this.app.loadImages('[data-gallery-img="true"]');
    }
  }

  public nextImage(): void {
    if (this.modals.itemDetail.item?.itemImages) {
      this.modals.itemDetail.selectedImageIndex = this.modals.itemDetail.selectedImageIndex < this.modals.itemDetail.item.itemImages.length - 1
        ? this.modals.itemDetail.selectedImageIndex + 1
        : 0;
      this.app.loadImages('[data-gallery-img="true"]');
    }
  }

  /*
  |-------------------------------------------------------------------------- 
  | MODAL MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  public showOrderConfigModal(isNewOrder: boolean): void {
    if (isNewOrder && this.cart.length !== 0) {
      this.app.confirmDialog(
        this.app.localize('Confirm'),
        this.app.localize('Starting a new order will clear the current order. Do you want to continue?'),
        () => {
          this.clearOrder();
          this.modals.orderConfig.show = true;
          if (this.floorAreas.length > 0) {
            this.selectFloorForConfig(this.floorAreas[0].id);
          }
          history.pushState(null, '', window.location.pathname);
        },
        () => { },
        `<i class="ri-check-line"></i>` + this.app.localize('Continue'),
        `<i class="ri-close-line"></i>` + this.app.localize('Cancel')
      );
      return;
    }
    this.modals.orderConfig.show = true;
    if (this.floorAreas.length > 0 && !this.selectedFloor) {
      this.selectFloorForConfig(this.floorAreas[0].id);
    }
    if (this.selectedFloor) {
      this.selectFloorForConfig(this.selectedFloor.id);
    }
    history.pushState(null, '', window.location.pathname);
  }

  public closeOrderConfigModal(): void {
    this.resetOrderConfigModal();
    if (!this.showMobileCart) {
      history.back();
    }
  }

  public showActiveOrdersModal(): void {
    this.modals.activeOrders.show = true;
    history.pushState(null, '', window.location.pathname);
  }

  public closeActiveOrdersModal(): void {
    this.resetActiveOrdersModal();
    history.back();
  }

  public printActiveOrder(event: Event, order: any): void {
    event.stopPropagation();

    if (!order?.id || this.printingOrderId) {
      return;
    }

    this.printingOrderId = order.id;

    this.http.get(`/api/sales/viewinvoice/${order.id}`, {
      params: {
        locationId: (this.locationId || 0).toString(),
        isReturnInvoice: 'false'
      },
      responseType: 'text'
    }).subscribe({
      next: html => {
        this.printingOrderId = null;
        this.printReceiptAfterPayment(html);
      },
      error: error => {
        this.printingOrderId = null;
        this.app.handleApiError(error);
      }
    });
  }

  /*
  |-------------------------------------------------------------------------- 
  | PRINTING & RECEIPTS
  |-------------------------------------------------------------------------- 
  */

  public printKitchenOrder(): void {
    if (this.cart.length === 0) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Nothing to print'));
      return;
    }

    this.modals.kitchenPrint.orderData = {
      orderNumber: this.order.id || '',
      table: this.order.table?.tableNumber || '',
      orderType: this.getOrderTypeText(this.order.orderType),
      orderDate: this.order.orderDate ? this.app.formatDateTime(this.order.orderDate) : this.app.getLocalCurrentDateTime(),
      branchName: this.app.getSelectedLocationName(),
      waiterOrDriver: this.order.waiterOrDriver || '',
      specialInstructions: this.order.specialInstructions,
      items: this.cart.map((item: any) => ({
        name: item.item.itemName,
        quantity: item.quantity,
        modifiers: item.modifiers.map((m: any) => m.optionName),
        notes: item.notes
      }))
    };

    this.modals.kitchenPrint.show = true;
    setTimeout(() => {
      this.printKitchenOrderDocument();
    }, 300);
    history.pushState(null, '', window.location.pathname);
  }

  public printKitchenOrderDocument(): void {
    const srcEl = document.getElementById('kitchen-invoice');
    if (!srcEl) return;

    const printWindow = window.open('', '', 'width=900,height=650');
    if (!printWindow) return;

    const baseHref = document.querySelector('base')?.href || document.baseURI;
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');
    const title = 'Kitchen Order';

    printWindow.document.write(`
            <!doctype html>
            <html>
            <head>
                <base href="${baseHref}">
                <title>${title}</title>
                ${styles}
            </head>
            <body>
            ${srcEl.outerHTML}
            </body>
            </html>
        `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 600);
  }

  public closeKitchenPrintModal(): void {
    this.resetKitchenPrintModal();
    history.back();
  }

  /*
  |-------------------------------------------------------------------------- 
  | ORDER OPERATIONS & MANAGEMENT
  |-------------------------------------------------------------------------- 
  */

  /**
   * Reset order state - NO auto-selection of register
   */
  private resetOrderState(): void {
    this.order = {
      id: 0,
      orderType: OrderType.DineIn,
      customerId: this.order.customer?.id || 1,
      customer: this.order.customer,
      customerName: this.order.customer?.fullName || 'Walk-in Customer',
      tableId: null,
      table: null,
      guests: 1,
      registerId: null,
      taxRateId: this.order.taxRate?.id || null,
      taxRate: this.order.taxRate || null,
      discountId: this.order.discount?.id || null,
      discount: this.order.discount || null,
      chargeId: this.order.charge?.id || null,
      charge: this.order.charge || null,
      couponCode: '',
      couponDiscount: 0,
      subTotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      chargeAmount: 0,
      totalAmount: 0,
      totalPayable: 0,
      paidAmount: 0,
      changeAmount: 0,
      remainingAmount: 0,
      processingFee: 0,
      tipAmount: 0,
      waiterOrDriver: null
    };

    this.selectedPaymentMethod = null;
    this.floorService.setSelectedTable(null);
    this.selectOrderType(this.order.orderType);
    this.calculateOrderTotals();
  }

  public clearOrder(): void {
    this.clearCart();
    this.resetOrderState();
  }

  public openOrderForEdit(id: number): void {
    const active = this.activeOrders.find((o: any) => o.id === id);
    if (!active) {
      this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Order not found.'));
      return;
    }

    this.clearOrder();

    this.order.id = active.id;
    this.order.customer = active.customer || null;
    this.order.customerId = active.customer?.id || null;
    this.order.orderType = active.orderType ?? OrderType.DineIn;
    this.selectOrderType(this.order.orderType);
    this.order.guests = active.guests ?? 1;
    this.order.notes = active.notes ?? '';
    this.order.specialInstructions = active.specialInstructions ?? '';
    this.order.waiterOrDriver = active.waiterOrDriver ?? '';
    this.order.registerId = active.registerId ?? null;

    const taxId = active.taxRateId ?? active.taxRate?.id ?? null;
    const discountId = active.discountId ?? active.discount?.id ?? null;
    const chargeId = active.chargeId ?? active.charge?.id ?? null;

    this.order.taxRate = this.taxRates.find((t: any) => t.id === taxId) || null;
    this.order.taxRateId = this.order.taxRate ? this.order.taxRate.id : null;
    this.order.discount = this.discounts.find((d: any) => d.id === discountId) || null;
    this.order.discountId = this.order.discount ? this.order.discount.id : null;
    this.order.charge = this.charges.find((c: any) => c.id === chargeId) || null;
    this.order.chargeId = this.order.charge ? this.order.charge.id : null;

    this.order.table = active.table || null;
    this.order.tableId = active.table?.id || active.tableId || null;
    if (this.order.table) {
      this.floorService.setSelectedTable(this.order.table);
    }

    const rawItems: any[] = active.orderItems ?? [];

    this.cart = rawItems.map((it: any) => {
      const itemId = it.itemId ?? null;
      const existingItem = this.items.find(i => i.id === itemId) || {
        id: itemId ?? `unknown_${Math.random()}`,
        itemName: it.itemName ?? 'Item',
        price: it.unitPrice ?? 0,
        itemImages: it.itemImages ?? []
      };

      const rawModifiers: any[] = it.orderItemModifiers ?? [];
      const modifiers = rawModifiers.map((m: any) => {
        const option = m.modifierOption ?? m;
        return {
          modifierId: m.modifierId ?? null,
          modifierOptionId: m.modifierOptionId ?? null,
          optionName: option?.optionName ?? '',
          unitPrice: m.unitPrice || 0,
          modifierName: m.modifier?.modifierName ?? ''
        };
      });

      const unitPrice = it.unitPrice || 0;
      const modifiersTotal = modifiers.reduce((s: number, mm: any) => s + (mm.unitPrice || 0), 0);
      const qty = it.quantity ?? it.qty ?? 1;
      const totalAmount = (unitPrice + modifiersTotal) * qty;

      return {
        id: `${existingItem.id}_${Date.now()}_${Math.random()}`,
        itemId: existingItem.id,
        item: existingItem,
        quantity: qty,
        unitPrice: unitPrice,
        modifiers: modifiers,
        modifiersTotal: modifiersTotal,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: totalAmount,
        notes: it.notes || it.note || '',
        cogsAmount: it.cogsamount || 0
      };
    });

    this.calculateOrderTotals();

    if (this.isMobileView) {
      this.showMobileCart = true;
    }
    this.closeActiveOrdersModal();
    this.app.loadImages('[data-cart-img="true"]');
  }

  /*
  |-------------------------------------------------------------------------- 
  | UTILITY & FORMATTING METHODS
  |-------------------------------------------------------------------------- 
  */

  public formatCurrency(amount: number): string {
    return this.app.formatCurrency(amount);
  }

  public formatDateTime(date: string | Date): string {
    return this.app.formatDateTime(date.toString());
  }

  public getOrderTypeText(orderType: OrderType): string {
    switch (orderType) {
      case OrderType.DineIn: return this.app.localize('Dine In');
      case OrderType.Takeaway: return this.app.localize('Takeaway');
      case OrderType.Delivery: return this.app.localize('Delivery');
      case OrderType.Online: return this.app.localize('Online');
      default: return this.app.localize('Unknown');
    }
  }

  public getOrderTypeBadge(orderType: OrderType): string {
    const option = this.orderTypeOptions.find(opt => opt.value === orderType);
    const label = option?.label || 'Unknown';
    const cssClass = option?.class || 'badge-secondary';
    return `<span class="badge ${cssClass}">${this.app.localize(label)}</span>`;
  }

  public getOrderStatusText(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.Pending: return this.app.localize('Pending');
      case OrderStatus.Ready: return this.app.localize('Ready');
      case OrderStatus.InProgress: return this.app.localize('In Progress');
      case OrderStatus.Completed: return this.app.localize('Completed');
      case OrderStatus.Cancelled: return this.app.localize('Cancelled');
      default: return this.app.localize('Unknown');
    }
  }

  public getOrderStatusBadge(status: OrderStatus): string {
    const option = this.orderStatusOptions.find(opt => opt.value === status);
    const label = option?.label || 'Unknown';
    const cssClass = option?.class || 'badge-secondary';
    return `<span class="badge ${cssClass}">${this.app.localize(label)}</span>`;
  }

  public getStatusBadgeClass(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.Pending: return 'badge-warning';
      case OrderStatus.Ready: return 'badge-info';
      case OrderStatus.InProgress: return 'badge-primary';
      case OrderStatus.Completed: return 'badge-success';
      case OrderStatus.Cancelled: return 'badge-danger';
      default: return 'badge-secondary';
    }
  }
}
