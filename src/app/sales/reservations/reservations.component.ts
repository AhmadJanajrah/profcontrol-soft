import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-reservations',
	templateUrl: './reservations.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ReservationsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Form model
	public reservation: any = {};

	// Lookup data
	public customers: any[] = [];
	public customerTypeahead$ = new Subject<string>();

	// Filters
	public filters = {
		dateFrom: null as string | null,
		dateTo: null as string | null,
		status: null as number | null,
		reservationType: null as number | null,
		validated: false,
		submitted: false
	};

	// Enums
	// ReservationStatus: Pending=1, Confirmed=2, Completed=3, Cancelled=4
	public statusOptions = [
		{ value: 1, label: 'Pending', class: 'badge-light' },
		{ value: 2, label: 'Confirmed', class: 'badge-info' },
		{ value: 3, label: 'Completed', class: 'badge-primary' },
		{ value: 4, label: 'Cancelled', class: 'badge-danger' },
	];

	// ReservationType: Table=1, Event=2
	public typeOptions = [
		{ value: 1, label: 'Table', class: 'badge-light' },
		{ value: 2, label: 'Event', class: 'badge-info' },
	];

	// Modal
	public mainModal = {
		isUpdate: false,
		show: false,
		title: '',
		loading: false,
		submitted: false,
		validated: false,
		btnSaveText: 'Save',
		btnCancelText: 'Cancel'
	};

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService
	) {
		this.statusOptions.forEach(option => {
			option.label = this.app.localize(option.label);
		});
		this.typeOptions.forEach(option => {
			option.label = this.app.localize(option.label);
		});
		this.resetMainModal();
	}

	// Lifecycle
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

	// --- DataTable setup ---
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
				{ title: this.app.localize('Date'), data: 'reservationDate' },
				{ title: this.app.localize('Start'), data: 'startTime', orderable: false },
				{ title: this.app.localize('End'), data: 'endTime', orderable: false },
				{ title: this.app.localize('Customer'), data: 'customerName', orderable: false },
				{ title: this.app.localize('Party'), data: 'partySize', orderable: false, width: '70px' },
				{
					title: this.app.localize('Type'),
					data: 'reservationType',
					orderable: false,
					render: (data: number) => this.renderTypeBadge(data)
				},
				{
					title: this.app.localize('Status'),
					data: 'status',
					orderable: false,
					render: (data: number) => this.renderStatusBadge(data)
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
				this.http.get<any>('/api/sales/getreservations', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							reservationDate: this.app.formatDate(item.reservationDate),
							startTime: this.app.formatTime(item.startTime),
							endTime: this.app.formatTime(item.endTime) || '&mdash;',
							locationName: item.location?.locationName || '',
							customerName: item.customerName || item.customer?.fullName || '&mdash;'
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

	private buildDataTableQuery(params: any): any {
		return {
			locationId: this.app.getSelectedLocationId() || 0,
			start: params.start,
			length: params.length,
			searchValue: params.search.value,
			sortColumn: params.order[0]?.column ?? 0,
			sortDirection: params.order[0]?.dir ?? 'asc',
			dateFrom: this.filters.dateFrom || '',
			dateTo: this.filters.dateTo || '',
			status: this.filters.status ?? '',
			reservationType: this.filters.reservationType ?? ''
		};
	}

	private renderStatusBadge(status: number): string {
		const option = this.statusOptions.find(opt => opt.value === status);
		if (option) {
			return `<span class="badge ${option.class}">${option.label}</span>`;
		}
		return '';
	}

	private renderTypeBadge(type: number): string {
		const option = this.typeOptions.find(opt => opt.value === type);
		if (option) {
			return `<span class="badge ${option.class}">${option.label}</span>`;
		}
		return '';
	}

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

	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (tableBody) {
			this.renderer.listen(tableBody, 'click', (event: Event) => {
				const target = event.target as Element;
				const editButton = target.closest('.edit-button');
				const deleteButton = target.closest('.delete-button');

				if (editButton) {
					const id = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(id);
				}

				if (deleteButton) {
					const id = parseInt(deleteButton.getAttribute('data-id') || '0');
					this.confirmDelete(id);
				}
			});
		}
	}

	// --- Filters ---
	public applyFilters(filterForm: NgForm): void {
		if (filterForm.valid) {
			this.filters.submitted = true;
			this.reloadDataTable(true);
		} else {
			this.filters.validated = true;
		}
	}

	public resetFilters(): void {
		this.filters.dateFrom = null;
		this.filters.dateTo = null;
		this.filters.status = null;
		this.filters.reservationType = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	// --- Modal state ---
	private resetMainModal(): void {
		this.reservation = {
			id: 0,
			locationId: this.app.getSelectedLocationId() || 0,
			customerId: null,
			customerName: '',
			email: '',
			phone: '',
			reservationType: 1, // Table
			reservationDate: this.app.currentHTMLDate(),
			startTime: '18:00',
			endTime: '',
			duration: null,
			partySize: 1,
			specialRequests: '',
			status: 1, // Pending
			notes: ''
		};
		this.customers = [];
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

	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Reservation');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/sales/getreservation/${id}`).subscribe({
				next: data => {
					const d = data.reservation;
					// Ensure selected customer is available in ng-select items when editing
					if (d.customer) {
						const existing = {
							id: d.customer.id,
							fullName: d.customer.fullName,
							email: d.customer.email,
							phone: d.customer.phone
						};
						this.customers = [existing];
					}
					this.reservation = {
						id: d.id,
						locationId: d.locationId,
						customerId: d.customerId ?? null,
						customerName: d.customerName ?? d.customer?.fullName ?? '',
						email: d.email ?? d.customer?.email ?? '',
						phone: d.phone ?? d.customer?.phone ?? '',
						reservationType: d.reservationType,
						reservationDate: this.app.APIDateTimeToHTMLDate(d.reservationDate),
						startTime: this.app.APITimeToHTMLTime(d.startTime),
						endTime: d.endTime ? this.app.APITimeToHTMLTime(d.endTime) : null,
						duration: d.duration ?? null,
						partySize: d.partySize ?? 1,
						specialRequests: d.specialRequests ?? '',
						status: d.status,
						notes: d.notes ?? ''
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
			this.mainModal.title = this.app.localize('Add Reservation');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Submit ---
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.reservation.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/sales/updatereservation/${this.reservation.id}`
			: '/api/sales/createreservation';

		const payload = {
			...this.reservation,
			startTime: this.app.HTMLTimeToAPITime(this.reservation.startTime),
			endTime: this.reservation.endTime ? this.app.HTMLTimeToAPITime(this.reservation.endTime) : null,
			reservationDate: this.app.HTMLDateToAPIDateTime(this.reservation.reservationDate)
		};

		const request$ = isUpdate
			? this.http.put<any>(url, payload)
			: this.http.post<any>(url, payload);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Reservation updated successfully.')
					: this.app.localize('Reservation created successfully.');
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

	// --- Delete ---
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
		this.http.delete<any>(`/api/sales/deletereservation/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Reservation deleted successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}

	// --- Customer search ---
	public onCustomerSearch(e: { term: string }): void {
		const term = (e?.term || '').trim();
		if (!term || term.length < 2) {
			return;
		}

		const params = new HttpParams()
			.set('searchValue', term)
			.set('limit', 20);

		this.http.get<any>('/api/sales/reservationformdata', { params }).subscribe({
			next: res => {
				this.customers = (res.data || []).map((c: any) => ({
					id: c.id,
					fullName: c.fullName,
					email: c.email,
					phone: c.phone
				}));
			},
			error: err => this.app.handleApiError(err)
		});
	}

	public onCustomerChange(): void {
		if (!this.reservation.customerId) {
			// Allow manual inputs
			return;
		}
		// Prefill details to display (but keep read-only while selected)
		const selected = this.customers.find(x => x.id === this.reservation.customerId);
		if (selected) {
			this.reservation.customerName = selected.fullName || '';
			this.reservation.email = selected.email || '';
			this.reservation.phone = selected.phone || '';
		}
	}

	// --- Helpers ---

	private onPopState = (): void => {
		if (this.mainModal.show) this.resetMainModal();
	};
}