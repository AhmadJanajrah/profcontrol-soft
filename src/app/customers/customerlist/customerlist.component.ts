import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-customerlist',
	templateUrl: './customerlist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class CustomerListComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Dropdown data for filters
	public customerTypes: any[] = [];
	public statusOptions: any[] = [];

	// Permission flags
	public permissions: any = {};

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService
	) {
		this.permissions = {
			canAdd: this.app.hasPermission('customers.add'),
			canEdit: this.app.hasPermission('customers.edit'),
			canDelete: this.app.hasPermission('customers.delete'),
			canView: this.app.hasPermission('customers.view')
		};
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.initDataTable();
	}

	ngAfterViewInit(): void {
		this.dtTrigger.next(null);
		this.addTableEventListeners();
	}

	ngOnDestroy(): void {
		this.dtTrigger.unsubscribe();
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
				{ title: this.app.localize('#'), data: 'id', orderSequence: ['desc', 'asc'], width: '50px' },
				{
					title: this.app.localize('Customer'),
					data: 'fullName',
					orderSequence: ['asc', 'desc'],
					render: (data: string, type: any, row: any) => this.renderCustomerColumn(data, row)
				},
				{ title: this.app.localize('Email'), data: 'email', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Phone'), data: 'phone', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Address'), data: 'address', orderable: false, width: '250px' },
				{ title: this.app.localize('Total Spent'), data: 'totalSpent', orderable: false },
				{ title: this.app.localize('Loyalty Points'), data: 'loyaltyPoints', orderable: false },
				{
					title: this.app.localize('Status'),
					data: 'isActive',
					orderable: false,
					render: (data: boolean) => this.renderStatusBadge(data)
				},
				{
					title: this.app.localize('Action'),
					data: null,
					orderable: false,
					width: '50px',
					render: (data: any, type: any, row: any) => this.renderActionColumn(row)
				}
			],
			columnDefs: [
				{ targets: '_all', type: 'string' },
				{ targets: [-1], className: 'dt-center' },
			],
			layout: { bottomEnd: { paging: { firstLast: false } } },
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/customers/getcustomers', { params: query }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							email: item.email || '—',
							phone: item.phone || '—',
							address: this.app.formatAddress(item.address, item.city, item.state, item.postalCode, item.country) || '—',
							totalSpent: this.app.formatCurrency(item.totalSpent || 0),
              loyaltyPoints: this.app.formatNumber(item.loyaltyPoints || 0),
							lastVisitDate: this.app.formatDateTime(item.lastVisitDate) || '—',
							customerType: item.customerType || 'Regular',
							feedbackType: item.feedbackType || '—',
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
			sortColumn: params.order[0].column,
			sortDirection: params.order[0].dir
		};
	}

	// Render customer name and location column
	private renderCustomerColumn(fullName: string, row: any): string {
		return `
		<div class="table-img-text">
			<i class="ri-user-line fs-6 bg-primary-light rounded-circle"></i>
			<div class="text-block">
				<span class="no-wrap">${fullName}</span>
				<small class="text-muted">${this.app.localize(row.customerType)}</small>
			</div>
		</div>`;
	}

	// Render status column with badges
	private renderStatusBadge(isActive: boolean): string {
		return isActive
			? `<span class="badge badge-primary">${this.app.localize('Active')}</span>`
			: `<span class="badge badge-danger">${this.app.localize('Inactive')}</span>`;
	}

	// Render action column with dropdown menu
	private renderActionColumn(row: any): string {
		let actions = `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">
		`;
		// View action
		if (this.permissions.canView) {
			actions += `
			<a class="dropdown-item view-customer" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-eye-line"></i>${this.app.localize('View')}
			</a>
			`;
		}
		// Edit action
		if (this.permissions.canEdit) {
			actions += `
			<a class="dropdown-item edit-customer" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>
			`;
		}
		// Delete action
		if (this.permissions.canDelete) {
			actions += `
			<a class="dropdown-item text-danger delete-customer" data-id="${row.id}" data-name="${row.fullName}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>
			`;
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
				const viewButton = target.closest('.view-customer');
				const editButton = target.closest('.edit-customer');
				const deleteButton = target.closest('.delete-customer');

				if (viewButton) {
					const customerId = parseInt(viewButton.getAttribute('data-id') || '0');
					this.app.navigate(`/customers/view/${customerId}`);
				}

				if (editButton) {
					const customerId = parseInt(editButton.getAttribute('data-id') || '0');
					this.app.navigate(`/customers/edit/${customerId}`);
				}

				if (deleteButton) {
					const customerId = parseInt(deleteButton.getAttribute('data-id') || '0');
					const customerName = deleteButton.getAttribute('data-name') || '';
					this.confirmDeleteCustomer(customerId, customerName);
				}
			});
		}
	}

	// --- Delete Methods ---

	// Show confirmation dialog before deleting customer
	private confirmDeleteCustomer(id: number, customerName: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${customerName}"</strong>?
		<br>${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deleteCustomer(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	// Delete customer by id
	private deleteCustomer(id: number): void {
		var dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/customers/deletecustomer/${id}`).subscribe({
			next: (response) => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Customer deleted successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}
}
