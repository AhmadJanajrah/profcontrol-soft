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

export enum PaymentStatus {
    Paid = 1,
    Unpaid = 2,
    Partial = 3,
    Refunded = 4
}

@Component({
    selector: 'app-purchasereturn',
    templateUrl: './purchasereturn.component.html',
	standalone: true,
	imports: [AppImports]
})
export class PurchaseReturnComponent implements OnInit {

    // Component state flags
    public isLoading = true;
    public isSubmitted = false;
    public isValidated = false;

    // Purchase order and return data
    public purchaseOrder: any = null;
    public purchaseReturn: any = {
        reason: '',
        notes: '',
        returnReference: '',
        returnChargeAmount: '0',
        items: []
    };

    // Enhanced calculations with user-configurable charges
    public calculations = {
        subtotal: 0,
        discount: 0,
        tax: 0,
        charges: 0,
        total: 0
    };

    // Common return reasons
    public returnReasons = [
        'Damaged items',
        'Wrong items delivered',
        'Quality issues',
        'Expired products',
        'Order error',
        'Supplier fault',
        'Restocking fee',
        'Other'
    ];

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute,
        private router: Router,
        public app: AppService
    ) {
        // Localize return reasons
        this.returnReasons = this.returnReasons.map(reason => this.app.localize(reason));
        this.resetForm();
    }

    // Lifecycle hooks
    ngOnInit(): void {
        const purchaseOrderId = Number(this.route.snapshot.paramMap.get('id'));
        if (!purchaseOrderId || purchaseOrderId <= 0) {
            this.navigateBack();
            return;
        }
        this.loadPurchaseOrder(purchaseOrderId);
    }

    // --- Initialization Methods ---

    // Reset return form
    private resetForm(): void {
        this.purchaseReturn = {
            reason: '',
            notes: '',
            returnReference: '',
            returnChargeAmount: this.app.apiNumberToLocale(0),
            items: []
        };
        this.isSubmitted = false;
        this.isValidated = false;
        this.calculations = {
            subtotal: 0,
            discount: 0,
            tax: 0,
            charges: 0,
            total: 0
        };
    }

    // Load purchase order data
    private loadPurchaseOrder(purchaseOrderId: number): void {
        this.http.get<any>(`/api/inventory/getpurchaseorder/${purchaseOrderId}`).subscribe({
            next: (response) => {
                this.purchaseOrder = response.purchaseOrder;

                // Validate that purchase order can be returned
                if (!this.canReturn()) {
                    this.app.showErrorMessage(
                        this.app.localize('Error!'),
                        this.app.localize('Only completed purchase orders can be returned.')
                    );
                    this.navigateBack();
                    return;
                }

                // Initialize return items based on purchase order items
                this.purchaseReturn.items = (this.purchaseOrder.purchaseOrderItems || []).map((item: any) => ({
                    itemId: item.itemId,
                    quantity: '0',
                    unitCost: this.app.apiNumberToLocale(item.unitPrice || 0),
                    item: item.item || {},
                    imageUrl: item.item?.imageUrl ? this.app.apiUrl(`/api/media/getthumbnailimage/images/${item.item.imageUrl}`) : ''
                }));

                this.calculateReturnTotals();
                this.isLoading = false;
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.navigateBack();
            }
        });
    }

    // --- Validation Methods ---

    // Check if purchase order can be returned
    public canReturn(): boolean {
        return this.purchaseOrder && this.purchaseOrder.status === OrderStatus.Completed;
    }

    // Check if there are items to return
    public hasItemsToReturn(): boolean {
        return this.getItemsToReturn().length > 0;
    }

    // Get items that have quantity > 0
    public getItemsToReturn(): any[] {
        return this.purchaseReturn.items.filter((item: any) => 
            this.app.localeToAPINumber(item.quantity) > 0
        );
    }

    // --- Item Management Methods ---

    // Get item details from purchase order
    public getItemDetails(itemId: number): any {
        const orderItem = this.purchaseOrder.purchaseOrderItems?.find((poi: any) => poi.itemId === itemId);
        if (!orderItem) return { name: '', unitOfMeasure: '', orderedQuantity: 0, returnedQuantity: 0, imageUrl: '' };

        return {
            name: orderItem.item?.itemName || '',
            unitOfMeasure: orderItem.item?.unitOfMeasure || '',
            orderedQuantity: orderItem.quantity || 0,
            returnedQuantity: orderItem.returnedQuantity || 0,
            imageUrl: orderItem.item?.imageUrl ? this.app.apiUrl(`/api/media/getthumbnailimage/images/${orderItem.item.imageUrl}`) : ''
        };
    }

    // Get maximum returnable quantity for an item
    public getMaxReturnQuantity(itemId: number): number {
        const details = this.getItemDetails(itemId);
        return Math.max(0, details.orderedQuantity - details.returnedQuantity);
    }

    // Increase item quantity
    public increaseQuantity(itemId: number): void {
        const item = this.purchaseReturn.items.find((i: any) => i.itemId === itemId);
        if (!item) return;

        const currentQty = this.app.localeToAPINumber(item.quantity);
        const maxQty = this.getMaxReturnQuantity(itemId);
        
        if (currentQty < maxQty) {
            item.quantity = this.app.apiNumberToLocale(currentQty + 1);
            this.calculateReturnTotals();
        }
    }

    // Decrease item quantity
    public decreaseQuantity(itemId: number): void {
        const item = this.purchaseReturn.items.find((i: any) => i.itemId === itemId);
        if (!item) return;

        const currentQty = this.app.localeToAPINumber(item.quantity);
        if (currentQty > 0) {
            item.quantity = this.app.apiNumberToLocale(currentQty - 1);
            this.calculateReturnTotals();
        }
    }

    // Handle quantity change
    public onQuantityChange(): void {
        this.calculateReturnTotals();
    }

    // Handle charge amount change
    public onChargeAmountChange(): void {
        this.calculateReturnTotals();
    }

    // Calculate return item total (line net)
    public getReturnItemTotal(item: any): number {
        const qty = this.app.localeToAPINumber(item.quantity);
        const cost = this.app.localeToAPINumber(item.unitCost);
        return qty * cost;
    }

    // --- Enhanced Return calculations with user charges ---

    private round2(n: number): number {
        return Math.round(n * 100) / 100;
    }

    // Calculate comprehensive return totals
    public calculateReturnTotals(): void {
        if (!this.purchaseOrder || !this.purchaseReturn.items) {
            this.resetCalculations();
            return;
        }

        // Calculate subtotal (sum of line nets)
        const subtotal = this.purchaseReturn.items.reduce((total: number, item: any) => {
            return total + this.getReturnItemTotal(item);
        }, 0);

        this.calculations.subtotal = subtotal;

        if (subtotal <= 0) {
            this.resetCalculations();
            return;
        }

        // Calculate proportion of order being returned
        const orderSubTotal = (this.purchaseOrder?.subTotal ?? this.purchaseOrder?.SubTotal) || 0;
        const proportion = orderSubTotal > 0 ? subtotal / orderSubTotal : 0;

        // Calculate allocated discount (proportional)
        const orderDiscount = (this.purchaseOrder?.discountAmount ?? this.purchaseOrder?.DiscountAmount) || 0;
        this.calculations.discount = this.round2(orderDiscount > 0 ? (orderDiscount * proportion) : 0);

        // Calculate allocated tax
        this.calculations.tax = this.calculateReturnTax(subtotal, proportion);

        // Use user-specified charge amount (can be positive for fees or negative for adjustments)
        this.calculations.charges = this.round2(this.app.localeToAPINumber(this.purchaseReturn.returnChargeAmount || '0'));

        // Calculate final total: subtotal - discount + charges + tax
        this.calculations.total = this.round2(
            this.calculations.subtotal - 
            this.calculations.discount + 
            this.calculations.charges + 
            this.calculations.tax
        );

        // Ensure total is not negative
        this.calculations.total = Math.max(0, this.calculations.total);
    }

    // Calculate return tax (consistent with controller logic)
    private calculateReturnTax(returnSubTotal: number, proportion: number): number {
        if (returnSubTotal <= 0) return 0;

        const taxRate = this.purchaseOrder?.taxRate ?? this.purchaseOrder?.TaxRate ?? null;
        const orderTaxAmount = (this.purchaseOrder?.taxAmount ?? this.purchaseOrder?.TaxAmount) || 0;

        let tax = 0;

        if (taxRate) {
            const isPercentage = (taxRate?.isPercentage ?? taxRate?.IsPercentage) ?? false;
            const taxValue = (taxRate?.taxValue ?? taxRate?.TaxValue) ?? 0;

            if (isPercentage) {
                const taxableBase = Math.max(0, returnSubTotal - this.calculations.discount);
                tax = this.round2(taxableBase * (taxValue / 100));
            } else {
                if (orderTaxAmount > 0 && proportion > 0) {
                    tax = this.round2(orderTaxAmount * proportion);
                } else {
                    tax = this.round2(taxValue * proportion);
                }
            }
        } else {
            // No taxRate object, fallback to prorating order.taxAmount
            if (orderTaxAmount > 0) {
                tax = this.round2(orderTaxAmount * proportion);
            }
        }

        return Math.max(0, tax);
    }

    // Reset calculations
    private resetCalculations(): void {
        this.calculations = {
            subtotal: 0,
            discount: 0,
            tax: 0,
            charges: 0,
            total: 0
        };
    }

    // --- Status Helper Methods ---

    // Get localized status text
    public getStatusText(status: OrderStatus): string {
        const statusMap: { [key in OrderStatus]: string } = {
            [OrderStatus.Pending]: 'Pending',
            [OrderStatus.InProgress]: 'In Progress',
            [OrderStatus.Completed]: 'Completed',
            [OrderStatus.Cancelled]: 'Cancelled'
        };
        return this.app.localize(statusMap[status] || 'Unknown');
    }

    // Get localized payment status text
    public getPaymentStatusText(status: PaymentStatus): string {
        const statusMap: { [key in PaymentStatus]: string } = {
            [PaymentStatus.Paid]: 'Paid',
            [PaymentStatus.Unpaid]: 'Unpaid',
            [PaymentStatus.Partial]: 'Partial',
            [PaymentStatus.Refunded]: 'Refunded'
        };
        return this.app.localize(statusMap[status] || 'Unknown');
    }

    // Get payment status CSS class
    public getPaymentStatusClass(status: PaymentStatus): string {
        const classMap: { [key in PaymentStatus]: string } = {
            [PaymentStatus.Paid]: 'badge-success',
            [PaymentStatus.Unpaid]: 'badge-danger',
            [PaymentStatus.Partial]: 'badge-warning',
            [PaymentStatus.Refunded]: 'badge-info'
        };
        return classMap[status] || 'badge-secondary';
    }

    // --- Form Submission Methods ---

    // Handle form submission
    public submitReturn(form: NgForm): void {
        if (!form.valid) {
            this.isValidated = true;
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Please fill in all required fields correctly.')
            );
            return;
        }

        // Check if there are items to return
        const itemsToReturn = this.getItemsToReturn();
        if (itemsToReturn.length === 0) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Please specify quantities for items to return.')
            );
            return;
        }

        // Validate return quantities
        for (const item of itemsToReturn) {
            const maxQty = this.getMaxReturnQuantity(item.itemId);
            const returnQty = this.app.localeToAPINumber(item.quantity);
            
            if (returnQty > maxQty) {
                const itemName = this.getItemDetails(item.itemId).name;
                this.app.showErrorMessage(
                    this.app.localize('Error!'),
                    this.app.localize('Return quantity exceeds available quantity.')
                );
                return;
            }
        }

        this.isSubmitted = true;

        const payload = this.preparePurchaseReturnData();

        this.http.post<any>(`/api/inventory/purchasereturn/${this.purchaseOrder.id}`, payload).subscribe({
            next: (response) => {
                this.app.showSuccessMessage(
                    this.app.localize('Success!'),
                    this.app.localize('Purchase return processed successfully.')
                );
                this.navigateBack();
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.isSubmitted = false;
            }
        });
    }

    // Prepare purchase return data for submission
    private preparePurchaseReturnData(): any {
        const itemsToReturn = this.getItemsToReturn().map(item => ({
            itemId: item.itemId,
            quantity: this.app.localeToAPINumber(item.quantity),
            unitCost: this.app.localeToAPINumber(item.unitCost)
        }));

        return {
            reason: this.purchaseReturn.reason,
            notes: this.purchaseReturn.notes || undefined,
            returnReference: this.purchaseReturn.returnReference || undefined,
            returnChargeAmount: this.app.localeToAPINumber(this.purchaseReturn.returnChargeAmount || '0'),
            items: itemsToReturn
        };
    }

    // --- Navigation Methods ---

    // Navigate back to purchase list
    public navigateBack(): void {
        this.app.navigate('/inventory/purchases/list');
    }

    // Get page title
    public getPageTitle(): string {
        return this.app.localize('Purchase Return');
    }

    // Check if charges should be displayed
    public shouldShowCharges(): boolean {
        return this.calculations.charges !== 0;
    }

    // Check if discount should be displayed
    public shouldShowDiscount(): boolean {
        return this.calculations.discount > 0;
    }

    // Check if tax should be displayed
    public shouldShowTax(): boolean {
        return this.calculations.tax > 0;
    }
}