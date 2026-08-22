import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { NgForm } from '@angular/forms';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-activitylogs',
	templateUrl: './activitylogs.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ActivityLogsComponent implements OnInit, AfterViewInit, OnDestroy {
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

	// Filter options
    public filters = {
        startDate: null as string | null,
        endDate: null as string | null,
        status: null as string | null,
        validated: false,
        submitted: false,
    };

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService
	) {
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
			lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
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
				{ title: this.app.localize('Service'), data: 'service', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Action'), data: 'action', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Description'), data: 'description', orderable: false },
				{ title: this.app.localize('Date'), data: 'createdAt', orderSequence: ['asc', 'desc'] },
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
				this.http.get<any>('/api/profile/getactivities', { params: query }).subscribe({
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
						this.filters.submitted = false;
                        this.filters.validated = false;
						this.app.handleApiError(error);
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
            start: params.start,
            length: params.length,
            searchValue: params.search.value || '',
            sortColumn: params.order[0]?.column || 0,
            sortDirection: params.order[0]?.dir || 'desc',
            startDate: this.filters.startDate ? this.app.HTMLDateToAPIDateTime(this.filters.startDate) : '',
            endDate: this.filters.endDate ? this.app.HTMLDateToAPIDateTime(this.filters.endDate) : ''
        };
	}

	// Format activity row for DataTable
	private formatActivityRow(data: any): any {
		return {
			...data,
			service: data.service || '&mdash;',
			description: data.description.length > 100 ? data.description.substring(0, 100) + '...' : data.description,
			createdAt: this.app.formatDateTime(data.createdAt)
		};
	}

	// Render action dropdown for each row
	private renderActionColumn(row: any): string {
		return `
		<button class="btn btn-icon btn-light btn-round btn-sm view-button" data-id="${row.id}">
			<i class="ri-eye-line"></i>
		</button>`;
	}

	// Attach event listeners for table actions
	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (tableBody) {
			this.renderer.listen(tableBody, 'click', (event: Event) => {
				const target = event.target as Element;
				const viewButton = target.closest('.view-button');

				if (viewButton) {
					const activityId = parseInt(viewButton.getAttribute('data-id') || '0');
					if (activityId > 0) {
						this.openDetailModal(activityId);
					}
				}
			});
		}
	}

	// --- Detail modal methods ---

	public resetDetailModal(){
		this.detailModal.show = false;
		this.detailModal.loading = false;
		this.detailModal.title = this.app.localize('Activity Details');
		this.activity = {};
	}

	public openDetailModal(id: number): void {
		if (id <= 0) return;
		this.resetDetailModal();
		this.detailModal.show = true;
		this.detailModal.loading = true;

		this.http.get<any>(`/api/profile/getactivity/${id}`).subscribe({
			next: res => {
				const a = res.activity;
				this.activity = {
					...a,
					createdAtFormatted: this.app.formatDateTime(a.createdAt)
				};
				this.detailModal.loading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.closeDetailModal();
			}
		});

		history.pushState(null, '', `${window.location.pathname}`);
	}

	public closeDetailModal(): void {
		this.resetDetailModal();
		history.back();
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

	// Handle browser back navigation for detail modal
	private onPopState = (): void => {
		if (this.detailModal.show) this.resetDetailModal();
	};
}