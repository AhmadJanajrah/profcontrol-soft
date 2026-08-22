import { Component, Input, ViewChild, OnInit, AfterViewInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { ActivatedRoute } from '@angular/router';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-campaignlogs',
    templateUrl: './campaignlogs.component.html',
	standalone: true,
	imports: [AppImports]
})
export class CampaignLogsComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger: Subject<any> = new Subject();

    // Status options for filters (not shown in UI, kept for future)
    public statusOptions = [
        { value: 'Pending', label: 'Pending' },
        { value: 'Sent', label: 'Sent' },
        { value: 'Failed', label: 'Failed' }
    ];

    public isLoading: boolean = true;
    private campaignId: number = 0;
    public campaign: any = {};

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute,
        public app: AppService
    ) {
        // Localize options
        this.statusOptions.forEach(opt => {
            opt.label = this.app.localize(opt.label);
        });

        const id = Number(this.route.snapshot.paramMap.get('id'));
        if (id > 0) {
            this.campaignId = id;
        }
    }

    ngOnInit(): void {
        if (this.campaignId > 0) {
            this.initDataTable();
        }
    }

    ngAfterViewInit(): void {
        if (this.campaignId > 0) {
            this.dtTrigger.next(null);
        }
    }

    ngOnDestroy(): void {
        this.dtTrigger.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['campaignId'] && changes['campaignId'].currentValue > 0) {
            if (this.dtElement?.dtInstance) {
                this.dtElement.dtInstance.then(dt => {
                    dt.destroy();
                    this.initDataTable();
                    this.dtTrigger.next(null);
                });
            } else {
                this.initDataTable();
                setTimeout(() => this.dtTrigger.next(null), 100);
            }
        }
    }

    // --- DataTable Methods ---
    private initDataTable(): void {
        if (this.campaignId <= 0) return;

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
                { title: this.app.localize('#'), data: 'id', orderSequence: ['desc', 'asc'], width: '50px' },
                { title: this.app.localize('Recipient'), data: 'recipient', orderSequence: ['asc', 'desc'] },
                {
                    title: this.app.localize('Status'),
                    data: 'status',
                    orderSequence: ['asc', 'desc'],
                    render: (data: string) => this.renderStatusBadge(data)
                },
                { title: this.app.localize('Sent At'), data: 'sentAt', orderable: false },
            ],
            columnDefs: [
                { targets: '_all', type: 'string' }
            ],
            layout: { bottomEnd: { paging: { firstLast: false } } },
            ajax: (params: any, callback: any) => {
                const query = this.buildDataTableQuery(params);
                // Route fixed to match controller: GetCampaignLogs
                this.http.get<any>(`/api/campaigns/getcampaignlogs/${this.campaignId}`, { params: query }).subscribe({
                    next: response => {
                        const formattedData = (response.data || []).map((item: any) => ({
                            ...item,
                            sentAt: item.sentAt ? this.app.formatDateTime(item.sentAt) : '—',
                        }));
                        this.campaign = response.campaign || {};
                        this.isLoading = false;
                        callback({
                            recordsTotal: response.recordsTotal,
                            recordsFiltered: response.recordsFiltered,
                            data: formattedData
                        });
                    },
                    error: error => {
                        this.isLoading = false;
                        this.app.handleApiError(error);
                        callback({ recordsTotal: 0, recordsFiltered: 0, data: [] });
                    }
                });
            }
        };
    }

    private reloadDataTable(): void {
        if (this.dtElement?.dtInstance) {
            this.dtElement.dtInstance.then(dt => dt.ajax.reload(undefined, false));
        }
    }

    private buildDataTableQuery(params: any): any {
        return {
            start: params.start,
            length: params.length,
            searchValue: params.search.value,
            sortColumn: params.order[0].column,
            sortDirection: params.order[0].dir,
        };
    }

    // --- Render helpers ---
    public renderStatusBadge(status: string): string {
        const statusClasses: { [key: string]: string } = {
            'Pending': 'badge-warning',
            'Sent': 'badge-success',
            'Failed': 'badge-danger',
            'Cancelled': 'badge-secondary'
        };

        const badgeClass = statusClasses[status] || 'badge-light';
        return `<span class="badge ${badgeClass}">${this.app.localize(status)}</span>`;
    }

    public renderCampaignStatusBadge(status: string): string {
        const statusClasses: { [key: string]: string } = {
            'Draft': 'badge-secondary',
            'Scheduled': 'badge-warning',
            'Running': 'badge-info',
            'Completed': 'badge-success',
            'Failed': 'badge-danger',
            'Cancelled': 'badge-secondary',
            'Paused': 'badge-light'
        };

        const badgeClass = statusClasses[status] || 'badge-light';
        return `<span class="badge ${badgeClass}">${this.app.localize(status)}</span>`;
    }
}