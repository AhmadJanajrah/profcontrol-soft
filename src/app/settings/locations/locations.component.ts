import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-locations',
	templateUrl: './locations.component.html',
	standalone: true,
	imports: [AppImports]
})
export class LocationsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current location object
	public location: any = {};

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
				{ title: this.app.localize('Location Name'), data: 'locationName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Address'), data: 'address', orderable: false },
				{ title: this.app.localize('Email'), data: 'email', orderable: false },
				{ title: this.app.localize('Phone'), data: 'phone', orderable: false },
				{
					title: this.app.localize('Timing'),
					data: null,
					orderable: false,
					render: (data: any, type: any, row: any) => this.renderTiming(row.openingTime, row.closingTime)
				},
				{
					title: this.app.localize('Head Office'),
					data: 'isHeadOffice',
					orderable: false,
					render: (data: boolean) => this.renderHeadOfficeBadge(data)
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
				this.http.get<any>('/api/settings/getlocations', { params: query }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							address: this.app.formatAddress(item.address, item.city, item.state, item.postalCode, item.country) || `—`,
							phone: item.phone || `—`,
							email: item.email || `—`,
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

	//Render timing string
	private renderTiming(openingTime: string, closingTime: string): string {
		if (openingTime && closingTime) {
			return `${this.app.formatTime(openingTime)} - ${this.app.formatTime(closingTime)}`;
		}
		return `—`;
	}

	// Render head office badge
	private renderHeadOfficeBadge(isHeadOffice: boolean): string {
		if (isHeadOffice) {
			return `<span class="badge badge-primary">${this.app.localize('Yes')}</span>`;
		}
		return `<span class="badge badge-light">${this.app.localize('No')}</span>`;
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
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.locationName}" href="javascript:void(0);">
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
				const editButton = target.closest('.edit-button');
				const deleteButton = target.closest('.delete-button');

				if (editButton) {
					const locationId = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(locationId);
				}

				if (deleteButton) {
					const locationId = parseInt(deleteButton.getAttribute('data-id') || '0');
					const locationName = deleteButton.getAttribute('data-name') || '';
					this.confirmDeleteLocation(locationId, locationName);
				}
			});
		}
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.location = {
			id: 0,
			locationName: '',
			address: '',
			city: '',
			state: '',
			country: '',
			postalCode: '',
			phone: '',
			email: '',
			openingTime: '',
			closingTime: '',
			taxIdentificationNumber: '',
			isHeadOffice: false
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

	// Open location modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Location');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/settings/getlocation/${id}`).subscribe({
				next: data => {
					this.location = { ...data.location };
					// Convert UTC times to local for editing
					if (this.location.openingTime) {
						this.location.openingTime = this.app.APITimeToHTMLTime(this.location.openingTime);
					}
					if (this.location.closingTime) {
						this.location.closingTime = this.app.APITimeToHTMLTime(this.location.closingTime);
					}
					this.mainModal.loading = false;
				},
				error: error => {
					this.app.handleApiError(error);
					this.resetMainModal();
				}
			});
		} else {
			this.resetMainModal();
			this.mainModal.title = this.app.localize('Add Location');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close location modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Form Submission Methods ---

	// Submit location form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.location.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/settings/updatelocation/${this.location.id}`
			: '/api/settings/createlocation';

		// Prepare data with time conversion
		const locationData = { ...this.location };
		locationData.openingTime = locationData.openingTime ? this.app.HTMLTimeToAPITime(locationData.openingTime) : null;
		locationData.closingTime = locationData.closingTime ? this.app.HTMLTimeToAPITime(locationData.closingTime) : null;
		locationData.email = locationData.email || null;
		locationData.phone = locationData.phone || null;

		const request$ = isUpdate
			? this.http.put<any>(url, locationData)
			: this.http.post<any>(url, locationData);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Location updated successfully.')
					: this.app.localize('Location created successfully.');
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

	// Show confirmation dialog before deleting location
	private confirmDeleteLocation(id: number, locationName: string): void {
		const message = `${this.app.localize('Are you sure you want to delete location')} <strong>"${locationName}"</strong>?<br>
    ${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deleteLocation(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	// Delete location by id
	private deleteLocation(id: number): void {
		var dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/settings/deletelocation/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Location deleted successfully.'));
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