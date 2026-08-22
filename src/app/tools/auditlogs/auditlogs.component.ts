import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { NgForm } from '@angular/forms';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-auditlogs',
    templateUrl: './auditlogs.component.html',
	standalone: true,
	imports: [AppImports]
})
export class AuditLogsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger: Subject<any> = new Subject();

    // Current audit log object
    public auditLog: any = {};

    // Detail modal state
    public detailModal = {
        show: false,
        loading: false,
        title: ''
    };

    public info = {
        start: 0,
        end: 0,
        total: 0,
        startDate: '',
        endDate: ''
    };

    // Filter options for audit logs
    public filters = {
        startDate: null as string | null,
        endDate: null as string | null,
        status: null as string | null,
        validated: false,
        submitted: false,
    };

    // Status options for filter
    public statusOptions: any[] = [
        { value: 'Success', label: 'Success' },
        { value: 'Failed', label: 'Failed' },
        { value: 'Warning', label: 'Warning' },
        { value: 'Info', label: 'Info' }
    ];

    // Modal state for cleanup confirmation
    public cleanupModal = {
        show: false,
        daysToKeep: 90,
        submitted: false,
        validated: false,
    };

    constructor(
        private http: HttpClient,
        private renderer: Renderer2,
        private elementRef: ElementRef,
        public app: AppService
    ) { }

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

    // Initialize DataTable with server-side
    private initDataTable(): void {
        const direction = document.documentElement.dir || document.body.dir || 'ltr';

        this.dtOptions = {
            autoWidth: false,
            processing: true,
            serverSide: true,
            search: { return: true },
            lengthMenu: [[10, 25, 50, 100, 250, 500, 1000], [10, 25, 50, 100, 250, 500, 1000]],
            pageLength: 10,
            order: [[0, 'desc']], // Default sort by ID descending
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
                { title: this.app.localize('#'), data: 'id', orderable: true, orderSequence: ['desc', 'asc'], width: '60px' },
                { title: this.app.localize('User'), data: 'username', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Service'), data: 'service', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Action'), data: 'action', orderSequence: ['asc', 'desc'] },
                {
                    title: this.app.localize('Status'),
                    data: 'status',
                    orderSequence: ['asc', 'desc'],
                    render: (data: string) => this.renderStatusColumn(data)
                },
                { title: this.app.localize('IP Address'), data: 'ipAddress', orderSequence: ['asc', 'desc'] },
                {
                    title: this.app.localize('Created At'),
                    data: 'createdAt',
                    orderSequence: ['desc', 'asc'],
                    render: (data: string) => this.app.formatDateTime(data)
                },
                {
                    title: this.app.localize('Actions'),
                    data: null,
                    orderable: false,
                    className: 'notexport',
                    width: '50px',
                    render: (data: any, type: any, row: any) => this.renderActionsColumn(row)
                }
            ],
            columnDefs: [
                { targets: '_all', type: 'string' },
                { targets: [-1], className: 'dt-center' }
            ],
            buttons: [
                {
                    extend: 'excel',
                    title: () => '',
                    filename: () => 'AuditLogs_' + new Date().toISOString().slice(0, 10),
                    text: '<i title="excel" class="ri-file-excel-2-line text-success"></i>',
                    className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
                    exportOptions: { columns: ':not(.notexport)' }
                },
                {
                    extend: 'pdfHtml5',
                    title: () => '',
                    filename: () => 'AuditLogs_' + new Date().toISOString().slice(0, 10),
                    text: '<i title="pdf" class="ri-file-pdf-2-line text-danger"></i>',
                    className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
                    exportOptions: { columns: ':not(.notexport)' },
                    customize: (doc: any) => this.customizePdfExport(doc)
                },
                {
                    extend: 'print',
                    title: () => '',
                    filename: () => 'AuditLogs_' + new Date().toISOString().slice(0, 10),
                    text: '<i title="print" class="ri-printer-line text-info"></i>',
                    className: 'btn btn-icon btn-light btn-round btn-sm ms-1',
                    exportOptions: { columns: ':not(.notexport)' },
                    customize: (win: any) => this.customizePrintExport(win)
                },
                {
                    extend: 'csv',
                    title: () => '',
                    filename: () => 'AuditLogs_' + new Date().toISOString().slice(0, 10),
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
                this.http.get<any>('/api/tools/getauditlogs', { params: query }).subscribe({
                    next: response => {
                        this.filters.submitted = false;
                        this.filters.validated = false;

                        // Update record info for exports
                        this.info = {
                            start: params.start + 1,
                            end: Math.min(params.start + params.length, response.recordsTotal),
                            total: response.recordsTotal,
                            startDate: this.filters.startDate || '',
                            endDate: this.filters.endDate || ''
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

    // Build query params
    private buildDataTableQuery(params: any): any {
        return {
            start: params.start,
            length: params.length,
            searchValue: params.search.value || '',
            sortColumn: params.order[0]?.column || 0,
            sortDirection: params.order[0]?.dir || 'desc',
            status: this.filters.status || '',
            startDate: this.filters.startDate ? this.app.HTMLDateToAPIDateTime(this.filters.startDate) : '',
            endDate: this.filters.endDate ? this.app.HTMLDateToAPIDateTime(this.filters.endDate) : ''
        };
    }

    // Generate title with date filters
    private getReportTitle(): string {
        const { startDate, endDate } = this.info;
        if (startDate && endDate)
            return `${this.app.localize('Audit Logs')} (${startDate} – ${endDate})`;
        if (startDate)
            return `${this.app.localize('Audit Logs')} (${this.app.localize('From')} ${startDate})`;
        if (endDate)
            return `${this.app.localize('Audit Logs')} (${this.app.localize('Up To')} ${endDate})`;
        return `${this.app.localize('Audit Logs')} (${this.app.localize('Full History')})`;
    }

    // Customize PDF export
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
            { text: this.getReportTitle(), bold: true, fontSize: 12, margin: [0, 0, 0, 4], alignment: 'center' },
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

    // Customize DataTable print export
    private customizePrintExport(win: any): void {
        const infoHtml = `
        <div style="text-align:center; margin-bottom:10px; line-height:1.2;">
            <h5 class="text-primary" style="margin:0">${this.getReportTitle()}</h5>
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

    // Render status column with badges
    private renderStatusColumn(status: string): string {
        const badgeClass = this.getStatusBadgeClass(status);
        return `<span class="badge ${badgeClass}">${status}</span>`;
    }

    // Get status badge CSS class
    public getStatusBadgeClass(status: string): string {
        switch (status?.toLowerCase()) {
            case 'success':
                return 'badge-primary';
            case 'failed':
            case 'error':
                return 'badge-danger';
            case 'warning':
                return 'badge-warning';
            case 'info':
                return 'badge-info';
            default:
                return 'badge-secondary';
        }
    }

    // Render actions column for each row
    private renderActionsColumn(row: any): string {
        return `
        <button class="btn btn-icon btn-light btn-round btn-sm view-details" 
                data-id="${row.id}" 
                title="${this.app.localize('View Details')}">
            <i class="ri-eye-line"></i>
        </button>
        `;
    }

    // Attach view details event listeners to table body
    private addTableEventListeners(): void {
        const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
        if (tableBody) {
            this.renderer.listen(tableBody, 'click', (event: Event) => {
                const target = event.target as Element;
                const detailsButton = target.closest('.view-details');

                if (detailsButton) {
                    const dataId = parseInt(detailsButton.getAttribute('data-id') || '0');
                    if (dataId > 0) {
                        this.openDetailModal(dataId);
                    }
                }
            });
        }
    }

    // --- Filter Methods ---

    // Apply filters and reload data
    public applyFilters(filterForm: NgForm): void {
        if (filterForm.valid) {
            this.filters.submitted = true;
            this.reloadDataTable(true);
        } else {
            this.filters.validated = true;
        }
    }

    // Reset filters to default
    public resetFilters(): void {
        this.filters.startDate = null;
        this.filters.endDate = null;
        this.filters.status = null;
        this.filters.validated = false;
        this.filters.submitted = false;
        this.reloadDataTable(true);
    }

    // --- Detail Modal Methods ---

    public resetDetailModal(){
        this.detailModal.loading = false;
        this.detailModal.title = this.app.localize('Audit Log Details');
        this.detailModal.show = false;
        this.auditLog = {};
    }

    // Open audit log detail modal
    public openDetailModal(id: number): void {
        if (id <= 0) return;

        this.resetDetailModal();
        this.detailModal.loading = true;
        this.detailModal.show = true;

        this.http.get<any>(`/api/tools/getauditlog/${id}`).subscribe({
            next: (response) => {
                const log = response.auditLog;
                this.auditLog = {
                    ...log,
                    createdAtFormatted: this.app.formatDateTime(log.createdAt)
                };
                this.detailModal.loading = false;
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.closeDetailModal();
            }
        });

        history.pushState(null, '', `${window.location.pathname}`);
    }

    // Close audit log detail modal
    public closeDetailModal(): void {
        this.resetDetailModal();
        history.back();
    }

    // Format JSON data for display
    public formatJsonData(jsonString: string): string {
        if (!jsonString) return '';
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return jsonString;
        }
    }

    // --- Cleanup Methods ---

    public resetCleanupModal(){
        this.cleanupModal.show = false;
        this.cleanupModal.validated = false;
        this.cleanupModal.submitted = false;
        this.cleanupModal.daysToKeep = 90;
    }

    // Show cleanup modal
    public showCleanupModal(): void {
        this.resetCleanupModal();
        this.cleanupModal.show = true;
        history.pushState(null, '', window.location.pathname);
    }

    // Close cleanup modal
    public closeCleanupModal(): void {
        this.resetCleanupModal();
        history.back();
    }

    // Perform audit logs cleanup
    public submitCleanup(form: NgForm): void {
        this.cleanupModal.validated = true;
        if (!form.valid) {
            return;
        }
        this.cleanupModal.submitted = true;

        this.http.delete<any>(`/api/tools/cleanupauditlogs`, {
            params: { daysToKeep: this.cleanupModal.daysToKeep.toString() }
        }).subscribe({
            next: (response) => {
                this.app.showSuccessMessage(
                    this.app.localize('Success!'),
                    this.app.localize('Audit logs cleaned up successfully.')
                );
                this.closeCleanupModal();
                this.reloadDataTable();
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.closeCleanupModal();
            }
        });
    }

    // --- Window Event Handlers ---

    // Handle browser back navigation for modals
    private onPopState = (): void => {
        if (this.detailModal.show) {
            this.resetDetailModal();
        } else if (this.cleanupModal.show) {
            this.resetCleanupModal();
        }
    };
}