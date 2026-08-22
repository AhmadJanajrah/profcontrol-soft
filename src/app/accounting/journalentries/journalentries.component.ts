import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { NgForm } from '@angular/forms';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-journalentries',
    templateUrl: './journalentries.component.html',
	standalone: true,
	imports: [AppImports]
})
export class JournalEntriesComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger = new Subject<any>();

    // Current journal entry object
    public journalEntry: any = {};

    // Detail modal state
    public detailModal = {
        show: false,
        loading: false,
        title: ''
    };

    // Filter options for journal entries
    public filters = {
        dateFrom: null as string | null,
        dateTo: null as string | null,
        validated: false,
        submitted: false,
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
                { title: this.app.localize('Entry Date'), data: 'entryDate', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Reference'), data: 'referenceNumber', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Description'), data: 'description', orderable: false },
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
            layout: { bottomEnd: { paging: { firstLast: false } } },
            ajax: (params: any, callback: any) => {
                const query = this.buildDataTableQuery(params);
                this.http.get<any>('/api/accounting/getjournalentries', { params: query as any }).subscribe({
                    next: response => {
                        const formattedData = (response.data || []).map((item: any) => ({
                            ...item,
                            entryDate: this.app.formatDate(item.entryDate),
                            locationName: item.location?.locationName || '',
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

    // Build query params for DataTable server-side matching controller expectations
    private buildDataTableQuery(params: any): any {
        return {
            locationId: this.app.getSelectedLocationId() || 0,
            start: params.start.toString(),
            length: params.length.toString(),
            searchValue: params.search.value || '',
            sortColumn: params.order[0].column.toString(),
            sortDirection: params.order[0].dir || 'desc',
            dateFrom: this.filters.dateFrom ? this.app.HTMLDateToAPIDateTime(this.filters.dateFrom) : '',
            dateTo: this.filters.dateTo ? this.app.HTMLDateToAPIDateTime(this.filters.dateTo) : '',
        };
    }

    // Render status column
    private renderStatusBadge(status: number): string {
        // JournalStatus: Draft=1, Posted=2, Void=3
        if (status === 2) return `<span class="badge badge-primary">${this.app.localize('Posted')}</span>`;
        if (status === 3) return `<span class="badge badge-danger">${this.app.localize('Void')}</span>`;
        return `<span class="badge badge-light">${this.app.localize('Draft')}</span>`;
    }

    // Render action column with view details button
    private renderActionColumn(row: any): string {
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
        this.filters.dateFrom = null;
        this.filters.dateTo = null;
        this.filters.validated = false;
        this.filters.submitted = false;
        this.reloadDataTable(true);
    }

    // --- Detail Modal Methods ---

    public resetDetailModal() {
        this.detailModal.loading = false;
        this.detailModal.title = this.app.localize('Journal Entry Details');
        this.detailModal.show = false;
        this.journalEntry = {};
    }

    // Open journal entry detail modal
    public openDetailModal(id: number): void {
        if (id <= 0) return;

        this.resetDetailModal();
        this.detailModal.loading = true;
        this.detailModal.show = true;

        const locationId = this.app.getSelectedLocationId() || 0;
        this.http.get<any>(`/api/accounting/getjournalentry/${id}`, { params: { locationId } }).subscribe({
            next: (response) => {
                const entry = response.journalEntry;
                this.journalEntry = {
                    ...entry,
                    entryDateFormatted: this.app.formatDate(entry.entryDate),
                    createdAtFormatted: this.app.formatDateTime(entry.createdAt),
                    updatedAtFormatted: this.app.formatDateTime(entry.updatedAt),
                    totalDebitFormatted: this.app.formatCurrency(entry.totalDebit || 0),
                    totalCreditFormatted: this.app.formatCurrency(entry.totalCredit || 0),
                    amountFormatted: this.app.formatCurrency(entry.amount || 0),
                    statusText: this.getStatusText(entry.status)
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

    // Close journal entry detail modal
    public closeDetailModal(): void {
        this.resetDetailModal();
        history.back();
    }

    // Handle browser back navigation for detail modal
    private onPopState = (): void => {
        if (this.detailModal.show) {
            this.resetDetailModal();
        }
    };

    // --- Utility Methods ---

    // Get status text for display
    private getStatusText(status: number): string {
        if (status === 2) return this.app.localize('Posted');
        if (status === 3) return this.app.localize('Void');
        return this.app.localize('Draft');
    }

    // Get status badge for modal
    public getStatusBadge(status: number): string {
        return this.renderStatusBadge(status);
    }

    // Calculate debit total for journal entry lines
    public getDebitTotal(entry: any): number {
        return entry?.journalEntryLines?.reduce((sum: number, line: any) => sum + (line.debitAmount || 0), 0) || 0;
    }

    // Calculate credit total for journal entry lines
    public getCreditTotal(entry: any): number {
        return entry?.journalEntryLines?.reduce((sum: number, line: any) => sum + (line.creditAmount || 0), 0) || 0;
    }
}