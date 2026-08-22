import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-leaverequests',
	templateUrl: './leaverequests.component.html',
	standalone: true,
	imports: [AppImports]
})
export class LeaveRequestsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Filters
	public filters = {
		leaveType: null,
		validated: false,
		submitted: false
	};

	// Current leave request object
	public leaveRequest: any = {};

	// Form data
	public employees: any[] = [];
	public leaveTypes = [
		{ value: 'Annual Leave', label: 'Annual Leave' },
		{ value: 'Sick Leave', label: 'Sick Leave' },
		{ value: 'Personal Leave', label: 'Personal Leave' },
		{ value: 'Maternity Leave', label: 'Maternity Leave' },
		{ value: 'Paternity Leave', label: 'Paternity Leave' },
		{ value: 'Emergency Leave', label: 'Emergency Leave' },
		{ value: 'Other', label: 'Other' }
	];

	// Status options (based on controller: Pending=1, Approved=2, Rejected=3)
	public statusOptions = [
		{ value: 1, label: 'Pending', class: 'badge-warning' },
		{ value: 2, label: 'Approved', class: 'badge-primary' },
		{ value: 3, label: 'Rejected', class: 'badge-danger' }
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
		this.localizeOptions();
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

	// --- Initialization Methods ---

	// Localize options
	private localizeOptions(): void {
		this.leaveTypes.forEach(option => {
			option.label = this.app.localize(option.label);
		});
		this.statusOptions.forEach(option => {
			option.label = this.app.localize(option.label);
		});
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
				{ title: this.app.localize('#'), data: 'id', orderSequence: ['desc', 'asc'], width: '50px' },
				{
					title: this.app.localize('Employee'), data: 'employeeName', orderSequence: ['asc', 'desc'],
					render: (_: any, __: any, row: any) => this.renderEmployeeColumn(row.employee)
				},
				{ title: this.app.localize('Leave Type'), data: 'leaveType', orderable: false },
				{ title: this.app.localize('Start Date'), data: 'startDate', orderable: false },
				{ title: this.app.localize('End Date'), data: 'endDate', orderable: false },
				{
					title: this.app.localize('Total Days'), data: 'totalDays', orderable: false,
					render: (data: any) => data ? `<span class="badge badge-light">${data}</span>` : '&mdash;'
				},
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
					render: (data: any, type: any, row: any) => this.renderActionColumn(row)
				}
			],
			columnDefs: [
				{ targets: '_all', type: 'string' },
				{ targets: [-1], className: 'dt-center' }
			],
			layout: {
				bottomEnd: {
					paging: {
						firstLast: false
					}
				}
			},
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/hrm/getleaverequests', { params: query }).subscribe({
					next: response => {
						this.filters.validated = false;
						this.filters.submitted = false;
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							leaveType: this.leaveTypes.find(type => type.value === item.leaveType)?.label || '—',
							employeeName: item.employee?.employeeName || '—',
							startDate: this.app.formatDate(item.startDate),
							endDate: this.app.formatDate(item.endDate),
							totalDays: item.totalDays,
							locationName: item.location?.locationName || ''
						}));
						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: formattedData
						});
					},
					error: error => {
						this.app.handleApiError(error);
						this.filters.validated = false;
						this.filters.submitted = false;
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
			leaveType: this.filters.leaveType || '',
		};
	}

	//Render employee column
	private renderEmployeeColumn(employee: any): string {
		if (!employee) return '&mdash;';
		const employeeId = `EMP${employee.id.toString().padStart(5, '0')}`;
		return `<span>${employeeId} - ${employee.employeeName}</span>`;
	}

	// Render status badge
	private renderStatusBadge(status: number): string {
		const statusOption = this.statusOptions.find(opt => opt.value === status);
		const badgeClass = statusOption ? statusOption.class : 'badge-light';
		const label = statusOption ? statusOption.label : 'Unknown';
		return `<span class="badge ${badgeClass}">${label}</span>`;
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
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.employeeName}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>`;

		actions += '</div>';
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
					const leaveId = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(leaveId);
				}

				if (deleteButton) {
					const leaveId = parseInt(deleteButton.getAttribute('data-id') || '0');
					const employeeName = deleteButton.getAttribute('data-name') || '';
					this.confirmDeleteLeaveRequest(leaveId, employeeName);
				}
			});
		}
	}

	// --- Filter Methods ---

	public applyFilters(): void {
		this.filters.submitted = true;
		this.reloadDataTable(true);
	}

	public resetFilters(): void {
		this.filters.leaveType = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	// --- Form Data Methods ---

	// Load employees for dropdown
	private loadFormData(): void {
		this.http.get<any>('/api/hrm/getleaverequestformdata', {
			params: { locationId: this.app.getSelectedLocationId().toString() }
		}).subscribe({
			next: response => {
				this.employees = response.employees || [];
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.leaveRequest = {
			id: 0,
			employeeId: null,
			locationId: this.app.getSelectedLocationId(),
			leaveType: null,
			startDate: '',
			endDate: '',
			totalDays: 0,
			reason: '',
			status: 1 // Default to Pending
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

	// Open leave request modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Leave Request');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/hrm/getleaverequest/${id}`, {
				params: { locationId: this.app.getSelectedLocationId().toString() }
			}).subscribe({
				next: data => {
					this.leaveRequest = { ...data.leaveRequest };
					this.leaveRequest.startDate = this.app.APIDateTimeToHTMLDate(this.leaveRequest.startDate);
					this.leaveRequest.endDate = this.app.APIDateTimeToHTMLDate(this.leaveRequest.endDate);
					this.mainModal.loading = false;
				},
				error: error => {
					this.app.handleApiError(error);
					this.resetMainModal();
				}
			});
		} else {
			this.resetMainModal();
			this.mainModal.title = this.app.localize('Add Leave Request');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close leave request modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Form Methods ---

	// Submit leave request form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.leaveRequest.id > 0 && this.mainModal.isUpdate;

		const data = { ...this.leaveRequest };
		data.startDate = this.app.HTMLDateToAPIDateTime(data.startDate);
		data.endDate = this.app.HTMLDateToAPIDateTime(data.endDate);

		const url = isUpdate
			? `/api/hrm/updateleaverequest/${this.leaveRequest.id}`
			: '/api/hrm/createleaverequest';

		const request$ = isUpdate
			? this.http.put<any>(url, data)
			: this.http.post<any>(url, data);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Leave request updated successfully.')
					: this.app.localize('Leave request created successfully.');
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

	// Show confirmation dialog before deleting leave request
	private confirmDeleteLeaveRequest(id: number, employeeName: string): void {
		const message = `${this.app.localize('Are you sure you want to delete leave request for')} <strong>"${employeeName}"</strong>?<br>
    ${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deleteLeaveRequest(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	// Delete leave request by id
	private deleteLeaveRequest(id: number): void {
		var dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/hrm/deleteleaverequest/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Leave request deleted successfully.'));
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