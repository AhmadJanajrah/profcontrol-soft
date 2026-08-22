import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-transfers',
	templateUrl: './transfers.component.html',
	standalone: true,
	imports: [AppImports]
})
export class TransfersComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current transfer object
	public transfer: any = {};

	// Form data
	public bankAccounts: any[] = [];

	// Filters
	public filters = {
		dateFrom: null as string | null,
		dateTo: null as string | null,
		validated: false,
		submitted: false
	};

	// Status options
	public statusOptions = [
		{ value: 1, label: 'Draft' },
		{ value: 2, label: 'Posted' },
		{ value: 3, label: 'Cancelled' },
	];

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
		this.statusOptions.forEach(s => s.label = this.app.localize(s.label));
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
				{ title: this.app.localize('Transfer Date'), data: 'transferDate', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('From'), data: 'fromName', orderable: false },
				{ title: this.app.localize('To'), data: 'toName', orderable: false },
				{ title: this.app.localize('Amount'), data: 'amount', orderable: false },
				{
					title: this.app.localize('Status'),
					data: 'status',
					orderable: false,
					render: (data: any) => this.renderStatusBadge(data)
				},
				{
					title: this.app.localize('Location'),
					data: 'locationName',
					orderable: false,
					render: (data: any) =>
						data ? `<span class="badge badge-light"><i class="ri-store-line"></i> ${data}</span>` : '&mdash;'
				},
				{
					title: this.app.localize('Actions'),
					data: null,
					orderable: false,
					width: '50px',
					render: (_: any, __: any, row: any) => this.renderActionColumn(row)
				}
			],
			columnDefs: [
				{ targets: '_all', type: 'string' },
				{ targets: [-1], className: 'dt-center' }
			],
			layout: { bottomEnd: { paging: { firstLast: false } } },
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/accounting/gettransfers', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							transferDate: this.app.formatDate(item.transferDate),
							fromName: `${item.fromBankAccount?.bankName ?? ''} (${item.fromBankAccount?.accountNumber ?? ''})`,
							toName: `${item.toBankAccount?.bankName ?? ''} (${item.toBankAccount?.accountNumber ?? ''})`,
							amount: this.app.formatCurrency(item.amount || 0),
							locationName: item.location?.locationName || ''
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
			sortDirection: params.order[0]?.dir ?? 'asc',
			dateFrom: this.filters.dateFrom || '',
			dateTo: this.filters.dateTo || ''
		};
	}

	// Render status column
	private renderStatusBadge(status: number): string {
		// TransactionStatus: Draft=1, Posted=2, Cancelled=3 (frontend mapping)
		if (status === 2) return `<span class="badge badge-primary">${this.app.localize('Posted')}</span>`;
		if (status === 3) return `<span class="badge badge-danger">${this.app.localize('Cancelled')}</span>`;
		return `<span class="badge badge-light">${this.app.localize('Draft')}</span>`;
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
			</a>
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>
		</div>`;
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
					const id = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(id);
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
		this.filters.dateFrom = null;
		this.filters.dateTo = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	// Check if user has access to all locations
	public hasAccessAllLocations(): boolean {
		return this.app.hasAccessAllLocations();
	}

	// --- Form Data Methods ---

	// Load form data (bank accounts)
	private loadFormData(): void {
		this.http.get<any>('/api/accounting/gettransferformdata').subscribe({
			next: response => {
				this.bankAccounts = (response.bankAccounts || []).map((x: any) => ({
					...x,
					displayName: `${x.bankName} (${x.accountNumber})`
				}));
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.transfer = {
			id: 0,
			locationId: this.app.getSelectedLocationId() || 0,
			fromBankAccountId: null,
			toBankAccountId: null,
			transferDate: this.app.currentHTMLDate(),
			amount: '',
			status: 2, // Default to Posted
			notes: ''
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

	// Open transfer modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Transfer');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/accounting/gettransfer/${id}`).subscribe({
				next: data => {
					const t = data.transfer;
					this.transfer = {
						id: t.id,
						locationId: t.locationId,
						fromBankAccountId: t.fromBankAccountId,
						toBankAccountId: t.toBankAccountId,
						referenceNumber: t.referenceNumber,
						transferDate: this.app.APIDateTimeToHTMLDate(t.transferDate),
						amount: this.app.apiNumberToLocale(t.amount),
						status: t.status,
						notes: t.notes
					};
					this.mainModal.loading = false;
				},
				error: error => {
					this.app.handleApiError(error);
					this.resetMainModal();
				}
			});
		} else {
			this.resetMainModal();
			this.mainModal.title = this.app.localize('Add Transfer');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close transfer modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Form Submission Methods ---

	// Submit transfer form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}
		if (this.transfer.fromBankAccountId === this.transfer.toBankAccountId) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('From and To bank accounts cannot be the same.'));
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.transfer.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/accounting/updatetransfer/${this.transfer.id}`
			: '/api/accounting/createtransfer';

		const payload = {
			...this.transfer,
			amount: this.app.localeToAPINumber(this.transfer.amount),
			transferDate: this.app.HTMLDateToAPIDateTime(this.transfer.transferDate)
		};

		const request$ = isUpdate
			? this.http.put<any>(url, payload)
			: this.http.post<any>(url, payload);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Transfer updated successfully.')
					: this.app.localize('Transfer created successfully.');
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

	// Show confirmation dialog before deleting transfer
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

	// Delete transfer by id
	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/accounting/deletetransfer/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Transfer deleted successfully.'));
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
		if (this.mainModal.show) this.resetMainModal();
	};
}