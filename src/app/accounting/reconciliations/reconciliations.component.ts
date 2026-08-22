import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-reconciliations',
	templateUrl: './reconciliations.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ReconciliationsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Form model for creating reconciliation
	public reconciliation: any = {};

	// Filters
	public filters = {
		bankAccountId: null as number | null,
		dateFrom: null as string | null,
		dateTo: null as string | null,
		validated: false,
		submitted: false
	};

	// Data for selects
	public bankAccounts: any[] = [];

	// Add modal state
	public mainModal = {
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

	// Initialize DataTable with server-side config (aligned with controller's sort columns 0..3)
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
				// IMPORTANT: Only columns 0..3 are orderable to match controller's sort mapping.
				{ title: this.app.localize('#'), data: 'id', orderSequence: ['asc', 'desc'], width: '60px' },
				{ title: this.app.localize('From'), data: 'statementStartDate', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('To'), data: 'statementEndDate', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Statement Closing'), data: 'statementClosingBalance', orderable: false },
				{ title: this.app.localize('System Closing'), data: 'systemClosingBalance', orderable: false },
				{ title: this.app.localize('Difference'), data: 'difference', orderable: false },
				{ title: this.app.localize('Bank Account'), data: 'bankAccountName', orderable: false },
				{ title: this.app.localize('Notes'), data: 'notes', orderable: false },
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
				this.http.get<any>('/api/accounting/getreconciliations', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							statementStartDate: this.app.formatDate(item.statementStartDate),
							statementEndDate: this.app.formatDate(item.statementEndDate),
							statementClosingBalance: this.app.formatCurrency(item.statementClosingBalance ?? 0),
							systemClosingBalance: this.app.formatCurrency(item.systemClosingBalance ?? 0),
							difference: this.app.formatCurrency(item.difference ?? 0),
							bankAccountName: item.bankAccount
								? `${item.bankAccount.bankName ?? ''} (${item.bankAccount.accountNumber ?? ''})`
								: '—',
							notes: item.notes || '—'
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

	// Build query params for DataTable server-side (aligned with controller signature)
	private buildDataTableQuery(params: any): any {
		return {
			start: params.start,
			length: params.length,
			searchValue: params.search.value,
			sortColumn: params.order[0]?.column ?? 0,
			sortDirection: params.order[0]?.dir ?? 'asc',
			bankAccountId: this.filters.bankAccountId || '',
			dateFrom: this.filters.dateFrom || '',
			dateTo: this.filters.dateTo || ''
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

	// Render action dropdown for each row
	private renderActionColumn(row: any): string {
		const name = row.bankAccountName || `#${row.id}`;
		return `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>
		</div>`;
	}

	// Attach event listeners for table actions
	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (tableBody) {
			this.renderer.listen(tableBody, 'click', (event: Event) => {
				const target = event.target as Element;
				const deleteButton = target.closest('.delete-button');

				if (deleteButton) {
					const id = parseInt((deleteButton as HTMLElement).getAttribute('data-id') || '0', 10);
					this.confirmDelete(id);
				}
			});
		}
	}

	// --- Filter Methods ---

	public applyFilters(form: NgForm): void {
		if (form.valid) {
			this.filters.submitted = true;
			this.reloadDataTable(true);
		} else {
			this.filters.validated = true;
		}
	}

	public resetFilters(): void {
		this.filters.bankAccountId = null;
		this.filters.dateFrom = null;
		this.filters.dateTo = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	// --- Form Data Methods ---

	private loadFormData(): void {
		this.http.get<any>('/api/accounting/getreconciliationformdata').subscribe({
			next: res => {
				this.bankAccounts = (res.bankAccounts || []).map((x: any) => ({
					...x,
					displayName: x.displayName ?? `${x.bankName} (${x.accountNumber})`
				}));
			},
			error: err => this.app.handleApiError(err)
		});
	}

	// --- Modal Management: Add ---

	private resetMainModal(): void {
		this.reconciliation = {
			id: 0,
			bankAccountId: null,
			statementStartDate: this.app.currentHTMLDate(),
			statementEndDate: this.app.currentHTMLDate(),
			statementClosingBalance: '',
			notes: ''
		};
		this.mainModal = {
			show: false,
			title: '',
			loading: false,
			submitted: false,
			validated: false,
			btnSaveText: this.app.localize('Save'),
			btnCancelText: this.app.localize('Cancel')
		};
	}

	// Open modal to create reconciliation
	public openAddModal(): void {
		this.resetMainModal();
		this.mainModal.title = this.app.localize('Add Reconciliation');
		this.mainModal.show = true;
		history.pushState(null, '', `${window.location.pathname}`);
	}

	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// Submit create form (controller computes system closing and difference)
	public submitForm(form: NgForm): void {
		if (!form.valid || !this.reconciliation.bankAccountId) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;

		const payload = {
			id: 0,
			bankAccountId: this.reconciliation.bankAccountId,
			statementStartDate: this.app.HTMLDateToAPIDateTime(this.reconciliation.statementStartDate),
			statementEndDate: this.app.HTMLDateToAPIDateTime(this.reconciliation.statementEndDate),
			statementClosingBalance: this.app.localeToAPINumber(this.reconciliation.statementClosingBalance),
			notes: this.reconciliation.notes
		};

		this.http.post<any>('/api/accounting/createreconciliation', payload).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Reconciliation created successfully.'));
				this.closeMainModal();
				this.reloadDataTable();
			},
			error: err => {
				this.app.handleApiError(err);
				this.mainModal.submitted = false;
			}
		});
	}

	// Confirm and delete reconciliation
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

	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/accounting/deletereciliation/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Reconciliation deleted successfully.'));
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

	private onPopState = (): void => {
		if (this.mainModal.show) this.resetMainModal();
	};
}