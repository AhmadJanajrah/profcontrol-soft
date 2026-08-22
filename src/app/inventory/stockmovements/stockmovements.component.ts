import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

// Movement Types enum matching backend
export enum MovementType {
    Sale = 1,
    SaleReturn = 2,
    Purchase = 3,
    PurchaseReturn = 4,
    Adjustment = 5,
    Initial = 6
}

@Component({
    selector: 'app-stockmovements',
    templateUrl: './stockmovements.component.html',
	standalone: true,
	imports: [AppImports]
})
export class StockMovementsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger = new Subject<any>();

    // Movement types
    public movementTypes: any[] = [];

    // Filters
    public filters = {
        movementType: null as MovementType | null,
        dateFrom: null as string | null,
        dateTo: null as string | null,
        validated: false,
        submitted: false
    };

    // Enums for template
    public MovementType = MovementType;

    constructor(
        private http: HttpClient,
        private elementRef: ElementRef,
        public app: AppService
    ) {
        this.initializeEnums();
    }

    // Lifecycle hooks
    ngOnInit(): void {
        this.initDataTable();
    }

    ngAfterViewInit(): void {
        this.dtTrigger.next(null);
    }

    ngOnDestroy(): void {
        this.dtTrigger.unsubscribe();
    }

    // --- Initialization Methods ---

    // Initialize movement type enums with localization
    private initializeEnums(): void {
        this.movementTypes = [
            { value: MovementType.Sale, label: this.app.localize('Sale'), badge: 'primary', icon: 'ri-arrow-down-line' },
            { value: MovementType.SaleReturn, label: this.app.localize('Sale Return'), badge: 'danger', icon: 'ri-arrow-up-line' },
            { value: MovementType.Purchase, label: this.app.localize('Purchase'), badge: 'success', icon: 'ri-arrow-up-line' },
            { value: MovementType.PurchaseReturn, label: this.app.localize('Purchase Return'), badge: 'danger', icon: 'ri-arrow-down-line' },
            { value: MovementType.Adjustment, label: this.app.localize('Adjustment'), badge: 'warning', icon: 'ri-edit-line' },
            { value: MovementType.Initial, label: this.app.localize('Initial Stock'), badge: 'info', icon: 'ri-add-line' }
        ];
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
                { title: this.app.localize('Date'), data: 'createdAt', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Item'), data: 'item.itemName', orderSequence: ['asc', 'desc'] },
                {
                    title: this.app.localize('Movement Type'),
                    data: 'movementType',
                    orderSequence: ['asc', 'desc'],
                    render: (data: any) => this.renderMovementTypeColumn(data)
                },
                {
                    title: this.app.localize('Quantity'),
                    data: 'quantity',
                    orderSequence: ['asc', 'desc'],
                    render: (data: any, type: any, row: any) => this.renderQuantityColumn(data, row)
                },
                { 
                    title: this.app.localize('Unit Cost'), 
                    data: 'unitCost', 
                    orderable: false,
                    render: (data: any) => this.app.formatCurrency(data || 0)
                },
                { 
                    title: this.app.localize('Total Cost'), 
                    data: 'totalCost', 
                    orderable: false,
                    render: (data: any) => this.app.formatCurrency(data || 0)
                },
                { 
                    title: this.app.localize('Stock Before'), 
                    data: 'stockBefore', 
                    orderable: false,
                    render: (data: any) => this.app.formatNumber(data || 0)
                },
                { 
                    title: this.app.localize('Stock After'), 
                    data: 'stockAfter', 
                    orderable: false,
                    render: (data: any) => this.app.formatNumber(data || 0)
                },
                { title: this.app.localize('Reference'), data: 'reference', orderable: false },
                { 
					title: this.app.localize('Location'), 
					data: 'location.locationName', 
					orderable: false,
					render: (data: any) => data ? `<span class="badge badge-light"><i class="ri-store-line"></i> ${data}</span>` : '—'
				}
            ],
            columnDefs: [
                { targets: '_all', type: 'string' }
            ],
            layout: { bottomEnd: { paging: { firstLast: false } } },
            ajax: (params: any, callback: any) => {
                const query = this.buildDataTableQuery(params);
                this.http.get<any>('/api/inventory/getstockmovements', { params: query as any }).subscribe({
                    next: response => {
                        const formattedData = (response.data || []).map((item: any) => ({
                            ...item,
                            createdAt: this.app.formatDateTime(item.createdAt)
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

    // Build query params for DataTable server-side
    private buildDataTableQuery(params: any): any {
        const locationId = this.app.getSelectedLocationId() || 0;
		return {
			locationId: locationId,
            start: params.start,
            length: params.length,
            searchValue: params.search.value,
            sortColumn: params.order[0]?.column ?? 0,
            sortDirection: params.order[0]?.dir ?? 'desc',
            movementType: this.filters.movementType || '',
            dateFrom: this.filters.dateFrom || '',
            dateTo: this.filters.dateTo || ''
        };
    }

    // Render movement type column with badge and icon
    private renderMovementTypeColumn(movementType: number): string {
        const type = this.movementTypes.find(t => t.value === movementType);
        if (type) {
            return `<span class="badge badge-${type.badge}"><i class="${type.icon}"></i> ${type.label}</span>`;
        }
        return '';
    }

    // Render quantity column with color coding
    private renderQuantityColumn(quantity: number, row: any): string {
        const colorClass = quantity > 0 ? 'text-success' : 'text-danger';
        const icon = quantity > 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
        const unit = row.item?.unitOfMeasure || '';
        
        return `<span class="${colorClass}">
            <i class="${icon}"></i> ${this.app.formatNumber(Math.abs(quantity))} ${unit}
        </span>`;
    }

    // --- Filter Methods ---

    // Apply filters
    public applyFilters(filterForm: NgForm): void {
        if (filterForm.valid) {
            this.filters.submitted = true;
            this.reloadDataTable(true);
        } else {
            this.filters.validated = true;
        }
    }

    // Reset filters
    public resetFilters(): void {
        this.filters.movementType = null;
        this.filters.dateFrom = null;
        this.filters.dateTo = null;
        this.filters.validated = false;
        this.filters.submitted = false;
        this.reloadDataTable(true);
    }

    // Check if user has access to all locations
    public hasAccessAllLocations(): boolean{
		return this.app.hasAccessAllLocations();
	}
}