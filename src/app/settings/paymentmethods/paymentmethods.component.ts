import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-paymentmethods',
	templateUrl: './paymentmethods.component.html',
	standalone: true,
	imports: [AppImports]
})
export class PaymentMethodsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current payment method object
	public paymentMethod: any = {};

	// Stripe and PayPal configurations
	public stripeConfig: any = {};
	public paypalConfig: any = {};

	// Available accounts for selection
	public accounts: any[] = [];

	// Modal state management
	public mainModal = {
		isUpdate: false,
		show: false,
		title: '',
		loading: false,
		submitted: false,
		validated: false,
		btnSaveText: '',
		btnCancelText: ''
	};

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService
	) {
		this.resetMainModal();
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.initDataTable();
		this.loadFormData();
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
				{ title: this.app.localize('Method Name'), data: 'methodName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Processor Fee'), data: 'processorFee', orderable: false },
				{
					title: this.app.localize('Availability'),
					data: null,
					orderable: false,
					render: (data: any, type: any, row: any) => this.renderAvailabilityText(row)
				},
				{
					title: this.app.localize('Status'),
					data: 'isActive',
					orderable: false,
					render: (data: any, type: any, row: any) => this.renderStatusBadge(row.isActive)
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
				{ targets: [-1, -2], className: 'dt-center' }
			],
			layout: { bottomEnd: { paging: { firstLast: false } } },
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/settings/getpaymentmethods', { params: query }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							processorFee: item.isFeePercentage ? this.app.formatPercent(item.processorFee) : this.app.formatCurrency(item.processorFee)
						}));
						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: formattedData
						});
					},
					error: error => {
						this.app.handleApiError(error);
						callback({ recordsTotal: 0, recordsFiltered: 0, data: [] });
					}
				});
			}
		};
	}

	//Render status badge
	private renderStatusBadge(isActive: boolean): string {
		return `
			<span class="badge ${isActive ? 'badge-primary' : 'badge-light'}">
				${isActive ? this.app.localize('Active') : this.app.localize('Inactive')}
			</span>
		`;
	}

	//Render availability text
	private renderAvailabilityText(row: any): string {
		const availability = [];
		if (row.isAvailableInPos) availability.push(this.app.localize('POS'));
		if (row.isAvailableOnline) availability.push(this.app.localize('Online'));
		return availability.length > 0 ? availability.join(', ') : this.app.localize('N/A');
	}

	// Reload DataTable data
	private reloadDataTable(): void {
		if (this.dtElement?.dtInstance) {
			this.dtElement.dtInstance.then(dt => dt.ajax.reload(undefined, false));
		}
	}

	// Build query params for DataTable server-side
	private buildDataTableQuery(params: any): any {
		return {
			start: params.start,
			length: params.length,
			searchValue: params.search.value,
			sortColumn: params.order[0].column,
			sortDirection: params.order[0].dir
		};
	}

	// Render action dropdown for each row
	private renderActionColumn(row: any): string {
		let actions = `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">
			<a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>`;

		if (!row.isSystem) {
			actions += `
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.methodName}" href="javascript:void(0);">
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
				const editButton = target.closest('.edit-button');
				const deleteButton = target.closest('.delete-button');

				if (editButton) {
					const paymentMethodId = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(paymentMethodId);
				}

				if (deleteButton) {
					const paymentMethodId = parseInt(deleteButton.getAttribute('data-id') || '0');
					const methodName = deleteButton.getAttribute('data-name') || '';
					this.confirmDeletePaymentMethod(paymentMethodId, methodName);
				}
			});
		}
	}

	// --- Form Data Methods ---

	// Load form data (accounts)
	private loadFormData(): void {
		this.http.get<any>('/api/settings/getpaymentmethodformdata').subscribe({
			next: response => {
				this.accounts = response.accounts;
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.paymentMethod = {
			id: 0,
			accountId: null,
			methodName: '',
			isActive: true,
			processorFee: '0',
			isFeePercentage: false,
			allowsPartialPayment: false,
			allowsRefund: false,
			isAvailableInPos: true,
			isAvailableOnline: false
		};
		this.stripeConfig = {
			publishableKey: '',
			secretKey: '',
			webhookSecret: '',
			isLive: false
		};
		this.paypalConfig = {
			clientId: '',
			clientSecret: '',
			isLive: false
		};
		this.mainModal = {
			isUpdate: false,
			show: false,
			title: '',
			loading: false,
			submitted: false,
			validated: false,
			btnSaveText: this.app.localize('Save'),
			btnCancelText: this.app.localize('Cancel')
		};
	}

	// Open payment method modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Payment Method');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/settings/getpaymentmethod/${id}`).subscribe({
				next: data => {
					this.paymentMethod = { ...data.paymentMethod };
					this.paymentMethod.processorFee = this.app.apiNumberToLocale(this.paymentMethod.processorFee);

					// Load configurations for system payment methods
					if (this.paymentMethod.configJson) {
						try {
							const config = JSON.parse(this.paymentMethod.configJson);
							if (this.paymentMethod.methodName.toLowerCase() === 'stripe') {
								this.stripeConfig = { ...this.stripeConfig, ...config };
							} else if (this.paymentMethod.methodName.toLowerCase() === 'paypal') {
								this.paypalConfig = { ...this.paypalConfig, ...config };
							}
						} catch (e) {
							console.warn('Failed to parse payment method config:', e);
						}
					}

					this.mainModal.loading = false;
				},
				error: error => {
					this.app.handleApiError(error);
					this.resetMainModal();
				}
			});
		} else {
			this.resetMainModal();
			this.mainModal.title = this.app.localize('Add Payment Method');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close payment method modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Form Submission Methods ---

	// Submit payment method form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.paymentMethod.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/settings/updatepaymentmethod/${this.paymentMethod.id}`
			: '/api/settings/createpaymentmethod';

		const paymentMethodData = {
			paymentMethod: {
				...this.paymentMethod,
				processorFee: this.app.localeToAPINumber(this.paymentMethod.processorFee)
			},
			stripe: this.paymentMethod.methodName?.toLowerCase() === 'stripe' ? this.stripeConfig : null,
			paypal: this.paymentMethod.methodName?.toLowerCase() === 'paypal' ? this.paypalConfig : null
		};

		const request$ = isUpdate
			? this.http.put<any>(url, paymentMethodData)
			: this.http.post<any>(url, paymentMethodData);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Payment method updated successfully.')
					: this.app.localize('Payment method created successfully.');
				this.app.showSuccessMessage(this.app.localize('Success!'), msg);
				this.closeMainModal();
				this.reloadDataTable();
			},
			error: err => {
				this.app.handleApiError(err);
				this.mainModal.submitted = false;
			}
		});
	}

	// --- Action Methods ---

	// Show confirmation dialog before deleting payment method
	private confirmDeletePaymentMethod(id: number, methodName: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${methodName}"</strong>?<br>
    ${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deletePaymentMethod(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	// Delete payment method by id
	private deletePaymentMethod(id: number): void {
		var dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/settings/deletepaymentmethod/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Payment method deleted successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}

	// Check if current payment method is system method
	public isSystemMethod(): boolean {
		return this.paymentMethod.methodName?.toLowerCase() === 'stripe' ||
			this.paymentMethod.methodName?.toLowerCase() === 'paypal';
	}

	// --- Window Event Handlers ---

	// Reset modal state on browser back navigation
	private onPopState = (): void => {
		if (this.mainModal.show) this.resetMainModal();
	};
}