import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

export enum PaymentStatus {
    Paid = 1,
    Unpaid = 2,
    Partial = 3
}

@Component({
    selector: 'app-refundaddedit',
    templateUrl: './refundaddedit.component.html',
	standalone: true,
    imports: [AppImports]
})
export class RefundAddEditComponent implements OnInit {

    // Component state flags
    public isLoading = true;
    public isSubmitted = false;
    public isValidated = false;

    // Order and refund data
    public order: any = null;
    public posSettings: any = null;
    public refund: any = {
        reason: '',
        notes: '',
        refundChargeAmount: '0',
        returnItems: [] as Array<{ orderItemId: number, returnQuantity: string }>
    };

    public paymentStatusOptions = [
        { value: PaymentStatus.Paid, label: 'Paid', class: 'badge-primary' },
        { value: PaymentStatus.Unpaid, label: 'Unpaid', class: 'badge-danger' },
        { value: PaymentStatus.Partial, label: 'Partial', class: 'badge-warning' }
    ];

    // Enhanced calculations with tax breakdown and manual refund charge
    public calculations = {
        subtotal: 0,
        discount: 0,
        couponDiscount: 0,
        totalDiscount: 0,
        taxableAmount: 0,
        taxAmount: 0,
        refundChargeAmount: 0,
        total: 0
    };

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute,
        private router: Router,
        public app: AppService
    ) {
        this.resetForm();
    }

    // Lifecycle hooks
    ngOnInit(): void {
        const orderId = Number(this.route.snapshot.paramMap.get('id'));
        if (!orderId || orderId <= 0) {
            this.app.showErrorMessage(this.app.localize('Invalid Request'), this.app.localize('Invalid order ID provided.'));
            this.navigateBack();
            return;
        }
        this.loadOrderAndSettings(orderId);
    }

    // --- Initialization Methods ---

    // Reset refund form
    private resetForm(): void {
        this.refund = {
            reason: '',
            notes: '',
            refundChargeAmount: this.app.apiNumberToLocale(0),
            returnItems: []
        };
        this.isSubmitted = false;
        this.isValidated = false;
        this.calculations = {
            subtotal: 0,
            discount: 0,
            couponDiscount: 0,
            totalDiscount: 0,
            taxableAmount: 0,
            taxAmount: 0,
            refundChargeAmount: 0,
            total: 0
        };
    }

    // Load order data and POS settings
    private loadOrderAndSettings(orderId: number): void {
        const locationId = this.app.getSelectedLocationId() || 0;

        // Load both order data and POS settings
        Promise.all([
            this.http.get<any>(`/api/sales/getorder/${orderId}`, {
                params: { locationId: locationId.toString() }
            }).toPromise(),
            this.http.get<any>('/api/sales/getpossetting').toPromise()
        ]).then(([orderResponse, settingsResponse]) => {
            this.order = orderResponse.order;
            this.posSettings = settingsResponse.pos;

            // Initialize refund items based on order items (default 0)
            this.refund.returnItems = (this.order?.orderItems || []).map((item: any) => ({
                orderItemId: item.id,
                returnQuantity: this.app.apiNumberToLocale(0)
            }));

            this.calculateRefundTotals();
            this.isLoading = false;
        }).catch((error) => {
            this.app.handleApiError(error);
            this.navigateBack();
        });
    }

    // --- Items Management ---

    // Get order item details
    public getOrderItemDetails(orderItemId: number): any {
        const orderItem = this.order?.orderItems?.find((item: any) => item.id === orderItemId);
        if (!orderItem) return null;

        return {
            id: orderItem.id,
            itemName: orderItem.item?.itemName || 'Unknown Item',
            quantity: orderItem.quantity || 0,
            unitPrice: orderItem.unitPrice || 0,
            totalAmount: orderItem.totalAmount || 0,
            modifiers: orderItem.orderItemModifiers || [],
            discountAmount: orderItem.discountAmount || 0,
            taxAmount: orderItem.taxAmount || 0,
            returnedQty: orderItem.returnedQty || 0,
            refundedAmount: orderItem.refundedAmount || 0
        };
    }

    // Calculate refund item total (proportional to original order item)
    public getRefundItemTotal(orderItemId: number): number {
        const orderItem = this.getOrderItemDetails(orderItemId);
        const refundItem = this.refund.returnItems.find((item: any) => item.orderItemId === orderItemId);

        if (!orderItem || !refundItem) return 0;

        const returnQty = this.app.localeToAPINumber(refundItem.returnQuantity);
        const availableQty = (orderItem.quantity || 0) - (orderItem.returnedQty || 0);

        if (returnQty <= 0 || returnQty > availableQty || orderItem.quantity <= 0) return 0;

        // Proportional refund based on quantity
        const refundRatio = returnQty / orderItem.quantity;
        return orderItem.totalAmount * refundRatio;
    }

    // Calculate refund item discount (proportional)
    public getRefundItemDiscount(orderItemId: number): number {
        const orderItem = this.getOrderItemDetails(orderItemId);
        const refundItem = this.refund.returnItems.find((item: any) => item.orderItemId === orderItemId);

        if (!orderItem || !refundItem) return 0;

        const returnQty = this.app.localeToAPINumber(refundItem.returnQuantity);
        if (returnQty <= 0 || orderItem.quantity <= 0) return 0;

        const refundRatio = returnQty / orderItem.quantity;
        return orderItem.discountAmount * refundRatio;
    }

    // Calculate refund item tax (proportional)
    public getRefundItemTax(orderItemId: number): number {
        const orderItem = this.getOrderItemDetails(orderItemId);
        const refundItem = this.refund.returnItems.find((item: any) => item.orderItemId === orderItemId);

        if (!orderItem || !refundItem) return 0;

        const returnQty = this.app.localeToAPINumber(refundItem.returnQuantity);
        if (returnQty <= 0 || orderItem.quantity <= 0) return 0;

        const refundRatio = returnQty / orderItem.quantity;
        return orderItem.taxAmount * refundRatio;
    }

    // Calculate comprehensive refund totals with tax breakdown and manual refund charge
    public calculateRefundTotals(): void {
        if (!this.order || !this.refund.returnItems || !this.posSettings) {
            this.resetCalculations();
            return;
        }

        let subtotal = 0;
        let itemLevelDiscount = 0;
        let itemLevelTax = 0;

        // Calculate item-level totals
        this.refund.returnItems.forEach((refundItem: any) => {
            subtotal += this.getRefundItemTotal(refundItem.orderItemId);
            itemLevelDiscount += this.getRefundItemDiscount(refundItem.orderItemId);
            if (this.posSettings.isTaxOrderLevel === false) {
                itemLevelTax += this.getRefundItemTax(refundItem.orderItemId);
            }
        });

        this.calculations.subtotal = subtotal;

        // Calculate coupon discount proportionally
        const originalSubtotal = this.order.subTotal || 0;
        let couponDiscount = 0;
        if (originalSubtotal > 0 && (this.order.couponDiscount || 0) > 0) {
            const refundRatio = subtotal / originalSubtotal;
            couponDiscount = (this.order.couponDiscount || 0) * refundRatio;
        }

        // Calculate order-level discount proportionally
        let orderLevelDiscount = 0;
        if (this.posSettings.isDiscountOrderLevel && originalSubtotal > 0 && (this.order.discountAmount || 0) > 0) {
            const refundRatio = subtotal / originalSubtotal;
            orderLevelDiscount = (this.order.discountAmount || 0) * refundRatio;
        } else {
            orderLevelDiscount = itemLevelDiscount;
        }

        this.calculations.discount = orderLevelDiscount;
        this.calculations.couponDiscount = couponDiscount;
        this.calculations.totalDiscount = orderLevelDiscount + couponDiscount;

        // Calculate taxable amount
        let taxableAmount = subtotal - this.calculations.totalDiscount;
        if (this.posSettings.isTaxBeforeDiscount) {
            taxableAmount = subtotal;
        }

        this.calculations.taxableAmount = Math.max(0, taxableAmount);

        // Calculate tax
        let taxAmount = 0;
        if (this.posSettings.isTaxOrderLevel) {
            // Order-level tax calculation
            if (this.order.taxRate && this.calculations.taxableAmount > 0) {
                if (this.order.taxRate.isPercentage) {
                    taxAmount = this.calculations.taxableAmount * (this.order.taxRate.taxValue / 100);
                } else {
                    // For fixed tax, calculate proportionally
                    const originalTaxableAmount = this.calculateOriginalTaxableAmount();
                    if (originalTaxableAmount > 0) {
                        const refundRatio = this.calculations.taxableAmount / originalTaxableAmount;
                        taxAmount = (this.order.taxAmount || 0) * refundRatio;
                    }
                }

                if (this.posSettings.isTaxInclusive) {
                    // For inclusive tax, calculate backwards
                    const divisor = this.order.taxRate.isPercentage ? (100 + this.order.taxRate.taxValue) / 100 : 1;
                    taxAmount = this.calculations.taxableAmount - (this.calculations.taxableAmount / divisor);
                }
            }
        } else {
            // Item-level tax (already calculated above)
            taxAmount = itemLevelTax;
        }

        this.calculations.taxAmount = Math.max(0, taxAmount);

        // Use manual refund charge amount (NOT proportional to original charge)
        const refundChargeAmount = this.app.localeToAPINumber(this.refund.refundChargeAmount || '0');
        this.calculations.refundChargeAmount = Math.max(0, refundChargeAmount);

        // Calculate final total
        if (this.posSettings.isTaxInclusive) {
            this.calculations.total = this.calculations.subtotal - this.calculations.totalDiscount + this.calculations.refundChargeAmount;
        } else {
            this.calculations.total = this.calculations.subtotal - this.calculations.totalDiscount + this.calculations.taxAmount + this.calculations.refundChargeAmount;
        }

        this.calculations.total = Math.max(0, this.calculations.total);
    }

    // Calculate original taxable amount for proportional calculations
    private calculateOriginalTaxableAmount(): number {
        let originalTaxableAmount = this.order.subTotal || 0;
        
        if (!this.posSettings.isTaxBeforeDiscount) {
            originalTaxableAmount -= (this.order.discountTotal || 0);
        }
        
        return Math.max(0, originalTaxableAmount);
    }

    // Reset calculations
    private resetCalculations(): void {
        this.calculations = {
            subtotal: 0,
            discount: 0,
            couponDiscount: 0,
            totalDiscount: 0,
            taxableAmount: 0,
            taxAmount: 0,
            refundChargeAmount: 0,
            total: 0
        };
    }

    // Get items with return quantity > 0
    public getItemsToRefund(): any[] {
        return this.refund.returnItems.filter((item: any) => this.app.localeToAPINumber(item.returnQuantity) > 0);
    }

    // Increase return quantity
    public increaseQuantity(orderItemId: number): void {
        const refundItem = this.refund.returnItems.find((item: any) => item.orderItemId === orderItemId);
        const orderItem = this.getOrderItemDetails(orderItemId);

        if (refundItem && orderItem) {
            const currentQty = this.app.localeToAPINumber(refundItem.returnQuantity);
            const maxQty = (orderItem.quantity || 0) - (orderItem.returnedQty || 0);

            if (currentQty < maxQty) {
                refundItem.returnQuantity = this.app.apiNumberToLocale(currentQty + 1);
                this.calculateRefundTotals();
            }
        }
    }

    // Decrease return quantity
    public decreaseQuantity(orderItemId: number): void {
        const refundItem = this.refund.returnItems.find((item: any) => item.orderItemId === orderItemId);

        if (refundItem) {
            const currentQty = this.app.localeToAPINumber(refundItem.returnQuantity);

            if (currentQty > 0) {
                refundItem.returnQuantity = this.app.apiNumberToLocale(currentQty - 1);
                this.calculateRefundTotals();
            }
        }
    }

    // Update quantity and recalculate
    public onQuantityChange(): void {
        this.calculateRefundTotals();
    }

    // Update refund charge and recalculate
    public onRefundChargeChange(): void {
        this.calculateRefundTotals();
    }

    // --- Form Submission Methods ---

    // Handle form submission
    public submitRefund(form: NgForm): void {
        if (!form.valid) {
            this.isValidated = true;
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Please fill in all required fields correctly.')
            );
            return;
        }

        // Additional validation
        if (!this.validateRefund()) {
            this.isValidated = true;
            return;
        }

        this.isSubmitted = true;

        const payload = {
            locationId: this.app.getSelectedLocationId(),
            orderId: this.order.id,
            reason: this.refund.reason,
            refundChargeAmount: this.app.localeToAPINumber(this.refund.refundChargeAmount || '0'),
            returnItems: this.getItemsToRefund().map(item => ({
                orderItemId: item.orderItemId,
                returnQuantity: this.app.localeToAPINumber(item.returnQuantity)
            }))
        };

        this.http.post<any>('/api/sales/processrefund', payload).subscribe({
            next: (response) => {
                this.app.showSuccessMessage(
                    this.app.localize('Success!'),
                    this.app.localize('Refund processed successfully.')
                );
                this.navigateBack();
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.isSubmitted = false;
            }
        });
    }

    // Validate refund data
    private validateRefund(): boolean {
        if (!this.refund.reason?.trim()) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Refund reason is required.')
            );
            return false;
        }

        // Validate refund charge amount
        const refundChargeAmount = this.app.localeToAPINumber(this.refund.refundChargeAmount || '0');
        if (refundChargeAmount < 0) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Refund charge amount cannot be negative.')
            );
            return false;
        }

        const itemsToRefund = this.getItemsToRefund();
        if (itemsToRefund.length === 0) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('At least one item must have a return quantity greater than zero.')
            );
            return false;
        }

        for (const refundItem of this.refund.returnItems) {
            const returnQty = this.app.localeToAPINumber(refundItem.returnQuantity);

            if (returnQty > 0) {
                const orderItem = this.getOrderItemDetails(refundItem.orderItemId);

                if (!orderItem) {
                    this.app.showErrorMessage(
                        this.app.localize('Error!'),
                        this.app.localize('Invalid item found in refund request.')
                    );
                    return false;
                }

                const availableQty = (orderItem.quantity || 0) - (orderItem.returnedQty || 0);

                if (returnQty > availableQty) {
                    this.app.showErrorMessage(
                        this.app.localize('Error!'),
                        `${orderItem.itemName}: ${this.app.localize('Return quantity cannot exceed available quantity')}.`
                    );
                    return false;
                }
            }
        }

        return true;
    }

    // --- Utility Methods ---

    // Navigate back to orders list
    public navigateBack(): void {
        this.router.navigate(['/sales/orders/list']);
    }

    // Check if refund can be processed
    public canRefund(): boolean {
        return !!this.order
            && this.order.status === 4 // OrderStatus.Completed
            && this.order.paymentStatus === PaymentStatus.Paid
            && this.hasRefundableItems()
            && !this.isLoading;
    }

    private hasRefundableItems(): boolean {
        return (this.order?.orderItems || []).some((oi: any) => {
            const qty = oi.quantity || 0;
            const returned = oi.returnedQty || 0;
            return qty - returned > 0;
        });
    }

    // Get page title
    public getPageTitle(): string {
        return this.app.localize('Process Refund');
    }

    public renderPaymentStatusBadge(paymentStatus: any): string {
        const opt = this.paymentStatusOptions.find(s => s.value === paymentStatus);
        const badgeClass = opt?.class || 'badge-light';
        const title = opt?.label || this.app.localize('Unknown');
        return `<span class="badge ${badgeClass}">${title}</span>`;
    }

    // Get tax information display
    public getTaxInfo(): string {
        if (!this.order?.taxRate) return '';
        
        const taxName = this.order.taxRate.taxName || 'Tax';
        const taxValue = this.order.taxRate.taxValue || 0;
        const isPercentage = this.order.taxRate.isPercentage;
        
        return isPercentage ? `${taxName} (${taxValue}%)` : `${taxName} (${this.app.formatCurrency(taxValue)})`;
    }

    // Get original order charge information display
    public getOriginalChargeInfo(): string {
        if (!this.order?.charge) return '';
        
        const chargeName = this.order.charge.chargeName || 'Service Charge';
        const chargeValue = this.order.charge.chargeValue || 0;
        const isPercentage = this.order.charge.isPercentage;
        
        return isPercentage ? `${chargeName} (${chargeValue}%)` : `${chargeName} (${this.app.formatCurrency(chargeValue)})`;
    }

    // Check if tax should be displayed
    public shouldShowTax(): boolean {
        return this.calculations.taxAmount > 0;
    }

    // Check if discount should be displayed
    public shouldShowDiscount(): boolean {
        return this.calculations.totalDiscount > 0;
    }

    // Check if refund charge should be displayed
    public shouldShowRefundCharge(): boolean {
        return this.calculations.refundChargeAmount > 0;
    }

    // Check if original order had charges
    public hasOriginalCharges(): boolean {
        return (this.order?.chargeAmount || 0) > 0;
    }
}