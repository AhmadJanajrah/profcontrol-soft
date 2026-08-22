import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../../services/app.service';
import { NgForm } from '@angular/forms';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-attendancelist',
	templateUrl: './attendancelist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class AttendanceListComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Filters
	public filters = {
		dateFrom: null as string | null,
		dateTo: null as string | null,
		validated: false,
		submitted: false
	};

	// Modal state for editing single attendance
	public modal = {
		show: false,
		loading: false,
		submitted: false,
		validated: false,
		title: '',
	};

	public editAttendance: any = {
		id: 0,
		locationId: 0,
		attendanceDate: '',
		employeeId: 0,
		employeeName: '',
		shiftName: '',
		clockIn: '',
		clockOut: '',
		status: 1,
		notes: ''
	};

	// AttendanceStatus: Present=1, Absent=2, Leave=3, Late=4, HalfDay=5
	public statusOptions = [
		{ value: 1, label: 'Present', class: 'primary' },
		{ value: 2, label: 'Absent', class: 'danger' },
		{ value: 3, label: 'Leave', class: 'info' },
		{ value: 4, label: 'Late', class: 'warning' },
		{ value: 5, label: 'Half Day', class: 'secondary' }
	];

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService
	) {
		this.statusOptions.forEach(o => o.label = this.app.localize(o.label));
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.initDataTable();
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
				{ title: this.app.localize('Date'), data: 'attendanceDate', orderSequence: ['asc', 'desc'] },
				{
					title: this.app.localize('Employee'),
					data: 'employeeName',
					orderable: false,
					render: (_: any, __: any, row: any) => this.renderEmployeeColumn(row.employee)
				},
				{ title: this.app.localize('Shift'), data: 'shiftName', orderable: false },
				{
					title: this.app.localize('Status'),
					data: 'status',
					orderable: false,
					render: (data: any) => this.renderStatusBadge(data)
				},
				{ title: this.app.localize('Total Hours'), data: 'totalHours', orderable: false },
				{
					title: this.app.localize('Location'),
					data: 'locationName',
					orderable: false,
					render: (data: any) => data ? `<span class="badge badge-light"><i class="ri-store-line"></i>${data}</span>` : '—'
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
				this.http.get<any>('/api/hrm/getattendances', { params: query as any }).subscribe({
					next: response => {
						const data = (response.data || []).map((a: any) => ({
							...a,
							attendanceDate: this.app.formatDate(a.attendanceDate),
							shiftName: a.shift?.shiftName ?? '',
							totalHours: this.app.apiNumberToLocale(a.totalHours),
							locationName: a.location?.locationName ?? ''
						}));
						this.filters.submitted = false;
						this.filters.validated = false;
						callback({
							recordsTotal: response.recordsTotal || 0,
							recordsFiltered: response.recordsFiltered || 0,
							data
						});
					},
					error: err => {
						this.app.handleApiError(err);
						this.filters.submitted = false;
						this.filters.validated = false;
						callback({ recordsTotal: 0, recordsFiltered: 0, data: [] });
					}
				});
			}
		};
	}

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
	private buildQuery(params: any): any {
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

	//Render employee column
	private renderEmployeeColumn(employee: any): string {
		if (!employee) return '—';
		const employeeId = `EMP${employee.id.toString().padStart(5, '0')}`;
		return `<span>${employeeId} - ${employee.employeeName}</span><br>
            <small class="text-muted">${employee.department?.departmentName ?? ''} - ${employee.designation?.designationName ?? ''}</small>`;
	}

	// Render status badge
	private renderStatusBadge(status: number): string {
		const option = this.statusOptions.find(o => o.value === status);
		if (!option) return '—';
		return `<span class="badge badge-${option.class}">${option.label}</span>`;
	}

	// Render action dropdown for each row
	private renderActionColumn(row: any): string {
		return `
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
	}

	// Attach event listeners for table actions
	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (!tableBody) return;

		this.renderer.listen(tableBody, 'click', (event: Event) => {
			const target = event.target as Element;
			const editBtn = target.closest('.edit-button');
			const deleteBtn = target.closest('.delete-button');

			if (editBtn) {
				const id = parseInt(editBtn.getAttribute('data-id') || '0', 10);
				this.openEditModal(id);
			}

			if (deleteBtn) {
				const id = parseInt(deleteBtn.getAttribute('data-id') || '0', 10);
				this.confirmDelete(id);
			}
		});
	}

	// --- Filter Methods ---

	public applyFilters(): void {
		this.filters.submitted = true;
		this.reloadDataTable(true);
	}

	public resetFilters(): void {
		this.filters.dateFrom = null;
		this.filters.dateTo = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	public hasAccessAllLocations(): boolean {
		return this.app.hasAccessAllLocations();
	}

	// --- Edit Modal Methods ---

	public openEditModal(id: number): void {
		this.modal.title = this.app.localize('Edit Attendance');
		this.modal.loading = true;
		this.modal.show = true;
		this.modal.submitted = false;
		this.modal.validated = false;

		const locationId = this.app.getSelectedLocationId() || 0;
		this.http.get<any>(`/api/hrm/getattendance/${id}`).subscribe({
			next: res => {
				const a = res.attendance;
				this.editAttendance = {
					id: a.id,
					locationId,
					attendanceDate: this.app.formatDate(a.attendanceDate),
					employeeId: a.employee?.id ?? 0,
					employeeName: a.employee?.employeeName ?? '',
					shiftName: a.shift?.shiftName ?? '',
					clockIn: this.app.APITimeToHTMLTime(a.clockIn),
					clockOut: this.app.APITimeToHTMLTime(a.clockOut),
					status: a.status,
					notes: a.notes || ''
				};
				this.modal.loading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.closeModal();
			}
		});
		history.pushState(null, '', `${window.location.pathname}`);
	}

	public closeModal(): void {
		this.modal.show = false;
		this.modal.loading = false;
		this.modal.submitted = false;
		this.modal.validated = false;
		this.editAttendance = {
			id: 0, locationId: 0, attendanceDate: '', employeeId: 0, employeeName: '', shiftName: '',
			clockIn: '', clockOut: '', status: 1, notes: ''
		};
		history.back();
	}

	public submitEdit(form: NgForm): void {
		if (!form.valid) {
			this.modal.validated = true;
			return;
		}

		this.modal.submitted = true;

		const payload = {
			id: this.editAttendance.id,
			locationId: this.editAttendance.locationId,
			clockIn: this.app.HTMLTimeToAPITime(this.editAttendance.clockIn),
			clockOut: this.app.HTMLTimeToAPITime(this.editAttendance.clockOut),
			status: this.editAttendance.status,
			notes: this.editAttendance.notes
		};

		this.http.put<any>(`/api/hrm/updateattendance/${this.editAttendance.id}`, payload).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Attendance updated successfully.'));
				this.closeModal();
				this.reloadDataTable();
			},
			error: err => {
				this.app.handleApiError(err);
				this.modal.submitted = false;
			}
		});
	}

	// --- Action Methods ---

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
		this.http.delete<any>(`/api/hrm/deleteattendance/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Attendance deleted successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: err => {
				this.app.handleApiError(err);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}

	// --- Window Event Handlers ---

	private onPopState = (): void => {
		if (this.modal.show) this.modal.show = false;
	};
}