import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-feedbacks',
    templateUrl: './feedbacks.component.html',
	standalone: true,
	imports: [AppImports]
})
export class FeedbacksComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger: Subject<any> = new Subject();

    // Filters
    public filters = {
        dateFrom: null as string | null,
        dateTo: null as string | null,
        submitted: false,
        validated: false,
    };

    // review modal state
    public reviewModal = {
        show: false,
        loading: false,
        submitted: false,
        validated: false,
        feedbackId: 0,
        customerName: '',
        resolutionNotes: ''
    };

    // detail modal state (view feedback)
    public detailModal = {
        show: false,
        loading: false,
        title: ''
    };

    // current selected feedback for detail modal
    public feedback: any = {};

    constructor(
        private http: HttpClient,
        private renderer: Renderer2,
        private elementRef: ElementRef,
        public app: AppService
    ) { }

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
                { title: this.app.localize('#'), data: 'id', orderSequence: ['desc', 'asc'], width: '50px' },
                { title: this.app.localize('Customer'), data: 'customerName', orderSequence: ['asc', 'desc'] },
                {
                    title: this.app.localize('Rating'),
                    data: 'rating',
                    orderSequence: ['asc', 'desc'],
                    render: (data: number) => this.renderRatingColumn(data)
                },
                { title: this.app.localize('Type'), data: 'feedbackType', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Date'), data: 'submittedAt', orderable: false },
                {
                    title: this.app.localize('Status'),
                    data: 'isReviewed',
                    orderable: false,
                    render: (data: boolean) => this.renderStatusBadge(data)
                },
                {
                    title: this.app.localize('Action'),
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
                this.http.get<any>('/api/customers/getcustomerfeedbacks', { params: query }).subscribe({
                    next: response => {
                        const formattedData = (response.data || []).map((item: any) => ({
                            ...item,
                            customerName: item.customer?.fullName || this.app.localize('Anonymous'),
                            submittedAt: this.app.formatDateTime(item.submittedAt),
                            feedbackType: item.feedbackType || '—',
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

    private buildDataTableQuery(params: any): any {
        return {
            start: params.start,
            length: params.length,
            searchValue: params.search.value,
            sortColumn: params.order[0].column,
            sortDirection: params.order[0].dir,
            dateFrom: this.filters.dateFrom ? this.app.HTMLDateToAPIDateTime(this.filters.dateFrom) : '',
            dateTo: this.filters.dateTo ? this.app.HTMLDateToAPIDateTime(this.filters.dateTo) : ''
        };
    }

    // --- Render helpers ---
    public renderRatingColumn(rating: number): string {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `<i class="ri-star-${i <= rating ? 'fill' : 'line'} ${i <= rating ? 'text-warning' : 'text-muted'}"></i>`;
        }
        return `<div class="rating-stars">${stars} <span class="ms-1">${rating}/5</span></div>`;
    }

    public renderStatusBadge(isReviewed: boolean): string {
        return isReviewed
            ? `<span class="badge badge-primary">${this.app.localize('Reviewed')}</span>`
            : `<span class="badge badge-warning">${this.app.localize('Pending')}</span>`;
    }

    private renderActionColumn(row: any): string {
        let actions = `
        <button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="ri-more-fill"></i>
        </button>
        <div class="dropdown-menu dropdown-menu-end">
            <a class="dropdown-item view-feedback" data-id="${row.id}" href="javascript:void(0);">
                <i class="ri-eye-line"></i>${this.app.localize('View')}
            </a>
        `;

        if (!row.isReviewed) {
            actions += `
            <a class="dropdown-item review-feedback" data-id="${row.id}" data-customer="${row.customerName}" href="javascript:void(0);">
                <i class="ri-check-line"></i>${this.app.localize('Review')}
            </a>
            `;
        }

        actions += '</div>';
        return actions;
    }

    // Attach event listeners for table actions
    private addTableEventListeners(): void {
        const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
        if (tableBody) {
            this.renderer.listen(tableBody, 'click', (event: Event) => {
                const target = event.target as Element;
                const viewButton = target.closest('.view-feedback');
                const reviewButton = target.closest('.review-feedback');

                if (viewButton) {
                    const feedbackId = parseInt(viewButton.getAttribute('data-id') || '0');
                    if (feedbackId > 0) {
                        this.openDetailModal(feedbackId);
                    }
                }

                if (reviewButton) {
                    const feedbackId = parseInt(reviewButton.getAttribute('data-id') || '0');
                    const customerName = reviewButton.getAttribute('data-customer') || '';
                    this.openReviewModal(feedbackId, customerName);
                }
            });
        }
    }

    // --- Filter Methods ---
    public applyFilters(filterForm: NgForm): void {
        if (filterForm.valid) {
            this.filters.submitted = true;
            this.reloadDataTable(true);
        } else {
            this.filters.validated = true;
        }
    }

    public resetFilters(): void {
        this.filters = {
            dateFrom: null,
            dateTo: null,
            submitted: false,
            validated: false
        };
        this.reloadDataTable(true);
    }

    // --- Review Modal ---
    public resetReviewModal(){
        this.reviewModal = {
            show: false,
            loading: false,
            submitted: false,
            validated: false,
            feedbackId: 0,
            customerName: '',
            resolutionNotes: ''
        };
    }

    public openReviewModal(feedbackId: number, customerName: string): void {
        this.reviewModal = {
            show: true,
            loading: false,
            submitted: false,
            validated: false,
            feedbackId: feedbackId,
            customerName: customerName,
            resolutionNotes: ''
        };
        history.pushState(null, '', window.location.pathname);
    }

    public closeReviewModal(): void {
        this.resetReviewModal();
        history.back();
    }

    public submitReview(form: NgForm): void {
        if (!form.valid) {
            this.reviewModal.validated = true;
            return;
        }

        this.reviewModal.submitted = true;
        const reviewData = {
            resolutionNotes: this.reviewModal.resolutionNotes
        };

        this.http.put<any>(`/api/customers/reviewfeedback/${this.reviewModal.feedbackId}`, reviewData).subscribe({
            next: () => {
                this.app.showSuccessMessage(
                    this.app.localize('Success!'),
                    this.app.localize('Feedback reviewed successfully.')
                );
                this.closeReviewModal();
                this.reloadDataTable();
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.resetReviewModal();
            }
        });
    }

    // --- Detail Modal (view feedback) ---
    public resetDetailModal() {
        this.detailModal.loading = false;
        this.detailModal.title = this.app.localize('Feedback Details');
        this.detailModal.show = false;
        this.feedback = {};
    }

    public openDetailModal(id: number): void {
        if (id <= 0) return;

        this.resetDetailModal();
        this.detailModal.loading = true;
        this.detailModal.show = true;

        this.http.get<any>(`/api/customers/getfeedback/${id}`).subscribe({
            next: (response) => {
                const fb = response?.feedback || response?.data || response;
                this.feedback = {
                    ...fb,
                    customerName: fb?.customer?.fullName || this.app.localize('Anonymous'),
                    submittedAtFormatted: this.app.formatDateTime(fb?.submittedAt),
                    reviewedAtFormatted: fb?.reviewedAt ? this.app.formatDateTime(fb.reviewedAt) : null
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

    public closeDetailModal(): void {
        this.resetDetailModal();
        history.back();
    }

    // Format JSON safe display (if needed)
    public formatJsonData(jsonString: string): string {
        if (!jsonString) return '';
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return jsonString;
        }
    }

    // --- Window Event Handlers ---
    private onPopState = (): void => {
        if (this.detailModal.show) {
            this.resetDetailModal();
        } else if (this.reviewModal.show) {
            this.resetReviewModal();
        }
    };
}