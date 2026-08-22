import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
    selector: 'app-attendancereport',
    templateUrl: './attendancereport.component.html',
	standalone: true,
	imports: [AppImports]
})
export class AttendanceReportComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    public dtOptions: any;
    public dtTrigger: Subject<any> = new Subject();

    public filters = {
        dateFrom: '',
        dateTo: '',
        shiftId: null as number | null,
        allLocations: false,
        validated: false,
        submitted: false,
    };

    public shifts: any[] = [];

    public info = {
        dateFrom: '',
        dateTo: '',
        locationName: '',
        shiftName: ''
    };

    constructor(
        private http: HttpClient,
        private renderer: Renderer2,
        private elementRef: ElementRef,
        public app: AppService
    ) {
        this.resetFilters();
    }

    ngOnInit(): void {
        this.loadFormData();
        this.initDataTable();
    }

    ngAfterViewInit(): void {
        this.dtTrigger.next(null);
    }

    ngOnDestroy(): void {
        this.dtTrigger.unsubscribe();
    }

    private loadFormData(): void {
        this.http.get<any>('/api/hrm/getreportformdata').subscribe({
            next: response => {
                this.shifts = response.shifts || [];
            },
            error: error => {
                this.app.handleApiError(error);
            }
        });
    }

    private initDataTable(): void {
        const direction = document.documentElement.dir || document.body.dir || 'ltr';

        this.dtOptions = {
            autoWidth: false,
            processing: true,
            serverSide: false,   // load all data on client
            paging: false,       // remove pagination
            ordering: false,     // remove sorting
            searching: false,    // remove search
            info: false,         // remove info text
            language: {
                processing: '',
                loadingRecords: '',
                lengthMenu: `${this.app.localize('Show')} _MENU_ ${this.app.localize('Entries')}`,
                emptyTable: `${this.app.localize('No records found')}`,
                zeroRecords: `${this.app.localize('No matching records found')}`,
                search: '',
                searchPlaceholder: '',
                paginate: {
                    previous: direction === 'rtl' ? '<i class="ri-arrow-right-s-line"></i>' : '<i class="ri-arrow-left-s-line"></i>',
                    next: direction === 'rtl' ? '<i class="ri-arrow-left-s-line"></i>' : '<i class="ri-arrow-right-s-line"></i>',
                    first: '',
                    last: ''
                }
            },
            columns: [
                {
                    title: this.app.localize('Employee'), data: 'employeeName', orderable: false,
                    render: (data: any, type: string, row: any) => {
                        const empCode = `EMP${row.employeeId.toString().padStart(5, '0')}`;
                        return `${empCode} - ${data}`;
                    }
                },
                {
                    title: this.app.localize('Location'), data: 'locationName', orderable: false,
                    visible: this.hasAccessAllLocations()
                },
                {
                    title: this.app.localize('Present'), data: 'present', orderable: false,
                    render: (data: number) => `<span class="badge bg-success">${data}</span>`
                },
                {
                    title: this.app.localize('Absent'), data: 'absent', orderable: false,
                    render: (data: number) => data > 0 ? `<span class="badge bg-danger">${data}</span>` : `<span class="text-muted">${data}</span>`
                },
                {
                    title: this.app.localize('Leave'), data: 'leave', orderable: false,
                    render: (data: number) => data > 0 ? `<span class="badge bg-info">${data}</span>` : `<span class="text-muted">${data}</span>`
                },
                {
                    title: this.app.localize('Late'), data: 'late', orderable: false,
                    render: (data: number) => data > 0 ? `<span class="badge bg-warning">${data}</span>` : `<span class="text-muted">${data}</span>`
                },
                {
                    title: this.app.localize('Half Day'), data: 'halfDay', orderable: false,
                    render: (data: number) => data > 0 ? `<span class="badge bg-secondary">${data}</span>` : `<span class="text-muted">${data}</span>`
                },
                {
                    title: this.app.localize('Total Hours'), data: 'totalHours', orderable: false,
                    render: (data: number) => `<strong>${this.app.formatNumber(data)}</strong>`
                }
            ],
            buttons: [
                {
                    extend: 'excel',
                    title: () => '',
                    filename: () => 'AttendanceReport_' + new Date().toISOString().slice(0, 10),
                    text: '<i title="excel" class="ri-file-excel-2-line text-success"></i>',
                    className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
                    exportOptions: { columns: ':not(.notexport)' }
                },
                {
                    extend: 'pdfHtml5',
                    title: () => '',
                    filename: () => 'AttendanceReport_' + new Date().toISOString().slice(0, 10),
                    text: '<i title="pdf" class="ri-file-pdf-2-line text-danger"></i>',
                    className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
                    exportOptions: { columns: ':not(.notexport)' },
                    customize: (doc: any) => this.customizePdfExport(doc)
                },
                {
                    extend: 'print',
                    title: () => '',
                    filename: () => 'AttendanceReport_' + new Date().toISOString().slice(0, 10),
                    text: '<i title="print" class="ri-printer-line text-info"></i>',
                    className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
                    exportOptions: { columns: ':not(.notexport)' },
                    customize: (win: any) => this.customizePrintExport(win)
                },
                {
                    extend: 'csv',
                    title: () => '',
                    filename: () => 'AttendanceReport_' + new Date().toISOString().slice(0, 10),
                    text: '<i title="csv" class="ri-file-text-line text-warning"></i>',
                    className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
                    exportOptions: { columns: ':not(.notexport)' }
                }
            ],
            layout: {
                top2End: 'buttons'
            },
            ajax: (_params: any, callback: any) => {
                // Load all data from server in one call (ignore pagination params)
                const query = this.buildDataTableQuery(_params || {});
                // remove start/length/draw for server if present
                if ('start' in query) delete query.start;
                if ('length' in query) delete query.length;
                if ('draw' in query) delete query.draw;

                this.http.get<any>('/api/hrm/getattendancereport', { params: query }).subscribe({
                    next: response => {
                        this.filters.submitted = false;
                        this.filters.validated = false;

                        const data = response.data || [];

                        this.info = {
                            dateFrom: this.app.formatDate(response.startDate) || this.app.formatDate(this.filters.dateFrom) || '',
                            dateTo: this.app.formatDate(response.endDate) || this.app.formatDate(this.filters.dateTo) || '',
                            locationName: this.filters.allLocations ? this.app.localize('All Locations') : this.app.getSelectedLocationName(),
                            shiftName: this.shifts.find(s => s.id === this.filters.shiftId)?.shiftName || this.app.localize('All Shifts')
                        };

                        callback({
                            recordsTotal: data.length,
                            recordsFiltered: data.length,
                            data: data
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
        const locationId = this.hasAccessAllLocations() && this.filters.allLocations ? 0 : (this.app.getSelectedLocationId() || 0);
        return {
            locationId: locationId,
            shiftId: this.filters.shiftId || 0,
            dateFrom: this.filters.dateFrom ? this.app.HTMLDateToAPIDateTime(this.filters.dateFrom) : '',
            dateTo: this.filters.dateTo ? this.app.HTMLDateToAPIDateTime(this.filters.dateTo) : '',
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
            { text: this.app.localize('Attendance Report'), bold: true, fontSize: 12, margin: [0, 0, 0, 4], alignment: 'center' },
            { text: `${this.info.locationName}`, fontSize: 10, margin: [0, 0, 0, 2], alignment: 'center' },
            { text: `${this.info.shiftName}`, fontSize: 10, margin: [0, 0, 0, 2], alignment: 'center' },
            { text: `${this.info.dateFrom} - ${this.info.dateTo}`, fontSize: 10, margin: [0, 0, 0, 2], alignment: 'center' },
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
	}

	private customizePrintExport(win: any): void {
		const infoHtml = `
            <div class="print-info mb-3" style="text-align:center; margin-bottom:10px; line-height:1.2;">
                <h4 class="text-primary mb-1" style="margin:0">${this.app.localize('Attendance Report')}</h4>
                <p style="margin:0">${this.info.locationName}</p>
                <p style="margin:0">${this.info.shiftName}</p>
                <p style="margin:0">${this.info.dateFrom} - ${this.info.dateTo}</p>
            </div>`;

		const table = win.document.querySelector('table');
		if (table) {
			table.insertAdjacentHTML('beforebegin', infoHtml);
		}
	}

    private reloadDataTable(): void {
        if (this.dtElement?.dtInstance) {
            this.dtElement.dtInstance.then(dt => {
                // reload will re-run ajax and load all data
                dt.ajax.reload(undefined, false);
            });
        }
    }

    public applyFilters(): void {
        if (!this.filters.dateFrom || !this.filters.dateTo || !this.filters.shiftId) {
            this.filters.validated = true;
            return;
        }

        // Validate date range
        if (this.filters.dateFrom && this.filters.dateTo) {
            const fromDate = new Date(this.filters.dateFrom);
            const toDate = new Date(this.filters.dateTo);
            if (fromDate > toDate) {
                this.app.showWarningMessage(
                    this.app.localize('Invalid Date Range'),
                    this.app.localize('Start date must be before end date.')
                );
                return;
            }
        }

        this.filters.submitted = true;
        this.reloadDataTable();
    }

    public resetFilters(): void {
        const currentDate = this.app.currentHTMLDate();
        const startOfMonth = currentDate.slice(0, 8) + '01';
        
        this.filters.dateFrom = startOfMonth;
        this.filters.dateTo = currentDate;
        this.filters.shiftId = null;
        this.filters.allLocations = this.app.hasAccessAllLocations() ? false : false;
        this.filters.validated = false;
        this.filters.submitted = false;
        this.reloadDataTable();
    }

    public hasAccessAllLocations(): boolean {
        return this.app.hasAccessAllLocations();
    }
}