import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-coupons',
	templateUrl: './coupons.component.html',
	standalone: true,
	imports: [AppImports]
})
export class CouponsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current coupon object
	public coupon: any = {};

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
				{ title: this.app.localize('#'), data: 'id', orderSequence: ['desc', 'asc'], width: '60px' },
				{ title: this.app.localize('Code'), data: 'code', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Description'), data: 'description', orderable: false },
				{ title: this.app.localize('Discount'), data: 'discountValue', orderable: false },
				{ title: this.app.localize('Valid From'), data: 'startDate', orderable: false },
				{ title: this.app.localize('Valid Until'), data: 'endDate', orderable: false },
				{ 
					title: this.app.localize('Usage'), 
					data: 'usageCount', 
					orderable: false,
					render: (data: number, type: any, row: any) => this.renderUsageBadge(data, row.totalUsageLimit)
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
				{ targets: [-1], className: 'dt-center' },
			],
			layout: { bottomEnd: { paging: { firstLast: false } } },
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/customers/getcoupons', { params: query }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							description: item.description || '—',
							discountValue: item.isPercentage ? this.app.formatPercent(item.discountValue) : this.app.formatCurrency(item.discountValue),
							startDate: item.startDate ? this.app.formatDate(item.startDate) : '—',
							endDate: item.endDate ? this.app.formatDate(item.endDate) : '—',
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

	// Render usage column
	private renderUsageBadge(used: number, total: number | null): string {
		const totalText = total ? total.toString() : '∞';
		return `<span class="badge badge-info">${used} / ${totalText}</span>`;
	}

	// Render status column with badges
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
			<a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.code}" href="javascript:void(0);">
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
					const couponId = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(couponId);
				}

				if (deleteButton) {
					const couponId = parseInt(deleteButton.getAttribute('data-id') || '0');
					const couponCode = deleteButton.getAttribute('data-name') || '';
					this.confirmDeleteCoupon(couponId, couponCode);
				}
			});
		}
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.coupon = {
			id: 0,
			code: '',
			description: '',
			isPercentage: true,
			discountValue: '',
			startDate: null,
			endDate: null,
			minimumOrderAmount: '0',
			maxUsagePerCustomer: '',
			totalUsageLimit: '',
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

	// Open coupon modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Coupon');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/customers/getcoupon/${id}`).subscribe({
				next: data => {
					this.coupon = { ...data.coupon };
					this.coupon.discountValue = this.app.apiNumberToLocale(this.coupon.discountValue);
					this.coupon.minimumOrderAmount = this.coupon.minimumOrderAmount ? this.app.apiNumberToLocale(this.coupon.minimumOrderAmount) : '';
					this.coupon.startDate = this.coupon.startDate ? this.app.APIDateTimeToHTMLDate(this.coupon.startDate) : null;
					this.coupon.endDate = this.coupon.endDate ? this.app.APIDateTimeToHTMLDate(this.coupon.endDate) : null;
					this.mainModal.loading = false;
				},
				error: error => {
					this.app.handleApiError(error);
					this.resetMainModal();
				}
			});
		} else {
			this.resetMainModal();
			this.mainModal.title = this.app.localize('Add Coupon');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close coupon modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Form Submission Methods ---

	// Submit coupon form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.coupon.id > 0 && this.mainModal.isUpdate;

		const couponData = {
			...this.coupon,
			discountValue: this.app.localeToAPINumber(this.coupon.discountValue),
			minimumOrderAmount: this.coupon.minimumOrderAmount ? this.app.localeToAPINumber(this.coupon.minimumOrderAmount) : null,
			maxUsagePerCustomer: this.coupon.maxUsagePerCustomer || null,
			totalUsageLimit: this.coupon.totalUsageLimit || null
		};

		const url = isUpdate
			? `/api/customers/updatecoupon/${this.coupon.id}`
			: '/api/customers/createcoupon';

		const request$ = isUpdate
			? this.http.put<any>(url, couponData)
			: this.http.post<any>(url, couponData);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Coupon updated successfully.')
					: this.app.localize('Coupon created successfully.');
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

	// Show confirmation dialog before deleting coupon
	private confirmDeleteCoupon(id: number, couponCode: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${couponCode}"</strong>?<br>
    ${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deleteCoupon(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	// Delete coupon by id
	private deleteCoupon(id: number): void {
		var dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/customers/deletecoupon/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Coupon deleted successfully.'));
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