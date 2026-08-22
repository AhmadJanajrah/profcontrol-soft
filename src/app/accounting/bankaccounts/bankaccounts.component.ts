import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-bankaccounts',
	templateUrl: './bankaccounts.component.html',
	standalone: true,
	imports: [AppImports]
})
export class BankAccountsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current bank account object
	public bankAccount: any = {};

	// Form data
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
				{ title: this.app.localize('Bank Name'), data: 'bankName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Account Number'), data: 'accountNumber', orderSequence: ['asc', 'desc'] },
				{ title: 'IBAN', data: 'iban', orderable: false },
				{ title: this.app.localize('Swift Code'), data: 'swiftCode', orderable: false },
				{ title: this.app.localize('Opening Balance'), data: 'openingBalance', orderable: false },
				{
					title: this.app.localize('Active'),
					data: 'isActive',
					orderable: false,
					render: (isActive: boolean) => isActive
						? `<span class="badge badge-primary">${this.app.localize('Yes')}</span>`
						: `<span class="badge badge-light">${this.app.localize('No')}</span>`
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
				this.http.get<any>('/api/accounting/getbankaccounts', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							openingBalance: this.app.formatCurrency(item.openingBalance || 0)
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
			sortColumn: params.order[0]?.column ?? 0,
			sortDirection: params.order[0]?.dir ?? 'asc'
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
			</a>
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.bankName} (${row.accountNumber})" href="javascript:void(0);">
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
					const bankAccountId = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(bankAccountId);
				}

				if (deleteButton) {
					const bankAccountId = parseInt(deleteButton.getAttribute('data-id') || '0');
					const name = deleteButton.getAttribute('data-name') || '';
					this.confirmDelete(bankAccountId, name);
				}
			});
		}
	}

	// --- Form Data Methods ---

	// Load form data (ledger accounts)
	private loadFormData(): void {
		this.http.get<any>('/api/accounting/getbankaccountformdata').subscribe({
			next: response => {
				this.accounts = this.app.formatAccountsForNgSelect(response.accounts || []);
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.bankAccount = {
			id: 0,
			accountId: null,
			bankName: '',
			branchName: '',
			accountNumber: '',
			iban: '',
			swiftCode: '',
			openingBalance: '',
			isActive: true
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

	// Open modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Bank Account');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/accounting/getbankaccount/${id}`).subscribe({
				next: data => {
					const ba = data.bankAccount;
					this.bankAccount = {
						id: ba.id,
						accountId: ba.accountId,
						bankName: ba.bankName,
						branchName: ba.branchName,
						accountNumber: ba.accountNumber,
						iban: ba.iban,
						swiftCode: ba.swiftCode,
						openingBalance: this.app.apiNumberToLocale(ba.openingBalance),
						isActive: ba.isActive
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
			this.mainModal.title = this.app.localize('Add Bank Account');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Form Submission Methods ---

	// Submit form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.bankAccount.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/accounting/updatebankaccount/${this.bankAccount.id}`
			: '/api/accounting/createbankaccount';

		const payload = {
			...this.bankAccount,
			openingBalance: this.app.localeToAPINumber(this.bankAccount.openingBalance)
		};

		const request$ = isUpdate
			? this.http.put<any>(url, payload)
			: this.http.post<any>(url, payload);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Bank account updated successfully.')
					: this.app.localize('Bank account created successfully.');
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

	// Confirm delete
	private confirmDelete(id: number, name: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${name}"</strong>?<br>
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

	// Delete by id
	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('D');
		this.http.delete<any>(`/api/accounting/deletebankaccount/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Bank account deleted successfully.'));
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