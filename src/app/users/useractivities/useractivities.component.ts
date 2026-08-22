import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { NgForm } from '@angular/forms';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-useractivities',
    templateUrl: './useractivities.component.html',
	standalone: true,
	imports: [AppImports]
})
export class UserActivitiesComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger = new Subject<any>();

    // Current activity object
    public activity: any = {};

    // Detail modal state
    public detailModal = {
        show: false,
        loading: false,
        title: ''
    };

        // Modal state for cleanup confirmation
    public cleanupModal = {
        show: false,
        daysToKeep: 90,
        submitted: false,
        validated: false,
    };

    // Filter options for activities
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
            lengthMenu: [[10, 25, 50, 100, 250, 1000], [10, 25, 50, 100, 250, 1000]],
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
                    title: this.app.localize('User'), 
                    data: 'fullName', 
                    orderSequence: ['asc', 'desc'], 
                    render: (_: any, __: any, row: any) => this.renderUserColumn(row) 
                },
                { title: this.app.localize('Service'), data: 'service', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Action'), data: 'action', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Description'), data: 'description', orderable: false },
                { title: this.app.localize('IP Address'), data: 'ipAddress', orderable: false, width: '120px' },
                { title: this.app.localize('Date & Time'), data: 'createdAt', orderSequence: ['desc', 'asc'], width: '160px' },
                {
                    title: this.app.localize('Actions'),
                    data: null,
                    orderable: false,
                    width: '60px',
                    render: (_: any, __: any, row: any) => this.renderActionColumn(row)
                }
            ],
            columnDefs: [
                { targets: '_all', type: 'string' },
                { targets: [-1], className: 'dt-center' },
                { targets: [0], className: 'dt-center' },
            ],
            layout: { bottomEnd: { paging: { firstLast: false } } },
            ajax: (params: any, callback: any) => {
                const query = this.buildDataTableQuery(params);
                this.http.get<any>('/api/users/getuseractivities', { params: query }).subscribe({
                    next: response => {
                        const formattedData = response.data.map((item: any) => this.formatActivityRow(item));
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
            start: params.start.toString(),
            length: params.length.toString(),
            searchValue: params.search.value || '',
            sortColumn: params.order[0].column.toString(),
            sortDirection: params.order[0].dir || 'desc',
            dateFrom: this.filters.dateFrom ? this.app.HTMLDateToAPIDateTime(this.filters.dateFrom) : '',
            dateTo: this.filters.dateTo ? this.app.HTMLDateToAPIDateTime(this.filters.dateTo) : '',
        };
    }

    // Format activity row for DataTable
    private formatActivityRow(data: any): any {
        return {
            ...data,
            service: data.service || '&mdash;',
            action: data.action || '&mdash;',
            description: data.description && data.description.length > 80 
                ? data.description.substring(0, 80) + '...' 
                : (data.description || '&mdash;'),
            ipAddress: data.ipAddress || '&mdash;',
            createdAt: this.app.formatDateTime(data.createdAt)
        };
    }

    // Render user column with name and username
    private renderUserColumn(row: any): string {
        return `
        <div class="table-img-text">
            <i class="ri-user-line fs-5 bg-primary-light rounded-circle"></i>
            <div class="text-block">
				<span class="no-wrap">${row.fullName}</span>
				<small class="text-muted">@${this.app.localize(row.userName)}</small>
			</div>
        </div>
        `;
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
        this.detailModal.title = this.app.localize('Activity Details');
        this.detailModal.show = false;
        this.activity = {};
    }

    // Open activity detail modal
    public openDetailModal(id: number): void {
        if (id <= 0) return;

        this.detailModal.loading = true;
        this.detailModal.show = true;

        this.http.get<any>(`/api/users/getuseractivity/${id}`).subscribe({
            next: (response) => {
                const activity = response.activity;
                this.activity = {
                    ...activity,
                    createdAtFormatted: this.app.formatDateTime(activity.createdAt)
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

    // Close activity detail modal
    public closeDetailModal(): void {
        this.resetDetailModal();
        history.back();
    }

    // --- Cleanup Methods ---

    public resetCleanupModal() {
        this.cleanupModal.show = false;
        this.cleanupModal.validated = false;
        this.cleanupModal.submitted = false;
        this.cleanupModal.daysToKeep = 90;
    }

    // Show cleanup modal
    public showCleanupModal(): void {
        this.cleanupModal.show = true;
        history.pushState(null, '', window.location.pathname);
    }

    // Close cleanup modal
    public closeCleanupModal(): void {
        this.resetCleanupModal();
        history.back();
    }

    // Perform User activities cleanup
    public submitCleanup(form: NgForm): void {
        this.cleanupModal.validated = true;
        if (!form.valid) {
            return;
        }
        this.cleanupModal.submitted = true;

        this.http.delete<any>(`/api/users/cleanupuseractivities`, {
            params: { daysToKeep: this.cleanupModal.daysToKeep.toString() }
        }).subscribe({
            next: (response) => {
                this.app.showSuccessMessage(
                    this.app.localize('Success!'),
                    this.app.localize('User activities cleaned up successfully.')
                );
                this.closeCleanupModal();
                this.reloadDataTable();
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.resetCleanupModal();
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