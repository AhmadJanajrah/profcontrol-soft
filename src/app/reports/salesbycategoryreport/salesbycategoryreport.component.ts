import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-salesbycategoryreport',
	templateUrl: './salesbycategoryreport.component.html',
	standalone: true,
	imports: [AppImports]
})
export class SalesByCategoryReportComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	public dtOptions: any;
	public dtTrigger: Subject<any> = new Subject();

	public filters = {
		startDate: '',
		endDate: '',
		allLocations: false,
		validated: false,
		submitted: false,
	};

	public info = {
		start: 0,
		end: 0,
		total: 0,
		startDate: '',
		endDate: '',
		locationName: ''
	};

	constructor(
		private http: HttpClient,
		public app: AppService
	) {
		this.resetFilters();
	}

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
			lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
			pageLength: 50,
			ordering: false,
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
					title: this.app.localize('Category'), data: 'categoryName', orderable: false,
					render: (data: string) => `<strong>${data}</strong>`
				},
				{
					title: this.app.localize('Items'), data: 'itemCount', orderable: false,
					render: (data: number) => `<span class="badge badge-info">${data}</span>`
				},
				{
					title: this.app.localize('Orders'), data: 'orderCount', orderable: false,
					render: (data: number) => `<span class="badge badge-primary">${data}</span>`
				},
				{
					title: this.app.localize('Qty Sold'), data: 'quantitySold', orderable: false,
					render: (data: number) => this.app.formatNumber(data)
				},
				{
					title: this.app.localize('Gross Sales'), data: 'grossSales', orderable: false,
					render: (data: number) => this.app.formatCurrency(data)
				},
				{
					title: this.app.localize('Returns'), data: 'returns', orderable: false,
					render: (data: number) => `<strong class="text-danger">${this.app.formatCurrency(data)}</strong>`
				},
				{
					title: this.app.localize('Net Sales'), data: 'netSales', orderable: false,
					render: (data: number) => `<strong class="text-success">${this.app.formatCurrency(data)}</strong>`
				},
				{
					title: this.app.localize('Cost'), data: 'cost', orderable: false,
					render: (data: number) => this.app.formatCurrency(data)
				},
				{
					title: this.app.localize('Profit'), data: 'grossProfit', orderable: false,
					render: (data: number) => `<strong class="${data >= 0 ? 'text-success' : 'text-danger'}">${this.app.formatCurrency(data)}</strong>`
				},
				{
					title: this.app.localize('Margin %'), data: 'profitMargin', orderable: false,
					render: (data: number) => `<span class="${data >= 0 ? 'text-success' : 'text-danger'}">${this.app.formatNumber(data)}%</span>`
				},
				{
					title: this.app.localize('% of Total'), data: 'percentOfTotalSales', orderable: false,
					render: (data: number) => `<span class="badge bg-secondary-subtle text-secondary">${this.app.formatNumber(data)}%</span>`
				}
			],
			columnDefs: [
				{ targets: '_all', type: 'string' }
			],
			buttons: [
				{
					extend: 'excel',
					title: () => '',
					filename: () => 'SalesByCategoryReport_' + new Date().toISOString().slice(0, 10),
					text: '<i title="excel" class="ri-file-excel-2-line text-success"></i>',
					className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
					exportOptions: { columns: ':not(.notexport)' }
				},
				{
					extend: 'pdfHtml5',
					title: () => '',
					filename: () => 'SalesByCategoryReport_' + new Date().toISOString().slice(0, 10),
					text: '<i title="pdf" class="ri-file-pdf-2-line text-danger"></i>',
					className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
					exportOptions: { columns: ':not(.notexport)' },
					customize: (doc: any) => this.customizePdfExport(doc),
					pageSize: 'A4'
				},
				{
					extend: 'print',
					title: () => '',
					filename: () => 'SalesByCategoryReport_' + new Date().toISOString().slice(0, 10),
					text: '<i title="print" class="ri-printer-line text-info"></i>',
					className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
					exportOptions: { columns: ':not(.notexport)' },
					customize: (win: any) => this.customizePrintExport(win)
				},
				{
					extend: 'csv',
					title: () => '',
					filename: () => 'SalesByCategoryReport_' + new Date().toISOString().slice(0, 10),
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
				this.http.get<any>('/api/reports/getsalesbycategoryreport', { params: query }).subscribe({
					next: response => {
						this.filters.submitted = false;
						this.filters.validated = false;

						this.info = {
							start: params.start + 1,
							end: Math.min(params.start + params.length, response.recordsTotal),
							total: response.recordsTotal,
							startDate: response.startDate || '',
							endDate: response.endDate || '',
							locationName: this.filters.allLocations ? this.app.localize('All Locations') : this.app.getSelectedLocationName()
						};

						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: response.data
						});
					},
					error: error => {
						this.app.handleApiError(error);
						this.filters.submitted = false;
						this.filters.validated = false;
						callback({
							recordsTotal: 0,
							recordsFiltered: 0,
							data: []
						});
					}
				});
			}
		};
	}

	private buildDataTableQuery(params: any): any {
		const locationId = this.app.getSelectedLocationId() || '';
		return {
			locationId: this.hasAccessAllLocations() && this.filters.allLocations ? '0' : locationId,
			start: params.start,
			length: params.length,
			draw: params.draw,
			startDate: this.filters.startDate ? this.app.HTMLDateToAPIDateTime(this.filters.startDate) : '',
			endDate: this.filters.endDate ? this.app.HTMLDateToAPIDateTime(this.filters.endDate) : ''
		};
	}

	private customizePdfExport(doc: any): void {
		const direction = document.documentElement.dir || document.body.dir || 'ltr';
		const align = direction === 'rtl' ? 'right' : 'left';

		doc.pageSize = { width: 14 * 72, height: 8.5 * 72 };
		doc.pageMargins = [15, 30, 15, 30];

		doc.defaultStyle = {
			fontSize: 8,
			alignment: align
		};

		const infoLines = [
			{ text: this.app.localize('Sales by Category Report'), bold: true, fontSize: 12, margin: [0, 0, 0, 4], alignment: 'center' },
			{ text: `${this.info.locationName}`, fontSize: 10, margin: [0, 0, 0, 2], alignment: 'center' },
			{ text: `${this.info.startDate} - ${this.info.endDate}`, fontSize: 10, margin: [0, 0, 0, 2], alignment: 'center' },
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

		const defaultCellMargin = [2, 2, 2, 2];
		doc.content.forEach((contentItem: any) => {
			if (contentItem?.table?.body) {
				const firstRow = contentItem.table.body[0] || [];
				const colCount = Array.isArray(firstRow) ? firstRow.length : 0;
				if (colCount > 0) contentItem.table.widths = new Array(colCount).fill('*');

				contentItem.table.body = contentItem.table.body.map((row: any[]) =>
					row.map(cell => {
						if (cell == null) return { text: '', alignment: align, margin: defaultCellMargin };
						if (typeof cell === 'string' || typeof cell === 'number')
							return { text: String(cell), alignment: align, margin: defaultCellMargin, noWrap: false };
						const newCell = { ...cell };
						newCell.alignment = newCell.alignment || align;
						newCell.margin = newCell.margin || defaultCellMargin;
						newCell.noWrap = false;
						return newCell;
					})
				);

				contentItem.layout = {
					hLineWidth: () => 0.5,
					vLineWidth: () => 0.5,
					hLineColor: () => '#dbeafe',
					vLineColor: () => '#dbeafe',
					paddingLeft: () => 2,
					paddingRight: () => 2,
					paddingTop: () => 2,
					paddingBottom: () => 2
				};
			}
		});

		doc.styles.tableBodyEven = { fontSize: 7 };
		doc.styles.tableBodyOdd = { fontSize: 7 };
		doc.styles.tableHeader = { fontSize: 8, bold: true };

		const recordInfo = this.info || { start: 0, end: 0, total: 0 };
		const footerText = `${this.app.localize('Showing')} ${recordInfo.start} - ${recordInfo.end} (${this.app.localize('of')} ${recordInfo.total})`;

		doc.footer = (currentPage: number, pageCount: number) => {
			const leftColumn = {
				text: `Page ${currentPage} / ${pageCount}`,
				alignment: direction === 'rtl' ? 'right' : 'left',
				margin: [direction === 'rtl' ? 0 : 10, 8, direction === 'rtl' ? 10 : 0, 0]
			};
			const rightColumn = {
				text: footerText,
				alignment: direction === 'rtl' ? 'left' : 'right',
				margin: [direction === 'rtl' ? 10 : 0, 8, direction === 'rtl' ? 0 : 10, 0]
			};

			return {
				columns: direction === 'rtl' ? [rightColumn, leftColumn] : [leftColumn, rightColumn],
				fontSize: 8,
				margin: [0, 0, 0, 0]
			};
		};
	}

	private customizePrintExport(win: any): void {
		const infoHtml = `
			<div class="print-info mb-3" style="text-align:center; margin-bottom:10px; line-height:1.2;">
				<h4 class="text-primary mb-1" style="margin:0">${this.app.localize('Sales by Category Report')}</h4>
				<p style="margin:0">${this.info.locationName}</p>
				<p style="margin:0">${this.info.startDate} - ${this.info.endDate}</p>
			</div>`;

		const table = win.document.querySelector('table');
		if (table) {
			table.insertAdjacentHTML('beforebegin', infoHtml);
		}

		const recordInfo = this.info || { start: 0, end: 0, total: 0 };
		const footerText = `${this.app.localize('Showing')} ${recordInfo.start} - ${recordInfo.end} (${this.app.localize('of')} ${recordInfo.total})`;

		const styleEl = win.document.createElement('style');
		styleEl.type = 'text/css';
		styleEl.appendChild(
			win.document.createTextNode(`
            .print-footer {
                margin-top: 20px;
                padding-top: 8px;
                font-size: 12px;
                text-align: center;
                color: #555;
            }
            @media print {
                .print-footer {
                page-break-before: avoid;
                page-break-after: avoid;
                }
            }
            `)
		);
		win.document.head.appendChild(styleEl);

		// Append footer after the table
		const footerEl = win.document.createElement('div');
		footerEl.className = 'print-footer';
		footerEl.textContent = footerText;

		if (table && table.parentNode) {
			table.parentNode.insertBefore(footerEl, table.nextSibling);
		}
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

	public applyFilters(): void {
		if (!this.filters.startDate || !this.filters.endDate) {
			this.filters.validated = true;
			return;
		}

		this.filters.submitted = true;
		this.reloadDataTable(true);
	}

	public resetFilters(): void {
		this.filters.startDate = this.app.monthStartHTMLDate();
		this.filters.endDate = this.app.currentHTMLDate();
		this.filters.allLocations = false;
		this.filters.validated = false;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	public hasAccessAllLocations(): boolean {
		return this.app.hasAccessAllLocations();
	}
}