import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-driverlist',
	templateUrl: './driverlist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class DriverListComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	public permissions: any = {};

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService
	) {
		const canManage = this.app.canAccessDrivers();
		this.permissions = {
			canAdd: canManage,
			canEdit: canManage,
			canDelete: canManage,
			canView: canManage
		};
	}

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
					title: this.app.localize('Driver'),
					data: 'fullName',
					orderSequence: ['asc', 'desc'],
					render: (data: string, type: any, row: any) => this.renderDriverColumn(data, row)
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
				this.http.get<any>('/api/drivers/getdrivers', { params: query }).subscribe({
					next: response => {
						const rows = response.data || response.Data || [];
						const formattedData = rows.map((item: any) => ({
							...item,
							email: item.email || '—',
							phone: item.phone || '—',
							address: this.app.formatAddress(item.address, item.city, item.state, item.postalCode, item.country) || '—',
							totalSpent: this.app.formatCurrency(item.totalSpent || 0),
							loyaltyPoints: this.app.formatNumber(item.loyaltyPoints || 0),
							driverType: item.driverType || 'Regular',
						}));
						callback({
							recordsTotal: response.recordsTotal ?? response.RecordsTotal ?? formattedData.length,
							recordsFiltered: response.recordsFiltered ?? response.RecordsFiltered ?? formattedData.length,
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

	private reloadDataTable(): void {
		if (this.dtElement?.dtInstance) {
			this.dtElement.dtInstance.then(dt => dt.ajax.reload(undefined, false));
		}
	}

	private buildDataTableQuery(params: any): any {
		return {
			start: params.start,
			length: params.length,
			searchValue: params.search.value,
			sortColumn: params.order[0].column,
			sortDirection: params.order[0].dir
		};
	}

	private renderDriverColumn(fullName: string, row: any): string {
		return `
		<div class="table-img-text">
			<i class="ri-steering-2-line fs-6 bg-primary-light rounded-circle"></i>
			<div class="text-block">
				<span class="no-wrap">${fullName}</span>
				<small class="text-muted">${this.app.localize(row.driverType)}</small>
			</div>
		</div>`;
	}

	private renderStatusBadge(isActive: boolean): string {
		return isActive
			? `<span class="badge badge-primary">${this.app.localize('Active')}</span>`
			: `<span class="badge badge-danger">${this.app.localize('Inactive')}</span>`;
	}

	private renderActionColumn(row: any): string {
		const safeName = String(row.fullName || '').replace(/"/g, '&quot;');
		let actions = `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">
		`;
		if (this.permissions.canView) {
			actions += `
			<a class="dropdown-item view-driver" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-eye-line"></i>${this.app.localize('View')}
			</a>
			`;
		}
		if (this.permissions.canEdit) {
			actions += `
			<a class="dropdown-item edit-driver" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>
			`;
		}
		if (this.permissions.canDelete) {
			actions += `
			<a class="dropdown-item text-danger delete-driver" data-id="${row.id}" data-name="${safeName}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>
			`;
		}
		actions += '</div>';
		return actions;
	}

	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (tableBody) {
			this.renderer.listen(tableBody, 'click', (event: Event) => {
				const target = event.target as Element;
				const viewButton = target.closest('.view-driver');
				const editButton = target.closest('.edit-driver');
				const deleteButton = target.closest('.delete-driver');

				if (viewButton) {
					const driverId = parseInt(viewButton.getAttribute('data-id') || '0');
					this.app.navigate(`/drivers/view/${driverId}`);
				}

				if (editButton) {
					const driverId = parseInt(editButton.getAttribute('data-id') || '0');
					this.app.navigate(`/drivers/edit/${driverId}`);
				}

				if (deleteButton) {
					const driverId = parseInt(deleteButton.getAttribute('data-id') || '0');
					const driverName = deleteButton.getAttribute('data-name') || '';
					this.confirmDeleteDriver(driverId, driverName);
				}
			});
		}
	}

	private confirmDeleteDriver(id: number, driverName: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${driverName}"</strong>?
		<br>${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deleteDriver(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	private deleteDriver(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/drivers/deletedriver/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Driver deleted successfully.'));
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
