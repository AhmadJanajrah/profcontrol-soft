import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../../services/app.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
	Partial = 3
}

@Component({
	selector: 'app-purchaselist',
	templateUrl: './purchaselist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class PurchaseListComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;
	@ViewChild('invoiceIframe') iframe!: ElementRef<HTMLIFrameElement>;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Filters
	public filters = {
		status: null as OrderStatus | null,
		paymentStatus: null as PaymentStatus | null,
		dateFrom: null as string | null,
		dateTo: null as string | null,
		validated: false,
		submitted: false
	};

	// Dropdown data for filters
	public suppliers: any[] = [];
	public statusOptions: any[] = [
		{ value: OrderStatus.Pending, label: 'Pending', class: 'badge badge-warning' },
		{ value: OrderStatus.InProgress, label: 'In Progress', class: 'badge badge-success' },
		{ value: OrderStatus.Completed, label: 'Completed', class: 'badge badge-primary' },
		{ value: OrderStatus.Cancelled, label: 'Cancelled', class: 'badge badge-danger' }
	];
	public paymentStatusOptions: any[] = [
		{ value: PaymentStatus.Paid, label: 'Paid', class: 'badge badge-primary' },
		{ value: PaymentStatus.Unpaid, label: 'Unpaid', class: 'badge badge-danger' },
		{ value: PaymentStatus.Partial, label: 'Partial', class: 'badge badge-warning' }
	];

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
		canAdd: false,
		canEdit: false,
		canDelete: false,
		canPayDue: false,
		canCancel: false,
		canReturn: false
	};

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService,
		private sanitizer: DomSanitizer
	) {
		this.permissions = {
			canView: this.app.hasPermission('inventory.viewpurchase'),
			canAdd: this.app.hasPermission('inventory.addpurchase'),
			canEdit: this.app.hasPermission('inventory.editpurchase'),
			canDelete: this.app.hasPermission('inventory.deletepurchase'),
			canPayDue: this.app.hasPermission('inventory.paypurchasedue'),
			canCancel: this.app.hasPermission('inventory.cancelpurchase'),
			canReturn: this.app.hasPermission('inventory.purchasereturn')
		};
		
		this.statusOptions.forEach(option => {
			option.label = this.app.localize(option.label);
		});
		this.paymentStatusOptions.forEach(option => {
			option.label = this.app.localize(option.label);
		});
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.initDataTable();
		this.loadFilterData();
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

	// Load filter dropdown data
	private loadFilterData(): void {
		this.http.get<any>(`/api/inventory/getpurchaseformdata?locationId=${this.app.getSelectedLocationId()}`).subscribe({
			next: response => {
				this.suppliers = response.suppliers || [];
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
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
				{ title: this.app.localize('Reference'), data: 'reference', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Order Date'), data: 'orderDate', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Supplier'), data: 'supplier.supplierName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Total Amount'), data: 'totalAmount', orderSequence: ['asc', 'desc'] },
				{ 
					title: this.app.localize('Due Amount'), data: 'remainingAmount', orderSequence: ['asc', 'desc'],
					render: (data: any, type: any, row: any) => row.isDue ? `<span class="text-danger">${data}</span>` : data
				},
				{ 
					title: this.app.localize('Returned Amount'), data: 'returnedAmount', orderSequence: ['asc', 'desc'],
					render: (data: any, type: any, row: any) => row.isReturned ? `<span class="text-danger">${data}</span>` : data
				 },
				{
					title: this.app.localize('Status'),
					data: 'status',
					orderable: true,
					orderSequence: ['asc', 'desc'],
					render: (data: OrderStatus) => this.renderStatusBadge(data)
				},
				{
					title: this.app.localize('Payment Status'),
					data: 'paymentStatus',
					orderable: true,
					orderSequence: ['asc', 'desc'],
					render: (data: PaymentStatus) => this.renderPaymentStatusBadge(data)
				},
				{ 
					title: this.app.localize('Location'), 
					data: 'location.locationName', 
					orderable: false,
					render: (data: any) => data ? `<span class="badge badge-light"><i class="ri-store-line"></i> ${data}</span>` : '—'
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
				this.http.get<any>('/api/inventory/getpurchaseorders', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							orderDate: this.app.formatDate(item.orderDate),
							totalAmount: this.app.formatCurrency(item.totalAmount || 0),
							remainingAmount: this.app.formatCurrency(item.remainingAmount || 0),
							returnedAmount: this.app.formatCurrency(item.returnedAmount || 0),
							isDue: (item.remainingAmount || 0) > 0,
							isReturned: (item.returnedAmount || 0) > 0
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
			paymentStatus: this.filters.paymentStatus || '',
			dateFrom: this.filters.dateFrom || '',
			dateTo: this.filters.dateTo || ''
		};
	}

	// Render order status badge based on actual enum values
	private renderStatusBadge(status: OrderStatus): string {
		const title = this.statusOptions.find(opt => opt.value === status)?.label || this.app.localize('Unknown');
		const cssClass = this.statusOptions.find(opt => opt.value === status)?.class || 'badge badge-light';
		return `<span class="${cssClass}">${title}</span>`;
	}

	// Render payment status badge
	private renderPaymentStatusBadge(paymentStatus: PaymentStatus): string {
		const title = this.paymentStatusOptions.find(opt => opt.value === paymentStatus)?.label || this.app.localize('Unknown');
		const cssClass = this.paymentStatusOptions.find(opt => opt.value === paymentStatus)?.class || 'badge badge-light';
		return `<span class="${cssClass}">${title}</span>`;
	}

	// Render action dropdown for each row based on controller logic
	private renderActionColumn(row: any): string {
		let actions = `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">`;

		if(this.permissions.canView) {
			actions += `
			<a class="dropdown-item view-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-eye-line"></i>${this.app.localize('View')}
			</a>`;
		}
		
		if(this.permissions.canReturn && row.isReturned){
			actions += `
			<a class="dropdown-item view-return-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-bill-line"></i>${this.app.localize('View Return')}
			</a>`;
		}

		if ((row.status === OrderStatus.Pending || row.status === OrderStatus.InProgress) && this.permissions.canEdit) {
			actions += `
			<a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>`;
		}
		
		if (row.isDue && this.permissions.canPayDue) {
			actions += `
			<a class="dropdown-item pay-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-hand-coin-line"></i>${this.app.localize('Pay Due')}
			</a>`;
		}
		
		if (row.status === OrderStatus.Completed && this.permissions.canReturn) {
			actions += `
			<a class="dropdown-item return-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-arrow-go-back-line"></i>${this.app.localize('Process Return')}
			</a>`;
		}

		if (row.status !== OrderStatus.Cancelled && this.permissions.canCancel) {
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
				const viewReturnButton = target.closest('.view-return-button');
				const editButton = target.closest('.edit-button');
				const payButton = target.closest('.pay-button');
				const returnButton = target.closest('.return-button');
				const deleteButton = target.closest('.delete-button');
				const cancelButton = target.closest('.cancel-button');

				if (viewButton) {
					const id = parseInt(viewButton.getAttribute('data-id') || '0');
					this.showPrintModal(id, false);
				}

				if (viewReturnButton) {
					const id = parseInt(viewReturnButton.getAttribute('data-id') || '0');
					this.showPrintModal(id, true);
				}

				if (editButton) {
					const id = parseInt(editButton.getAttribute('data-id') || '0');
					this.editPurchase(id);
				}

				if (payButton) {
					const id = parseInt(payButton.getAttribute('data-id') || '0');
					this.payDuePurchase(id);
				}

				if (returnButton) {
					const id = parseInt(returnButton.getAttribute('data-id') || '0');
					this.returnPurchase(id);
				}

				if (deleteButton) {
					const id = parseInt(deleteButton.getAttribute('data-id') || '0');
					this.confirmDelete(id);
				}

				if (cancelButton) {
					const id = parseInt(cancelButton.getAttribute('data-id') || '0');
					this.confirmCancel(id);
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
	public showPrintModal(purchaseId: number, isReturned: boolean): void {
		this.printModal.show = true;
		this.printModal.loading = true;
		this.orderId = purchaseId;
		this.isReturned = isReturned;

		// Load purchase HTML
		this.http
			.get(`/api/inventory/viewpurchaseinvoice/${purchaseId}`, {
				params: { isReturnInvoice: isReturned.toString() },
				responseType: 'text'
			})
			.subscribe({
				next: html => {
					this.invoice = this.sanitizer.bypassSecurityTrustHtml(html);
					this.printModal.loading = false;
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
			setTimeout(() => contentWindow?.print?.(), 250);
		}
	}

	// Download invoice (PDF)
	public downloadInvoice(purchaseId: number): void {
		this.http.get(`/api/inventory/downloadpurchaseinvoice/${purchaseId}`, {
			params: { isReturnInvoice: this.isReturned.toString() },
			responseType: 'blob'
		}).subscribe({
			next: (data: Blob) => {
				const blob = new Blob([data], { type: data.type || 'application/octet-stream' });
				const downloadLink = window.document.createElement('a');
				const url = window.URL.createObjectURL(blob);
				downloadLink.href = url;
				downloadLink.download = `purchase_invoice_${purchaseId}.pdf`;
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

	// Navigate to edit purchase
	private editPurchase(id: number): void {
		this.app.navigate(`/inventory/purchases/edit/${id}`);
	}

	// Pay due for purchase using the correct API endpoint
	private payDuePurchase(id: number): void {
		const message = `${this.app.localize('Are you sure you want to pay due amount for order')} <strong>"#${id}"</strong>?`;
		this.app.confirmDialog(
			this.app.localize('Confirm Pay Due'),
			message,
			() => this.processPayDue(id),
			null,
			`<i class="ri-check-line"></i>` + this.app.localize('Pay Due'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'success'
		);
	}

	// Process pay due action using paydue endpoint
	private processPayDue(id: number): void {
		const dialogId = this.app.showLoadingDialog('Processing...');
		this.http.post<any>(`/api/inventory/paypurchasedue/${id}`, {}).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Due amount paid successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}

	// Navigate to return purchase
	private returnPurchase(id: number): void {
		this.app.navigate(`/inventory/purchases/return/${id}`);
	}

	// Show confirmation dialog before deleting purchase
	private confirmDelete(id: number): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"#${id}"</strong>?<br>
		${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.delete(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	// Delete purchase by id
	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/inventory/deletepurchaseorder/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Purchase order deleted successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}

	// Show confirmation dialog before cancelling purchase
	private confirmCancel(id: number): void {
		const message = `${this.app.localize('Are you sure you want to cancel')} <strong>"#${id}"</strong>?<br>
		${this.app.localize('Once cancelled you will not able to modify this record further.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Cancel'),
			message,
			() => this.cancel(id),
			null,
			`<i class="ri-close-circle-line"></i>` + this.app.localize('Cancel Purchase'),
			`<i class="ri-close-line"></i>` + this.app.localize('Keep Purchase'),
			'warning'
		);
	}

	// Cancel purchase by id
	private cancel(id: number): void {
		const dialogId = this.app.showLoadingDialog('Cancelling...');
		this.http.post<any>(`/api/inventory/cancelpurchaseorder/${id}`, {}).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Purchase order cancelled successfully.'));
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