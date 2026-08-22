import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-expensecategories',
	templateUrl: './expensecategories.component.html',
	standalone: true,
	imports: [AppImports],
})
export class ExpenseCategoriesComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Form model
	public category: any = {};

	// Form data
	public accounts: any[] = [];

	// Modal state
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

	// Lifecycle
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

	// Initialize DataTable aligned with controller sorting (0: Id, 1: CategoryName)
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
				{ title: this.app.localize('#'), data: 'id', orderable: true, width: '60px' },
				{ title: this.app.localize('Category Name'), data: 'categoryName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Account'), data: 'accountName', orderable: false },
				{ title: this.app.localize('Description'), data: 'description', orderable: false },
				{
					title: this.app.localize('Status'),
					data: 'isActive',
					orderable: false,
					render: (data: boolean) => this.renderStatusBadge(data)
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
				const query = this.buildQuery(params);
				this.http.get<any>('/api/accounting/getexpensecategories', { params: query as any }).subscribe({
					next: response => {
						const formatted = (response.data || []).map((x: any) => ({
							...x,
							description: x.description || '—',
							accountName: x.account ? `${x.account.accountCode} - ${x.account.accountName}` : '—',
						}));
						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: formatted
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

	// Build query to match controller signature
	private buildQuery(params: any): any {
		return {
			start: params.start,
			length: params.length,
			searchValue: params.search.value,
			sortColumn: params.order[0]?.column ?? 0,
			sortDirection: params.order[0]?.dir ?? 'asc'
		};
	}

	// Reload DataTable
	private reloadDataTable(): void {
		if (this.dtElement?.dtInstance) {
			this.dtElement.dtInstance.then(dt => dt.ajax.reload(undefined, false));
		}
	}

	// Render Status badge
	private renderStatusBadge(isActive: boolean): string {
		return isActive ? `<span class="badge badge-primary">${this.app.localize('Yes')}</span>` : `<span class="badge badge-light">${this.app.localize('No')}</span>`;
	}

	// Actions column
	private renderActionColumn(row: any): string {
		return `
    <button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
      <i class="ri-more-fill"></i>
    </button>
    <div class="dropdown-menu dropdown-menu-end">
      <a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
        <i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
      </a>
      <a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.categoryName}" href="javascript:void(0);">
        <i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
      </a>
    </div>`;
	}

	// Event listeners for table actions
	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (tableBody) {
			this.renderer.listen(tableBody, 'click', (event: Event) => {
				const target = event.target as Element;
				const editButton = target.closest('.edit-button');
				const deleteButton = target.closest('.delete-button');

				if (editButton) {
					const id = parseInt((editButton as HTMLElement).getAttribute('data-id') || '0', 10);
					this.openMainModal(id);
				}

				if (deleteButton) {
					const id = parseInt((deleteButton as HTMLElement).getAttribute('data-id') || '0', 10);
					const name = (deleteButton as HTMLElement).getAttribute('data-name') || '';
					this.confirmDelete(id, name);
				}
			});
		}
	}

	// Load accounts for form (Expense accounts)
	private loadFormData(): void {
		this.http.get<any>('/api/accounting/getexpensecategoryformdata').subscribe({
			next: res => {
				this.accounts = this.app.formatAccountsForNgSelect(res.accounts || []);
			},
			error: err => this.app.handleApiError(err)
		});
	}

	// Modal helpers
	private resetMainModal(): void {
		this.category = {
			id: 0,
			accountId: null,
			categoryName: '',
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

	// Open add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Expense Category');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/accounting/getexpensecategory/${id}`).subscribe({
				next: data => {
					const c = data.expenseCategory;
					this.category = {
						id: c.id,
						accountId: c.accountId,
						categoryName: c.categoryName,
						description: c.description,
						isActive: c.isActive
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
			this.mainModal.title = this.app.localize('Add Expense Category');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// Submit create/update
	public submitForm(form: NgForm): void {
		if (!form.valid || !this.category.accountId || !this.category.categoryName) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.category.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/accounting/updateexpensecategory/${this.category.id}`
			: '/api/accounting/createexpensecategory';

		const payload = { ...this.category };

		const request$ = isUpdate
			? this.http.put<any>(url, payload)
			: this.http.post<any>(url, payload);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Expense category updated successfully.')
					: this.app.localize('Expense category created successfully.');
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

	// Delete flow
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

	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/accounting/deleteexpensecategory/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Expense category deleted successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}

	// Back button behavior
	private onPopState = (): void => {
		if (this.mainModal.show) this.resetMainModal();
	};
}