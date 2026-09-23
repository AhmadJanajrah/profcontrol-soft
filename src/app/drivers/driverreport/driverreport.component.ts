import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-driverreport',
	templateUrl: './driverreport.component.html',
	standalone: true,
	imports: [AppImports]
})
export class DriverReportComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	public dtOptions: any;
	public dtTrigger: Subject<any> = new Subject();
	public statusFilter = 'all';

	public info = {
		start: 0,
		end: 0,
		total: 0
	};

	constructor(
		private http: HttpClient,
		public app: AppService
	) { }

	ngOnInit(): void {
		this.initDataTable();
	}

	ngAfterViewInit(): void {
		this.dtTrigger.next(null);
	}

	ngOnDestroy(): void {
		this.dtTrigger.unsubscribe();
	}

	private initDataTable(): void {
		const direction = document.documentElement.dir || document.body.dir || 'ltr';

		this.dtOptions = {
			autoWidth: false,
			processing: true,
			serverSide: true,
			search: { return: true },
			lengthMenu: [[10, 25, 50, 100, 250], [10, 25, 50, 100, 250]],
			pageLength: 50,
			order: [[0, 'asc']],
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
					title: this.app.localize('Driver'), data: 'fullName',
					render: (data: string) => `<strong>${data || '—'}</strong>`
				},
				{
					title: this.app.localize('Driver Type'), data: 'driverType',
					render: (data: string) => this.app.localize(data || '—')
				},
				{ title: this.app.localize('Email'), data: 'email' },
				{ title: this.app.localize('Phone'), data: 'phone' },
				{ title: this.app.localize('Address'), data: 'address' },
				{
					title: this.app.localize('Total Spent'), data: 'totalSpent',
					render: (data: number) => this.app.formatCurrency(data || 0)
				},
				{
					title: this.app.localize('Loyalty Points'), data: 'loyaltyPoints',
					render: (data: number) => this.app.formatNumber(data || 0)
				},
				{
					title: this.app.localize('Status'), data: 'isActive', orderable: false,
					render: (data: boolean) => data
						? `<span class="badge badge-primary">${this.app.localize('Active')}</span>`
						: `<span class="badge badge-danger">${this.app.localize('Inactive')}</span>`
				}
			],
			columnDefs: [
				{ targets: '_all', type: 'string' }
			],
			buttons: [
				{
					extend: 'excel',
					title: () => this.app.localize('Drivers'),
					filename: () => 'Drivers_' + new Date().toISOString().slice(0, 10),
					text: '<i title="excel" class="ri-file-excel-2-line text-success"></i>',
					className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
					exportOptions: { columns: ':not(.notexport)' }
				},
				{
					extend: 'pdfHtml5',
					title: () => this.app.localize('Drivers'),
					filename: () => 'Drivers_' + new Date().toISOString().slice(0, 10),
					text: '<i title="pdf" class="ri-file-pdf-2-line text-danger"></i>',
					className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
					exportOptions: { columns: ':not(.notexport)' },
					customize: (doc: any) => this.customizePdfExport(doc),
					pageSize: 'A4',
				},
				{
					extend: 'print',
					title: () => this.app.localize('Drivers'),
					filename: () => 'Drivers_' + new Date().toISOString().slice(0, 10),
					text: '<i title="print" class="ri-printer-line text-info"></i>',
					className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
					exportOptions: { columns: ':not(.notexport)' },
					customize: (win: any) => this.customizePrintExport(win)
				},
				{
					extend: 'csv',
					title: () => this.app.localize('Drivers'),
					filename: () => 'Drivers_' + new Date().toISOString().slice(0, 10),
					text: '<i title="csv" class="ri-file-text-line text-warning"></i>',
					className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
					exportOptions: { columns: ':not(.notexport)' }
				}
			],
			layout: {
				top2End: 'buttons',
				bottomEnd: {
					paging: {
						firstLast: false
					}
				}
			},
			ajax: (params: any, callback: any) => {
				const query = this.buildDataTableQuery(params);
				this.http.get<any>('/api/drivers/getdrivers', { params: query }).subscribe({
					next: response => {
						const rows = response.data || response.Data || [];
						const total = response.recordsTotal ?? response.RecordsTotal ?? rows.length;
						this.info = {
							start: rows.length ? params.start + 1 : 0,
							end: Math.min(params.start + params.length, total),
							total
						};
						const formattedData = rows.map((item: any) => ({
							...item,
							email: item.email || '—',
							phone: item.phone || '—',
							address: this.app.formatAddress(item.address, item.city, item.state, item.postalCode, item.country) || '—',
							driverType: item.driverType || '—'
						}));
						callback({
							recordsTotal: total,
							recordsFiltered: response.recordsFiltered ?? response.RecordsFiltered ?? total,
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

	private buildDataTableQuery(params: any): any {
		const query: any = {
			start: params.start,
			length: params.length,
			searchValue: params.search?.value || '',
			sortColumn: params.order?.[0]?.column ?? 0,
			sortDirection: params.order?.[0]?.dir || 'asc'
		};

		if (this.statusFilter === 'active') query.isActive = true;
		if (this.statusFilter === 'inactive') query.isActive = false;
		return query;
	}

	private customizePdfExport(doc: any): void {
		const direction = document.documentElement.dir || document.body.dir || 'ltr';
		const align = direction === 'rtl' ? 'right' : 'left';

		doc.pageMargins = [15, 30, 15, 30];
		doc.defaultStyle = { fontSize: 8, alignment: align };

		const infoLines = [
			{ text: this.app.localize('Drivers'), bold: true, fontSize: 12, margin: [0, 0, 0, 4], alignment: 'center' }
		];

		doc.content = doc.content || [];
		let insertIndex = doc.content.findIndex((c: any) => !!c.table);
		if (insertIndex === -1) insertIndex = 0;
		doc.content.splice(insertIndex, 0, {
			table: {
				widths: ['*'],
				body: [[{ stack: infoLines, alignment: 'center', margin: [0, 0, 0, 0], lineHeight: 1.2 }]]
			},
			layout: 'noBorders',
			margin: [0, 0, 0, 5]
		});
	}

	private customizePrintExport(win: any): void {
		const infoHtml = `
			<div class="print-info mb-3" style="text-align:center; margin-bottom:10px; line-height:1.2;">
				<h5 class="text-primary mb-1" style="margin:0">${this.app.localize('Drivers')}</h5>
			</div>`;

		const table = win.document.querySelector('table');
		if (table) {
			table.insertAdjacentHTML('beforebegin', infoHtml);
		}
	}

	public reloadDataTable(isResetPage = false): void {
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
}
