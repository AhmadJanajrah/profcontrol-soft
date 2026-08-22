import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-chartofaccounts',
	templateUrl: './chartofaccounts.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ChartOfAccountsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current account object
	public account: any = {};

	// Form data
	public accountTypes: any[] = [];
	public categories: any[] = [];
	public filteredCategories: any[] = [];

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
		window.addEventListener('popstate', this.onPopState);
	}

	ngAfterViewInit(): void {
		this.dtTrigger.next(null);
		this.addTableEventListeners();
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
				{ title: this.app.localize('Account Name'), data: 'accountName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Type'), data: 'typeName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Category'), data: 'categoryName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Balance'), data: 'balance', orderable: false },
				{
					title: this.app.localize('Status'),
					data: 'isActive',
					orderable: false,
					render: (data: any) => this.renderStatusBadge(data)
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
				this.http.get<any>('/api/accounting/getchartofaccounts', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							accountName: `${item.accountCode} - ${item.accountName}`,
							typeName: item.accountType?.typeName ?? '—',
							categoryName: item.category?.categoryName ?? '—',
							balance: this.app.formatCurrency(item.balance || 0)
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

	//Render status badge
	private renderStatusBadge(isActive: boolean): string {
		const statusClass = isActive ? 'primary' : 'danger';
		const statusText = isActive ? this.app.localize('Active') : this.app.localize('Inactive');
		return `<span class="badge bg-${statusClass}">${statusText}</span>`;
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
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.accountName}" href="javascript:void(0);">
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
				const editButton = (target.closest as any)?.call(target, '.edit-button');
				const deleteButton = (target.closest as any)?.call(target, '.delete-button');

				if (editButton) {
					const id = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(id);
				}

				if (deleteButton) {
					const id = parseInt(deleteButton.getAttribute('data-id') || '0');
					const name = deleteButton.getAttribute('data-name') || '';
					this.confirmDelete(id, name);
				}
			});
		}
	}

	// --- Form Data Methods ---

	// Load form data (account types and categories)
	private loadFormData(): void {
		this.http.get<any>('/api/accounting/getaccountformdata').subscribe({
			next: response => {
				this.accountTypes = response.accountTypes || [];
				this.categories = response.categories || [];
				this.updateFilteredCategories();
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// Filter categories by selected account type
	public onAccountTypeChange(): void {
		this.updateFilteredCategories();
		// Clear selected category if it doesn't belong to the chosen type
		if (this.account.categoryId && !this.filteredCategories.some(c => c.id === this.account.categoryId)) {
			this.account.categoryId = null;
		}
	}

	private updateFilteredCategories(): void {
		if (this.account?.accountTypeId) {
			this.filteredCategories = (this.categories || []).filter((c: any) => c.accountTypeId === this.account.accountTypeId);
		} else {
			this.filteredCategories = this.categories || [];
		}
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.account = {
			id: 0,
			accountTypeId: null,
			categoryId: null,
			accountCode: '',
			accountName: '',
			description: '',
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

	// Open account modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Account');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/accounting/getaccount/${id}`).subscribe({
				next: data => {
					const a = data.account;
					this.account = {
						id: a.id,
						accountTypeId: a.accountTypeId,
						categoryId: a.categoryId && a.categoryId > 0 ? a.categoryId : null,
						accountCode: a.accountCode,
						accountName: a.accountName,
						description: a.description,
						isActive: a.isActive
					};
					this.updateFilteredCategories();
					this.mainModal.loading = false;
				},
				error: error => {
					this.app.handleApiError(error);
					this.resetMainModal();
				}
			});
		} else {
			this.resetMainModal();
			this.mainModal.title = this.app.localize('Add Account');
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

	// Submit account form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.account.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/accounting/updateaccount/${this.account.id}`
			: '/api/accounting/createaccount';

		const payload = {
			...this.account,
			accountCode: (this.account.accountCode || '').toUpperCase(),
			categoryId: this.account.categoryId || 0
		};

		const request$ = isUpdate
			? this.http.put<any>(url, payload)
			: this.http.post<any>(url, payload);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Account updated successfully.')
					: this.app.localize('Account created successfully.');
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

	// Show confirmation dialog before deleting account
	private confirmDelete(id: number, reference: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${reference}"</strong>?<br>
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

	// Delete account by id
	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/accounting/deleteaccount/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Account deleted successfully.'));
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