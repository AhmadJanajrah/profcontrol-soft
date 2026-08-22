import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { NgForm } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-payroll',
	templateUrl: './payroll.component.html',
	standalone: true,
	imports: [AppImports]
})
export class PayrollComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;
	@ViewChild('invoiceIframe') iframe!: ElementRef<HTMLIFrameElement>;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Filters
	public filters = {
		month: null as number | null,
		year: null as number | null,
		validated: false,
		submitted: false
	};

	public months: Array<{ id: number; value: string }> = [];
	public years: Array<{ id: number; value: number }> = [];

	// Status options (PayrollStatus: Paid=1, Unpaid=2)
	public statusOptions = [
		{ value: 1, label: 'Paid', class: 'badge-primary' },
		{ value: 2, label: 'Unpaid', class: 'badge-warning' }
	];

	// Generate Payroll Modal
	public generatePayrollModal = {
		show: false,
		loading: false,
		validated: false,
		submitted: false
	};

	public generatePayroll = {
		month: new Date().getMonth() + 1,
		year: new Date().getFullYear(),
		paymentMethodId: null as number | null
	};

	public paymentMethods: any[] = [];

	// Print Modal
	public printModal = {
		show: false,
		loading: false
	};

	public invoice: SafeHtml | '' = '';
	public orderId = 0;

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService,
		private sanitizer: DomSanitizer
	) {
		this.statusOptions.forEach(o => (o.label = this.app.localize(o.label)));
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.initDataTable();
		this.loadPayrollFormData();
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

	// Load payment methods, months, and years from HRM controller
	private loadPayrollFormData(): void {
		this.http.get<any>('/api/hrm/getpayrollformdata').subscribe({
			next: res => {
				this.paymentMethods = res.paymentMethods || [];
				this.months = this.app.getMonths();
				this.years = this.app.getYears();

				if (!this.generatePayroll.paymentMethodId && this.paymentMethods.length > 0) {
					this.generatePayroll.paymentMethodId = this.paymentMethods[0].id ?? this.paymentMethods[0].Id ?? null;
				}
			},
			error: err => this.app.handleApiError(err)
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
			lengthMenu: [
				[10, 25, 50, 100, 250],
				[10, 25, 50, 100, 250]
			],
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
				{
					title: this.app.localize('Employee'),
					data: 'employeeName',
					orderSequence: ['asc', 'desc'],
					render: (_: any, __: any, row: any) => this.renderEmployeeColumn(row.employee)
				},
				{ title: this.app.localize('Shift'), data: 'shiftName', orderable: false },
				{ title: this.app.localize('Period'), data: 'period', orderable: false },
				{ title: this.app.localize('Days'), data: 'daysWorked', orderable: false },
				{ title: this.app.localize('Net Pay'), data: 'netPay', orderable: false },
				{
					title: this.app.localize('Status'),
					data: 'paymentStatus',
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
					className: 'notexport',
					width: '50px',
					render: (_: any, __: any, row: any) => this.renderActionColumn(row)
				}
			],
			columnDefs: [
				{ targets: '_all', type: 'string' },
				{ targets: [-1], className: 'dt-center' }
			],
			layout: {
				bottomEnd: { paging: { firstLast: false } }
			},
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/hrm/getpayrolls', { params: query as any }).subscribe({
					next: response => {
						this.filters.submitted = false;
						this.filters.validated = false;
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							employeeName: item.employee?.employeeName || '',
							shiftName: item.shift?.shiftName || '—',
							period: `${this.app.getMonthName(item.payrollMonth)} ${item.payrollYear}`,
							daysWorked: `${item.daysWorked}/${item.totalWorkingDays}`,
							basicSalary: this.app.formatCurrency(item.basicSalary),
							grossPay: this.app.formatCurrency(item.grossPay),
							netPay: this.app.formatCurrency(item.netPay),
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
			payrollMonth: this.filters.month ? this.filters.month : '',
			payrollYear: this.filters.year ? this.filters.year : ''
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
		const label = statusOption ? statusOption.label : this.app.localize('Unknown');
		return `<span class="badge ${badgeClass}">${label}</span>`;
	}

	// Render action dropdown for each row
	private renderActionColumn(row: any): string {
		let actions = `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">
			<a class="dropdown-item print-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-printer-line"></i>${this.app.localize('View/Print')}
			</a>`;

		if (row.paymentStatus === 2) {
			actions += `
			<a class="dropdown-item process-button" data-id="${row.id}" data-name="${row.employee?.employeeName || ''}" href="javascript:void(0);">
				<i class="ri-check-line text-success"></i>${this.app.localize('Mark as Paid')}
			</a>`;
		}
		actions += `
			<a class="dropdown-item delete-button" data-id="${row.id}" data-name="${row.employee?.employeeName || ''}" href="javascript:void(0);">
				<i class="ri-delete-bin-2-line text-danger"></i>${this.app.localize('Delete')}
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
				const printButton = target.closest('.print-button');
				const processButton = target.closest('.process-button');
				const deleteButton = target.closest('.delete-button');

				if (printButton) {
					const payrollId = parseInt(printButton.getAttribute('data-id') || '0', 10);
					this.showPrintModal(payrollId);
				}

				if (processButton) {
					const payrollId = parseInt(processButton.getAttribute('data-id') || '0', 10);
					const employeeName = processButton.getAttribute('data-name') || '';
					this.showPayDialog(payrollId, employeeName);
				}

				if (deleteButton) {
					const payrollId = parseInt(deleteButton.getAttribute('data-id') || '0', 10);
					this.showDeleteDialog(payrollId);
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
		this.filters.month = null;
		this.filters.year = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	public hasAccessAllLocations(): boolean {
		return this.app.hasAccessAllLocations();
	}

	// --- Generate Payroll Modal ---

	public openGenerateModal(): void {
		this.generatePayrollModal.show = true;
		this.generatePayrollModal.loading = false;
		this.generatePayrollModal.validated = false;
		this.generatePayrollModal.submitted = false;
		history.pushState(null, '', window.location.pathname);
	}

	public closeGenerateModal(): void {
		this.generatePayrollModal.show = false;
		this.generatePayrollModal.loading = false;
		this.generatePayrollModal.validated = false;
		this.generatePayrollModal.submitted = false;
		history.back();
	}

	public submitGeneratePayroll(form: NgForm): void {
		this.generatePayrollModal.validated = true;
		if (!form.valid || !this.generatePayroll.paymentMethodId || !this.generatePayroll.month || !this.generatePayroll.year) {
			return;
		}
		this.generatePayrollModal.submitted = true;

		const payload = {
			locationId: this.app.getSelectedLocationId() || 0,
			payrollMonth: this.generatePayroll.month,
			payrollYear: this.generatePayroll.year,
			paymentMethodId: this.generatePayroll.paymentMethodId
		};

		this.http.post<any>('/api/hrm/generatepayroll', payload).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Payroll generated successfully.'));
				this.closeGenerateModal();
				this.reloadDataTable();
			},
			error: err => {
				this.app.handleApiError(err);
				this.generatePayrollModal.submitted = false;
			}
		});
	}

	// --- Print Modal ---

	// Show print modal
	public showPrintModal(payrollId: number): void {
		this.printModal.show = true;
		this.printModal.loading = true;
		this.orderId = payrollId;

		// Load payslip HTML
		this.http
			.get(`/api/hrm/generatepayslip/${payrollId}`, {
				responseType: 'text'
			})
			.subscribe({
				next: html => {
					this.invoice = this.sanitizer.bypassSecurityTrustHtml(html);
					this.printModal.loading = false;
				},
				error: error => {
					this.app.handleApiError(error);
					this.closePrintModal();
				}
			});

		history.pushState(null, '', window.location.pathname);
	}

	// Close print modal
	public closePrintModal(): void {
		this.printModal.show = false;
		this.printModal.loading = false;
		this.invoice = '';
		history.back();
	}

	// Print invoice
	public printInvoice(): void {
		const iframeElement = this.iframe?.nativeElement;
		const contentWindow = iframeElement?.contentWindow;
		if (contentWindow?.document?.readyState === 'complete') {
			contentWindow.print();
		} else {
			// Try after a small delay if not yet ready
			setTimeout(() => contentWindow?.print?.(), 250);
		}
	}

	// Download payslip (PDF)
	public downloadInvoice(payrollId: number): void {
		this.http.get(`/api/hrm/downloadpayslip/${payrollId}`, {
			responseType: 'blob'
		}).subscribe({
			next: (data: Blob) => {
				const blob = new Blob([data], { type: data.type || 'application/octet-stream' });

				// Create a download link and simulate a click on it
				const downloadLink = window.document.createElement('a');
				const url = window.URL.createObjectURL(blob);
				downloadLink.href = url;
				downloadLink.download = `payslip_${payrollId}.pdf`;

				// Append the link to the body and trigger a click event
				window.document.body.appendChild(downloadLink);
				downloadLink.click();

				// Clean up the link and revoke the object URL
				window.document.body.removeChild(downloadLink);
				window.URL.revokeObjectURL(url);
			},
			error: (error) => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Action Methods ---

	private showPayDialog(payrollId: number, employeeName: string): void {
		const message = `${this.app.localize('Mark payroll as paid for')} <strong>"${employeeName}"</strong>?`;
		this.app.confirmDialog(
			this.app.localize('Confirm'),
			message,
			() => this.markAsPaid(payrollId),
			null,
			`<i class="ri-check-line"></i>` + this.app.localize('Mark as Paid'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'info'
		);
	}

	private markAsPaid(id: number): void {
		const dialogId = this.app.showLoadingDialog('Processing...');
		this.http
			.put<any>(`/api/hrm/processpayroll/${id}`, null)
			.subscribe({
				next: () => {
					this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Payroll marked as paid.'));
					this.reloadDataTable();
					this.app.closeLoadingDialog(dialogId);
				},
				error: err => {
					this.app.handleApiError(err);
					this.app.closeLoadingDialog(dialogId);
				}
			});
	}

	private showDeleteDialog(id: number): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"#${id}"</strong>?<br>
		${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deletePayroll(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	private deletePayroll(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http
			.delete<any>(`/api/hrm/deletepayroll/${id}`)
			.subscribe({
				next: () => {
					this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Payroll deleted successfully.'));
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
		if (this.generatePayrollModal.show) this.generatePayrollModal.show = false;
		if (this.printModal.show) this.printModal.show = false;
	};
}