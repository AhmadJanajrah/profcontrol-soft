import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AppImports } from '../../app.imports';

// Enums matching backend 
export enum OrderStatus {
	Pending = 1,
	InProgress = 2,
	Ready = 3,
	Completed = 4,
	Cancelled = 5
}

export enum PaymentStatus {
	Paid = 1,
	Unpaid = 2,
	Partial = 3
}

export enum OrderType {
	DineIn = 1,
	Takeaway = 2,
	Handover = 3,
	Online = 4,
	Courier = 5
}

@Component({
	selector: 'app-orderlist',
	templateUrl: './orderlist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class OrderListComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;
	@ViewChild('invoiceIframe') iframe!: ElementRef<HTMLIFrameElement>;

	// DataTable configuration and trigger 
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Filters
	public filters = {
		status: null as OrderStatus | null,
		orderType: null as OrderType | null,
		paymentStatus: null as PaymentStatus | null,
		dateFrom: null as string | null,
		dateTo: null as string | null,
		validated: false,
		submitted: false
	};

	// Dropdown data for filters
	public statusOptions: any[] = [];
	public orderTypeOptions: any[] = [];
	public paymentStatusOptions: any[] = [];

	// Print Modal
	public printModal = {
		show: false,
		loading: false
	};

	public invoice: SafeHtml | '' = '';
	public orderId = 0;
	public isReturned = false;

	public permissions = {
		canView: false,
		canRefund: false,
		canReceiveDue: false,
		canCancel: false,
		canDelete: false
	};

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService,
		private sanitizer: DomSanitizer
	) {
		this.permissions = {
			canView: this.app.hasPermission('sales.vieworder'),
			canRefund: this.app.hasPermission('sales.refund'),
			canReceiveDue: this.app.hasPermission('sales.receivedue'),
			canCancel: this.app.hasPermission('sales.cancelorder'),
			canDelete: this.app.hasPermission('sales.deleteorder')
		}
		this.initializeStatusOptions();
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.initDataTable();
	}

	ngAfterViewInit(): void {
		this.dtTrigger.next(null);
		this.addTableEventListeners();
		window.addEventListener('popstate', this.onPopState);
	}

	ngOnDestroy(): void {
		this.dtTrigger.unsubscribe();
		window.removeEventListener('popstate', this.onPopState);
	}

	// --- Initialization Methods ---

	// Initialize status options
	private initializeStatusOptions(): void {
		this.statusOptions = [
			{ value: OrderStatus.Pending, label: 'Pending', class: 'badge-light' },
			{ value: OrderStatus.Ready, label: 'Ready', class: 'badge-info' },
			{ value: OrderStatus.InProgress, label: 'In Progress', class: 'badge-warning' },
			{ value: OrderStatus.Completed, label: 'Completed', class: 'badge-primary' },
			{ value: OrderStatus.Cancelled, label: 'Cancelled', class: 'badge-danger' }
		];

		this.orderTypeOptions = [
			{ value: OrderType.DineIn, label: this.app.localize('Dine In'), class: 'badge-primary' },
			{ value: OrderType.Takeaway, label: this.app.localize('Takeaway'), class: 'badge-info' },
			{ value: OrderType.Handover, label: this.app.localize('Handover'), class: 'badge-warning' },
			{ value: OrderType.Courier, label: this.app.localize('Courier'), class: 'badge-success' },
			{ value: OrderType.Online, label: this.app.localize('Online'), class: 'badge-dark' }
		];

		this.paymentStatusOptions = [
			{ value: PaymentStatus.Paid, label: this.app.localize('Paid'), class: 'badge-primary' },
			{ value: PaymentStatus.Unpaid, label: this.app.localize('Unpaid'), class: 'badge-danger' },
			{ value: PaymentStatus.Partial, label: this.app.localize('Partial'), class: 'badge-warning' }
		];
	}

	// --- DataTable Methods ---

	// Initialize DataTable with server-side config
	private initDataTable(): void {
		const direction = document.documentElement.dir || document.body.dir || 'ltr';
		this.dtOptions = {
			autoWidth: true,
			processing: true,
			serverSide: true,
			search: { return: true },
			lengthMenu: [[10, 25, 50, 100, 250], [10, 25, 50, 100, 250]],
			pageLength: 10,
			order: [[0, 'desc']],
			language: {
				processing: '',
				loadingRecords: '',
				lengthMenu: `${this.app.localize('Show')} _MENU_ ${this.app.localize('Entries')}`,
				emptyTable: `${this.app.localize('No records found')}`,
				zeroRecords: `${this.app.localize('No matching records found')}`,
				info: `<small>${this.app.localize('Showing')} _START_ - _END_ (_TOTAL_)</small>`,
				infoEmpty: '',
				infoFiltered: '',
				search: '',
				searchPlaceholder: `${this.app.localize('Search...')}`,
				paginate: {
					previous: direction === 'rtl' ? '<i class="ri-arrow-right-s-line"></i>' : '<i class="ri-arrow-left-s-line"></i>',
					next: direction === 'rtl' ? '<i class="ri-arrow-left-s-line"></i>' : '<i class="ri-arrow-right-s-line"></i>',
					first: '',
					last: ''
				}
			},
			columns: [
				{ title: this.app.localize('#'), data: 'id', orderSequence: ['asc', 'desc'], width: '60px' },
				{ title: this.app.localize('Order Date'), data: 'orderDate', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Customer'), data: 'customer.fullName', orderSequence: ['asc', 'desc'] },
				{
					title: this.app.localize('Order Type'),
					data: 'orderType',
					orderSequence: ['asc', 'desc'],
					render: (data: OrderType) => this.renderOrderTypeBadge(data)
				},
				{ title: this.app.localize('Total Amount'), data: 'totalAmount', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Due Amount'), data: 'remainingAmount', orderable: false },
				{ title: this.app.localize('Refunded Amount'), data: 'refundedAmount', orderable: false },
				{
					title: this.app.localize('Status'),
					data: 'status',
					orderable: false,
					render: (data: OrderStatus) => this.renderStatusBadge(data)
				},
				{
					title: this.app.localize('Payment Status'),
					data: 'paymentStatus',
					orderable: false,
					render: (data: PaymentStatus) => this.renderPaymentStatusBadge(data)
				},
				{
					title: this.app.localize('Actions'),
					data: null,
					orderable: false,
					width: '50px',
					render: (data: any, type: any, row: any) => this.renderActionColumn(row)
				}
			],
			columnDefs: [
				{ targets: '_all', type: 'string' },
				{ targets: [-1], className: 'dt-center' }
			],
			layout: { bottomEnd: { paging: { firstLast: false } } },
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/sales/getorders', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							orderDate: this.app.formatDate(item.orderDate),
							totalAmount: this.app.formatCurrency(item.totalAmount || 0),
							remainingAmount: this.app.formatCurrency(item.remainingAmount || 0),
							refundedAmount: this.app.formatCurrency(item.refundedAmount || 0),
							isReturned: (item.refundedAmount || 0) > 0
						}));
						this.filters.submitted = false;
						this.filters.validated = false;
						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: formattedData
						});
					},
					error: error => {
						this.app.handleApiError(error);
						this.filters.submitted = false;
						this.filters.validated = false;
						callback({ recordsTotal: 0, recordsFiltered: 0, data: [] });
					}
				});
			}
		};
	}

	// Reload DataTable data
	private reloadDataTable(isResetPage = false): void {
        if (this.dtElement?.dtInstance) {
            this.dtElement.dtInstance.then(dt => {
                if (isResetPage) {
                    dt.page(0).draw(false);
                } else {
                    dt.ajax.reload(undefined, false);
                }
            });
        }
    }

	// Build query params for DataTable server-side
	private buildDataTableQuery(params: any): any {
		return {
			locationId: this.app.getSelectedLocationId() || 0,
			start: params.start,
			length: params.length,
			searchValue: params.search.value,
			sortColumn: params.order[0]?.column ?? 0,
			sortDirection: params.order[0]?.dir ?? 'desc',
			status: this.filters.status || '',
			orderType: this.filters.orderType || '',
			paymentStatus: this.filters.paymentStatus || '',
			dateFrom: this.filters.dateFrom || '',
			dateTo: this.filters.dateTo || ''
		};
	}

	// Render order status badge
	private renderStatusBadge(status: OrderStatus): string {
		const badgeClass = this.statusOptions.find(s => s.value === status)?.class || 'badge-light';
		const title = this.statusOptions.find(s => s.value === status)?.label || this.app.localize('Unknown');
		return `<span class="badge ${badgeClass}">${title}</span>`;
	}

	// Render payment status badge
	private renderPaymentStatusBadge(paymentStatus: PaymentStatus): string {
		const badgeClass = this.paymentStatusOptions.find(s => s.value === paymentStatus)?.class || 'badge-light';
		const title = this.paymentStatusOptions.find(s => s.value === paymentStatus)?.label || this.app.localize('Unknown');
		return `<span class="badge ${badgeClass}">${title}</span>`;
	}

	// Render order type badge
	private renderOrderTypeBadge(orderType: OrderType): string {
		const badgeClass = this.orderTypeOptions.find(s => s.value === orderType)?.class || 'badge-light';
		const title = this.orderTypeOptions.find(s => s.value === orderType)?.label || this.app.localize('Unknown');
		return `<span class="badge ${badgeClass}">${title}</span>`;
	}

	// Render action dropdown for each row
	private renderActionColumn(row: any): string {
		let actions = `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">`;

		if(this.permissions.canView) {
			actions += `
			<a class="dropdown-item view-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-receipt-line"></i>${this.app.localize('View')}
			</a>`;
		}

		if (this.permissions.canRefund && row.isReturned) {
			actions += `
			<a class="dropdown-item view-refund-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-bill-line"></i>${this.app.localize('View Refund')}
			</a>`;
		}
		if (row.status === OrderStatus.Completed && this.permissions.canRefund && row.refundTotal <= 0) {
			actions += `
			<a class="dropdown-item refund-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-refund-2-line"></i>${this.app.localize('Process Refund')}
			</a>`;
		}

		if (row.paymentStatus === PaymentStatus.Partial && this.permissions.canReceiveDue) {
			actions += `
			<a class="dropdown-item receive-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-money-dollar-circle-line"></i>${this.app.localize('Receive Due')}
			</a>`;
		}

		if (row.status == OrderStatus.Completed && this.permissions.canCancel) {
			actions += `
			<a class="dropdown-item cancel-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-close-circle-line"></i>${this.app.localize('Cancel')}
			</a>`;
		}

		if (this.permissions.canDelete) {
			actions += `
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>`;
		}

		actions += '</div>';
		return actions;
	}

	// Attach event listeners for table actions
	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (tableBody) {
			this.renderer.listen(tableBody, 'click', (event: Event) => {
				const target = event.target as Element;
				const viewButton = target.closest('.view-button');
				const viewRefundButton = target.closest('.view-refund-button');
				const refundButton = target.closest('.refund-button');
				const receiveButton = target.closest('.receive-button');
				const cancelButton = target.closest('.cancel-button');
				const deleteButton = target.closest('.delete-button');

				if (viewButton) {
					const id = parseInt(viewButton.getAttribute('data-id') || '0');
					this.showPrintModal(id);
				}

				if (viewRefundButton) {
					const id = parseInt(viewRefundButton.getAttribute('data-id') || '0');
					this.showPrintModal(id, true);
				}

				if (refundButton) {
					const id = parseInt(refundButton.getAttribute('data-id') || '0');
					this.refundOrder(id);
				}

				if (receiveButton) {
					const id = parseInt(receiveButton.getAttribute('data-id') || '0');
					this.confirmReceiveDue(id);
				}

				if (cancelButton) {
					const id = parseInt(cancelButton.getAttribute('data-id') || '0');
					this.confirmCancel(id);
				}

				if (deleteButton) {
					const id = parseInt(deleteButton.getAttribute('data-id') || '0');
					this.confirmDelete(id);
				}
			});
		}
	}

	// --- Filter Methods ---

	// Apply filters
	public applyFilters(filterForm: NgForm): void {
		if (filterForm.valid) {
			this.filters.submitted = true;
			this.reloadDataTable(true);
		} else {
			this.filters.validated = true;
		}
	}

	// Reset filters
	public resetFilters(): void {
		this.filters.status = null;
		this.filters.orderType = null;
		this.filters.paymentStatus = null;
		this.filters.dateFrom = null;
		this.filters.dateTo = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	// --- Print Modal ---

	// Reset print modal state
	private resetPrintModal(): void {
		this.printModal.show = false;
		this.printModal.loading = false;
		this.invoice = '';
		this.orderId = 0;
		this.isReturned = false;
	}

	// Show print modal
	public showPrintModal(orderId: number, isReturnInvoice: boolean = false): void {
		this.printModal.show = true;
		this.printModal.loading = true;
		this.orderId = orderId;

		// Load order invoice HTML
		this.http
			.get(`/api/sales/viewinvoice/${orderId}`, {
				params: { locationId: (this.app.getSelectedLocationId() || 0).toString(), isReturnInvoice: isReturnInvoice.toString() },
				responseType: 'text'
			})
			.subscribe({
				next: html => {
					this.invoice = this.sanitizer.bypassSecurityTrustHtml(html);
					this.printModal.loading = false;
					this.isReturned = isReturnInvoice;
				},
				error: error => {
					this.app.handleApiError(error);
					this.closePrintModal();
				}
			});

		history.pushState(null, '', window.location.pathname);
	}

	// Close print modal
	public closePrintModal(): void {
		this.resetPrintModal();
		history.back();
	}

	// Print invoice
	public printInvoice(): void {
		const iframeElement = this.iframe?.nativeElement;
		const contentWindow = iframeElement?.contentWindow;
		if (contentWindow?.document?.readyState === 'complete') {
			contentWindow.print();
		} else {
			// Try after a small delay if not yet ready
			setTimeout(() => contentWindow?.print?.(), 250);
		}
	}

	// Download invoice (PDF)
	public downloadInvoice(orderId: number): void {
		this.http.get(`/api/sales/downloadinvoice/${orderId}`, {
			params: { locationId: (this.app.getSelectedLocationId() || 0).toString(), isReturnInvoice: this.isReturned.toString() },
			responseType: 'blob'
		}).subscribe({
			next: (data: Blob) => {
				const blob = new Blob([data], { type: data.type || 'application/octet-stream' });
				const downloadLink = window.document.createElement('a');
				const url = window.URL.createObjectURL(blob);
				downloadLink.href = url;
				downloadLink.download = `invoice_${orderId}.pdf`;
				window.document.body.appendChild(downloadLink);
				downloadLink.click();
				window.document.body.removeChild(downloadLink);
				window.URL.revokeObjectURL(url);
			},
			error: (error) => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Action Methods ---

	// Navigate to refund order
	private refundOrder(id: number): void {
		this.app.navigate(`/sales/orders/refund/${id}`);
	}

	// Receive due payment
	private confirmReceiveDue(id: number): void {
		const message = `${this.app.localize('Are you sure you want to receive due payment for order')} <strong>"#${id}"</strong>?`;
		this.app.confirmDialog(
			this.app.localize('Confirm Receive Due'),
			message,
			() => this.receiveDue(id),
			null,
			`<i class="ri-money-dollar-circle-line"></i>` + this.app.localize('Receive Due'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'success'
		);
	}

	// Receive due payment by id
	private receiveDue(id: number): void {
		const dialogId = this.app.showLoadingDialog('Receiving...');
		this.http.post<any>(`/api/sales/receivedue/${id}`, null)
			.subscribe({
				next: () => {
					this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Due payment received successfully.'));
					this.reloadDataTable();
					this.app.closeLoadingDialog(dialogId);
				},
				error: (error) => {
					this.app.handleApiError(error);
					this.app.closeLoadingDialog(dialogId);
				}
			});
	}

	// Show confirmation dialog before cancelling order
	private confirmCancel(id: number): void {
		const message = `${this.app.localize('Are you sure you want to cancel order')} <strong>"#${id}"</strong>?<br>
		${this.app.localize('Once cancelled you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Cancel'),
			message,
			() => this.cancelOrder(id),
			null,
			`<i class="ri-close-circle-line"></i>` + this.app.localize('Cancel Order'),
			`<i class="ri-close-line"></i>` + this.app.localize('Keep'),
			'danger'
		);
	}

	// Cancel order by id
	private cancelOrder(id: number): void {
		const dialogId = this.app.showLoadingDialog('Cancelling...');
		this.http.post<any>(`/api/sales/cancelorder/${id}`, null)
			.subscribe({
				next: () => {
					this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Order cancelled successfully.'));
					this.reloadDataTable();
					this.app.closeLoadingDialog(dialogId);
				},
				error: (error) => {
					this.app.handleApiError(error);
					this.app.closeLoadingDialog(dialogId);
				}
			});
	}

	// Show confirmation dialog before deleting order
	private confirmDelete(id: number): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"#${id}"</strong>?<br>
		${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deleteOrder(id),
			null,
			`<i class="ri-delete-bin-6-line"></i>` + this.app.localize('Delete Order'),
			`<i class="ri-close-line"></i>` + this.app.localize('Keep'),
			'danger'
		);
	}

	// Delete order by id
	private deleteOrder(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/sales/deleteorder/${id}`)
			.subscribe({
				next: () => {
					this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Order deleted successfully.'));
					this.reloadDataTable();
					this.app.closeLoadingDialog(dialogId);
				},
				error: (error) => {
					this.app.handleApiError(error);
					this.app.closeLoadingDialog(dialogId);
				}
			});
	}

	// --- Window Event Handlers ---

    // Reset modal state on browser back navigation
    private onPopState = (): void => {
        if (this.printModal.show) this.resetPrintModal();
    };
}