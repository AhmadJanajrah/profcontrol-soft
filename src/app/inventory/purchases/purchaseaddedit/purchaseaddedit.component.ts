import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

// Enums matching backend exactly
export enum OrderStatus {
	Pending = 1,
	InProgress = 2,
	Completed = 4,
	Cancelled = 5
}

@Component({
	selector: 'app-purchaseaddedit',
	templateUrl: './purchaseaddedit.component.html',
	standalone: true,
	imports: [AppImports]
})
export class PurchaseAddEditComponent implements OnInit {

	// Component state flags
	public isLoading = true;
	public isSubmitted = false;
	public isValidated = false;
	public isEditMode = false;

	// Purchase order data model matching database schema
	public purchaseOrder: any = {
		id: 0,
		locationId: 0,
		supplierId: null,
		paymentMethodId: null,
		taxRateId: null,
		reference: '',
		orderDate: '',
		expectedDeliveryDate: '',
		paymentReference: '',
		notes: '',
		shippingCost: '',
		discountAmount: '',
		paidAmount: '',
		status: OrderStatus.Pending,
		items: []
	};

	// Form data
	public suppliers: any[] = [];
	public paymentMethods: any[] = [];
	public taxRates: any[] = [];
	public items: any[] = [];

	// Status options for dropdown
	public statusOptions = [
		{ value: OrderStatus.Pending, label: 'Pending' },
		{ value: OrderStatus.InProgress, label: 'In Progress' },
		{ value: OrderStatus.Completed, label: 'Completed' },
		{ value: OrderStatus.Cancelled, label: 'Cancelled' },
	];

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) {
		this.localizeStatusOptions();
		this.resetForm();
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.checkRouteParams();
	}

	// --- Initialization Methods ---

	// Localize status options
	private localizeStatusOptions(): void {
		this.statusOptions.forEach(option => {
			option.label = this.app.localize(option.label);
		});
	}

	// Check route parameters and determine mode
	private checkRouteParams(): void {
		const purchaseOrderId = Number(this.route.snapshot.paramMap.get('id'));

		if (purchaseOrderId && purchaseOrderId > 0) {
			this.isEditMode = true;
			this.purchaseOrder.id = purchaseOrderId;
			this.loadPurchaseOrderData(purchaseOrderId);
		} else {
			this.isEditMode = false;
			this.loadFormData();
		}
	}

	// Reset purchase order form model and validation state
	private resetForm(): void {
		this.purchaseOrder = {
			id: 0,
			locationId: this.app.getSelectedLocationId() || 0,
			supplierId: null,
			paymentMethodId: null,
			taxRateId: null,
			reference: '',
			orderDate: this.app.currentHTMLDate(),
			expectedDeliveryDate: '',
			paymentReference: '',
			notes: '',
			shippingCost: '',
			discountAmount: '',
			paidAmount: '',
			status: OrderStatus.Completed,
			items: []
		};
		this.isSubmitted = false;
		this.isValidated = false;
	}

	// Load form data
	private loadFormData(): void {
		this.http.get<any>(`/api/inventory/getpurchaseformdata?locationId=${this.purchaseOrder.locationId}`).subscribe({
			next: (response) => {
				this.suppliers = response.suppliers || [];
				this.paymentMethods = response.paymentMethods || [];
				this.taxRates = response.taxRates || [];
				this.items = response.items || [];

				// Format tax rates display
				this.taxRates.forEach(tr => {
					tr.displayName = `${tr.taxName} (${tr.isPercentage ? this.app.formatPercent(tr.taxValue) : this.app.formatCurrency(tr.taxValue)})`;
				});

				this.isLoading = false;
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.isLoading = false;
			}
		});
	}

	// Load existing purchase order data for editing
	private loadPurchaseOrderData(purchaseOrderId: number): void {
		this.http.get<any>(`/api/inventory/getpurchaseorder/${purchaseOrderId}`).subscribe({
			next: (response) => {
				const orderData = response.purchaseOrder;

				this.purchaseOrder = {
					id: orderData.id,
					locationId: orderData.locationId,
					supplierId: orderData.supplierId,
					paymentMethodId: orderData.paymentMethodId,
					taxRateId: orderData.taxRateId,
					reference: orderData.reference || '',
					orderDate: this.app.APIDateTimeToHTMLDate(orderData.orderDate),
					expectedDeliveryDate: orderData.expectedDeliveryDate ? this.app.APIDateTimeToHTMLDate(orderData.expectedDeliveryDate) : '',
					paymentReference: orderData.paymentReference || '',
					notes: orderData.notes || '',
					shippingCost: this.app.apiNumberToLocale(orderData.shippingCost || 0),
					discountAmount: this.app.apiNumberToLocale(orderData.discountAmount || 0),
					paidAmount: this.app.apiNumberToLocale(orderData.paidAmount || 0),
					status: orderData.status,
					items: (orderData.purchaseOrderItems || []).map((item: any) => ({
						itemId: item.itemId,
						quantity: this.app.apiNumberToLocale(item.quantity),
						unitPrice: this.app.apiNumberToLocale(item.unitPrice),
						item: item.item || {},
						imageUrl: this.app.itemImageUrl(item.item?.imageUrl)
					}))
				};

				this.loadFormData();
			},
			error: (error) => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Items Management ---

	// Add new purchase order item
	public addItem(itemId: any): void {
		const id = Number(itemId);
		if (!id || id <= 0) return;

		const existingItem = this.purchaseOrder.items.find((i: any) => i.itemId === id);
		if (existingItem) {
			this.increaseQuantity(id);
			return;
		}

		const item = this.items.find(i => i.id === id);
		if (item) {
			this.purchaseOrder.items.push({
				itemId: id,
				quantity: this.app.apiNumberToLocale(1),
				unitPrice: this.app.apiNumberToLocale(item.cost || 0),
				item: item,
				imageUrl: this.app.itemImageUrl(item.imageUrl)
			});
		}
	}

	// Remove purchase order item
	public removeItem(index: number): void {
		if (this.purchaseOrder.items.length > 0) {
			this.purchaseOrder.items.splice(index, 1);
		}
	}

	// Increase item quantity
	public increaseQuantity(itemId: any): void {
		const item = this.purchaseOrder.items.find((i: any) => i.itemId === itemId);
		if (!item) return;
		let qty = this.app.localeToAPINumber(item.quantity);
		qty++;
		item.quantity = this.app.apiNumberToLocale(qty);
	}

	// Decrease item quantity
	public decreaseQuantity(itemId: any): void {
		const item = this.purchaseOrder.items.find((i: any) => i.itemId === itemId);
		if (!item) return;
		let qty = this.app.localeToAPINumber(item.quantity);
		if (qty > 1) qty--;
		item.quantity = this.app.apiNumberToLocale(qty);
	}

	// Calculate item total
	public getItemTotal(item: any): number {
		const qty = this.app.localeToAPINumber(item.quantity);
		const price = this.app.localeToAPINumber(item.unitPrice);
		return qty * price;
	}

	// Calculate subtotal
	public getSubTotal(): number {
		return this.purchaseOrder.items.reduce((sum: any, item: any) => sum + this.getItemTotal(item), 0);
	}

	// Calculate tax amount
	public getTaxAmount(): number {
		if (!this.purchaseOrder.taxRateId) return 0;

		const taxRate = this.taxRates.find(t => t.id === this.purchaseOrder.taxRateId);
		if (!taxRate) return 0;

		const taxableBase = Math.max(0, this.getSubTotal() - this.app.localeToAPINumber(this.purchaseOrder.discountAmount));
		return taxRate.isPercentage ? (taxableBase * taxRate.taxValue / 100) : taxRate.taxValue;
	}

	// Calculate total amount
	public getTotalAmount(): number {
		const subtotal = this.getSubTotal();
		const shipping = this.app.localeToAPINumber(this.purchaseOrder.shippingCost);
		const discount = this.app.localeToAPINumber(this.purchaseOrder.discountAmount);
		const tax = this.getTaxAmount();

		return Math.max(0, subtotal - discount + shipping + tax);
	}

	// Set maximum paid amount
	public setMaxPaidAmount(): void {
		const totalAmount = this.getTotalAmount();
		this.purchaseOrder.paidAmount = this.app.apiNumberToLocale(totalAmount);
	}

	// --- Form Submission Methods ---

	// Handle form submission
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.isValidated = true;
			return;
		}
		
		// Check if items exist
		if (!this.purchaseOrder.items || this.purchaseOrder.items.length === 0) {
			this.app.showErrorMessage(
				this.app.localize('Error!'),
				this.app.localize('Purchase order must contain at least one item.')
			);
			return;
		}

		this.isSubmitted = true;

		const url = this.isEditMode
			? `/api/inventory/updatepurchaseorder/${this.purchaseOrder.id}`
			: '/api/inventory/createpurchaseorder';

		const payload = this.preparePurchaseOrderData();

		const request$ = this.isEditMode
			? this.http.put<any>(url, payload)
			: this.http.post<any>(url, payload);

		request$.subscribe({
			next: (response) => {
				const successMessage = this.isEditMode
					? this.app.localize('Purchase order updated successfully.')
					: this.app.localize('Purchase order created successfully.');

				this.app.showSuccessMessage(this.app.localize('Success!'), successMessage);
				
				if(!this.isEditMode){
					this.resetForm();
				}
				this.isSubmitted = false;
				this.isValidated = false;
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.isSubmitted = false;
			}
		});
	}

	// Prepare purchase order data for submission matching database schema
	private preparePurchaseOrderData(): any {
		return {
			locationId: this.purchaseOrder.locationId,
			supplierId: this.purchaseOrder.supplierId,
			paymentMethodId: this.purchaseOrder.paymentMethodId,
			taxRateId: this.purchaseOrder.taxRateId || undefined,
			reference: this.purchaseOrder.reference || undefined,
			orderDate: this.purchaseOrder.orderDate ? this.app.HTMLDateToAPIDateTime(this.purchaseOrder.orderDate) : undefined,
			expectedDeliveryDate: this.purchaseOrder.expectedDeliveryDate ? this.app.HTMLDateToAPIDateTime(this.purchaseOrder.expectedDeliveryDate) : undefined,
			paymentReference: this.purchaseOrder.paymentReference || undefined,
			notes: this.purchaseOrder.notes || undefined,
			shippingCost: this.app.localeToAPINumber(this.purchaseOrder.shippingCost),
			discountAmount: this.app.localeToAPINumber(this.purchaseOrder.discountAmount),
			paidAmount: this.app.localeToAPINumber(this.purchaseOrder.paidAmount),
			status: this.purchaseOrder.status,
			items: this.purchaseOrder.items.map((item: any) => ({
				itemId: item.itemId,
				quantity: this.app.localeToAPINumber(item.quantity),
				unitPrice: this.app.localeToAPINumber(item.unitPrice)
			}))
		};
	}

	// --- Utility Methods ---

	// Get page title
	public getPageTitle(): string {
		return this.isEditMode
			? this.app.localize('Edit Purchase')
			: this.app.localize('Add Purchase');
	}

	// View purchase order (for edit mode)
	public viewPurchaseOrder(): void {
		if (this.purchaseOrder.id && this.purchaseOrder.id > 0) {
			this.app.navigate(`/inventory/purchases/view/${this.purchaseOrder.id}`);
		}
	}
}