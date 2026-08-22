import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-employeelist',
	templateUrl: './employeelist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class EmployeeListComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Filter data
	public departments: any[] = [];
	public designations: any[] = [];
	public filters = {
		departmentId: null as number | null,
		designationId: null as number | null,
		validated: false,
		submitted: false
	};

	// Permissions
	public permissions = {
		canView: false,
		canAdd: false,
		canEdit: false,
		canDelete: false
	};

	constructor(
		private http: HttpClient,
		private router: Router,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService
	) {
		this.permissions = {
			canView: this.app.hasPermission?.('hrm.viewemployee') ?? true,
			canAdd: this.app.hasPermission?.('hrm.addemployee') ?? true,
			canEdit: this.app.hasPermission?.('hrm.editemployee') ?? true,
			canDelete: this.app.hasPermission?.('hrm.deleteemployee') ?? true
		};
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.initDataTable();
		this.loadFilterData();
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
			autoWidth: false,
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
				{
					title: this.app.localize('#'),
					data: 'id', orderSequence: ['desc', 'asc'],
					width: '60px',
					render: (data: any) => `EMP${data.toString().padStart(5, '0')}`
				},
				{
					title: this.app.localize('Employee'),
					data: 'employeeName',
					orderSequence: ['desc', 'asc'],
					render: (_: any, __: any, row: any) => this.renderEmployeeColumn(row)
				},
				{
					title: this.app.localize('Shifts'),
					data: null,
					orderable: false,
					render: (_: any, __: any, row: any) => this.renderShiftsBadge(row)
				},
				{
					title: this.app.localize('Contact'),
					data: null,
					orderable: false,
					render: (_: any, __: any, row: any) => this.renderContactColumn(row)
				},
				{
					title: this.app.localize('Basic Pay'),
					data: 'basicPay',
					orderable: false,
					render: (_: any, __: any, row: any) => this.renderBasicPayColumn(row)
				},
				{
					title: this.app.localize('Status'),
					data: 'isActive',
					orderable: false,
					render: (_: any, __: any, row: any) => this.renderStatusBadge(row.isActive)
				},
				{
					title: this.app.localize('Location'),
					data: 'locationName',
					orderable: false,
					render: (data: any) => data ? `<span class="badge badge-light"><i class="ri-store-line"></i> ${data}</span>` : '—'
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
			layout: {
				bottomEnd: {
					paging: { firstLast: false }
				}
			},
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/hrm/getemployees', { params: query }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							basicPay: this.app.formatCurrency(item.basicPay),
							locationName: item.location?.locationName || '',
						}));
						this.filters.submitted = false;
						this.filters.validated = false;
						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: formattedData
						});
						this.app.loadImages?.('[data-img="true"]');
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
			searchValue: params.search.value || '',
			sortColumn: params.order[0]?.column || 0,
			sortDirection: params.order[0]?.dir || 'desc',
			departmentId: this.filters.departmentId || '',
			designationId: this.filters.designationId || ''
		};
	}

	// Render employee column with image and details
	private renderEmployeeColumn(row: any): string {
		const imageUrl = row.profileImageUrl
			? this.app.apiUrl(`/api/media/getthumbnailimage/employees/${row.profileImageUrl}`)
			: 'assets/images/user.png';

		return `
        <div class="table-img-text">
            <img src="assets/images/user.png" data-img="true" data-url="${imageUrl}" alt="${row.employeeName}" class="table-avatar"/>
            <div class="text-block">
                <span class="fw-semibold">${row.employeeName}</span>
                <span class="text-muted small d-block">${row.department?.departmentName || 'N/A'} - ${row.designation?.designationName || 'N/A'}</span>
            </div>
        </div>`;
	}

	// Render contact column
	private renderContactColumn(row: any): string {
		const chunks: string[] = [];
		if (row.email) chunks.push(`<span><i class="ri-mail-line ri-1x me-1"></i>${row.email}</span>`);
		if (row.phoneNumber) chunks.push(`<span><i class="ri-phone-line ri-1x me-1"></i>${row.phoneNumber}</span>`);
		return `<div class="text-block">${chunks.join('<br/>') || '—'}</div>`;
	}

	// Render shifts column
	private renderShiftsBadge(row: any): string {
		if (row.employeeShifts && row.employeeShifts.length > 0) {
			return `
			<div class="text-block">
				${row.employeeShifts.map((shift: any) => `<span class="badge badge-light me-1 mb-1">${shift?.shift?.shiftName || ''}</span>`).join('')}
			</div>`;
		}
		return '—';
	}

	// Render basic pay column
	private renderBasicPayColumn(row: any): string {
		const payrollType = row.payrollType === 1 ? this.app.localize('Monthly') : this.app.localize('Hourly');
		const badgeClass = row.payrollType === 1 ? 'badge-info-light' : 'badge-warning-light';
		return `
        <div class="text-block">
            <span>${row.basicPay}</span>
            <span class="badge ${badgeClass}">${payrollType}</span>
        </div>`;
	}

	// Render status badge
	private renderStatusBadge(isActive: boolean): string {
		return isActive
			? `<span class="badge badge-primary">${this.app.localize('Active')}</span>`
			: `<span class="badge badge-light">${this.app.localize('Inactive')}</span>`;
	}

	// Render action dropdown for each row (no docs/salary actions here)
	private renderActionColumn(row: any): string {
		let actions = `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">`;

		if (this.permissions.canView) {
			actions += `
			<a class="dropdown-item view-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-eye-line"></i>${this.app.localize('View')}
			</a>`;
		}
		if (this.permissions.canEdit) {
			actions += `
			<a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>`;
		}
		if (this.permissions.canDelete) {
			actions += `
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.employeeName}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>`;
		}

		actions += `</div>`;
		return actions;
	}

	// Attach event listeners for table actions
	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (!tableBody) return;

		this.renderer.listen(tableBody, 'click', (event: Event) => {
			const target = event.target as Element;
			const viewButton = target.closest('.view-button');
			const editButton = target.closest('.edit-button');
			const deleteButton = target.closest('.delete-button');

			if (viewButton) {
				const employeeId = parseInt(viewButton.getAttribute('data-id') || '0', 10);
				this.viewEmployee(employeeId);
			}
			if (editButton) {
				const employeeId = parseInt(editButton.getAttribute('data-id') || '0', 10);
				this.editEmployee(employeeId);
			}
			if (deleteButton) {
				const employeeId = parseInt(deleteButton.getAttribute('data-id') || '0', 10);
				const employeeName = deleteButton.getAttribute('data-name') || '';
				this.confirmDeleteEmployee(employeeId, employeeName);
			}
		});
	}

	// --- Filter Methods ---

	// Load filter data
	private loadFilterData(): void {
		this.http.get<any>('/api/hrm/getemployeeformdata').subscribe({
			next: response => {
				this.departments = response.departments || [];
				this.designations = response.designations || [];
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// Apply filters and reload table
	public applyFilters(filterForm: NgForm): void {
		if (filterForm.valid) {
			this.filters.submitted = true;
			this.reloadDataTable(true);
		} else {
			this.filters.validated = true;
		}
	}

	// Clear all filters
	public clearFilters(): void {
		this.filters.departmentId = null;
		this.filters.designationId = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	public hasAccessAllLocations(): boolean {
		return this.app.hasAccessAllLocations();
	}

	// --- Navigation Methods ---

	public addEmployee(): void {
		this.router.navigate(['/hrm/employees/add']);
	}

	private viewEmployee(id: number): void {
		this.router.navigate(['/hrm/employees/view', id]);
	}

	private editEmployee(id: number): void {
		this.router.navigate(['/hrm/employees/edit', id]);
	}

	// --- Action Methods ---

	private confirmDeleteEmployee(id: number, employeeName: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${employeeName}"</strong>?<br>
		${this.app.localize('Once deleted all related data will be lost.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deleteEmployee(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	private deleteEmployee(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/hrm/deleteemployee/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Employee deleted successfully.'));
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