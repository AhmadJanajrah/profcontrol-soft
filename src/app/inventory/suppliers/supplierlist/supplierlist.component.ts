import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-supplierlist',
	templateUrl: './supplierlist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class SupplierListComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	public permissions = {
		canAdd: false,
		canEdit: false,
		canDelete: false,
		canView: false
	}

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService
	) {
		this.permissions = {
			canAdd: this.app.hasPermission('inventory.addsupplier'),
			canEdit: this.app.hasPermission('inventory.editsupplier'),
			canDelete: this.app.hasPermission('inventory.deletesupplier'),
			canView: this.app.hasPermission('inventory.viewsupplier')
		}
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
				{ title: this.app.localize('#'), data: 'id', orderSequence: ['asc', 'desc'], width: '60px' },
				{
					title: this.app.localize('Supplier'),
					data: 'supplierName',
					orderSequence: ['asc', 'desc'],
					render: (data: string, type: any, row: any) => this.renderSupplierColumn(data, row)
				},
				{ title: this.app.localize('Contact Person'), data: 'contactPerson', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Email'), data: 'email', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Phone'), data: 'phone', orderSequence: ['asc', 'desc'] },
				{
					title: this.app.localize('Rating'),
					data: 'rating',
					orderable: false,
					render: (data: number) => this.renderRatingStars(data)
				},
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
				this.http.get<any>('/api/inventory/getsuppliers', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							contactPerson: item.contactPerson || '—',
							email: item.email || '—',
							phone: item.phone || '—',
							rating: item.rating || 0
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

	// Render supplier name with contact info column
	private renderSupplierColumn(supplierName: string, row: any): string {
		const address = this.app.formatAddress(row.address, row.city, row.state, row.postalCode, row.country);
		return `
		<div>
		  <span class="no-wrap fw-medium">${supplierName}</span>
		  <small class="text-muted d-block small">${address || ''}</small>
		</div>`;
	}

	// Render rating stars
	private renderRatingStars(rating: number): string {
		if (!rating) return `<span class="text-muted">${this.app.localize('Not rated')}</span>`;

		let stars = '';
		for (let i = 1; i <= 5; i++) {
			if (i <= rating) {
				stars += '<i class="ri-star-fill text-warning"></i>';
			} else {
				stars += '<i class="ri-star-line text-muted"></i>';
			}
		}
		return `<div class="rating-stars">${stars}</div>`;
	}

	// Render status column
	private renderStatusBadge(isActive: boolean): string {
		return isActive
			? `<span class="badge badge-primary">${this.app.localize('Active')}</span>`
			: `<span class="badge badge-danger">${this.app.localize('Inactive')}</span>`;
	}

	// Render action dropdown for each row
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
			<a class="dropdown-item view-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-eye-line"></i>${this.app.localize('View')}
			</a>
			`;
		}
		// Edit action
		if (this.permissions.canEdit) {
			actions += `
			<a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>
			`;
		}
		// Delete action
		if (this.permissions.canDelete) {
			actions += `
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.supplierName}" href="javascript:void(0);">
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
				const viewButton = target.closest('.view-button');
				const editButton = target.closest('.edit-button');
				const deleteButton = target.closest('.delete-button');

				if (viewButton) {
					const id = parseInt(viewButton.getAttribute('data-id') || '0');
					this.viewSupplier(id);
				}

				if (editButton) {
					const id = parseInt(editButton.getAttribute('data-id') || '0');
					this.editSupplier(id);
				}

				if (deleteButton) {
					const id = parseInt(deleteButton.getAttribute('data-id') || '0');
					const name = deleteButton.getAttribute('data-name') || '';
					this.confirmDelete(id, name);
				}
			});
		}
	}

	// --- Action Methods ---

	// Navigate to view supplier
	private viewSupplier(id: number): void {
		this.app.navigate(`/inventory/suppliers/view/${id}`);
	}

	// Navigate to edit supplier
	private editSupplier(id: number): void {
		this.app.navigate(`/inventory/suppliers/edit/${id}`);
	}

	// Show confirmation dialog before deleting supplier
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

	// Delete supplier by id
	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/inventory/deletesupplier/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Supplier deleted successfully.'));
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