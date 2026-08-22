import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-stocks',
    templateUrl: './stocks.component.html',
	standalone: true,
	imports: [AppImports]
})
export class StocksComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger = new Subject<any>();

    // Current stock object
    public stock: any = {};

    // Form data
    public items: any[] = [];

    // Filters
    public filters = {
        lowStockOnly: false,
        validated: false,
        submitted: false
    };

    // Modal state management
    public mainModal = {
        isUpdate: false,
        show: false,
        title: '',
        loading: false,
        submitted: false,
        validated: false,
        btnSaveText: '',
        btnCancelText: ''
    };

    constructor(
        private http: HttpClient,
        private renderer: Renderer2,
        private elementRef: ElementRef,
        public app: AppService
    ) {
        this.resetMainModal();
    }

    // Lifecycle hooks
    ngOnInit(): void {
        this.initDataTable();
        this.loadFormData();
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
            order: [[1, 'asc']],
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
                { title: this.app.localize('Item'), data: 'item.itemName', orderSequence: ['asc', 'desc'] },
                { 
                    title: this.app.localize('Current Stock'), 
                    data: 'currentStock', 
                    orderSequence: ['asc', 'desc'],
                    render: (data: any, type: any, row: any) => this.renderStockColumn(data, row)
                },
                { 
                    title: this.app.localize('Min Level'), 
                    data: 'minLevel', 
                    orderable: false,
                    render: (data: any) => this.app.formatNumber(data || 0)
                },
                { 
                    title: this.app.localize('Max Level'), 
                    data: 'maxLevel', 
                    orderable: false,
                    render: (data: any) => data ? this.app.formatNumber(data) : '—'
                },
                { 
                    title: this.app.localize('Avg. Cost'), 
                    data: 'averageCost', 
                    orderable: false,
                    render: (data: any) => this.app.formatCurrency(data || 0)
                },
                { 
                    title: this.app.localize('Stock Value'), 
                    data: 'stockValue', 
                    orderable: false,
                    render: (data: any) => this.app.formatCurrency(data || 0)
                },
                { 
					title: this.app.localize('Location'), 
					data: 'location.locationName', 
					orderable: false,
					render: (data: any) => data ? `<span class="badge badge-light"><i class="ri-store-line"></i> ${data}</span>` : '—'
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
                this.http.get<any>('/api/inventory/getstocks', { params: query as any }).subscribe({
                    next: response => {
                        this.filters.submitted = false;
                        this.filters.validated = false;
                        callback({
                            recordsTotal: response.recordsTotal,
                            recordsFiltered: response.recordsFiltered,
                            data: response.data || []
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
            sortColumn: params.order[0]?.column ?? 1,
            sortDirection: params.order[0]?.dir ?? 'asc',
            lowStockOnly: this.filters.lowStockOnly
        };
    }

    // Render stock column with low stock indicator
    private renderStockColumn(currentStock: number, row: any): string {
        const isLowStock = row.isLowStock;
        const stockClass = isLowStock ? 'text-danger fw-bold' : '';
        const stockIcon = isLowStock ? '<i class="ri-error-warning-line text-danger me-1"></i>' : '';
        const unit = row.item?.unitOfMeasure || '';
        
        return `${stockIcon}<span class="${stockClass}">${this.app.formatNumber(currentStock)} ${unit}</span>`;
    }

    // Render action dropdown for each row
    private renderActionColumn(row: any): string {
        return `
        <button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="ri-more-fill"></i>
        </button>
        <div class="dropdown-menu dropdown-menu-end">
        <a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
                <i class="ri-edit-2-line"></i>${this.app.localize('Edit Settings')}
            </a>
            <a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.item?.itemName || ''}" href="javascript:void(0);">
                <i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
            </a>
        </div>`;
    }

    // Attach event listeners for table actions
    private addTableEventListeners(): void {
        const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
        if (tableBody) {
            this.renderer.listen(tableBody, 'click', (event: Event) => {
                const target = event.target as Element;
                const editButton = target.closest('.edit-button');
                const deleteButton = target.closest('.delete-button');

                if (editButton) {
                    const id = parseInt(editButton.getAttribute('data-id') || '0');
                    this.openMainModal(id);
                }

                if (deleteButton) {
                    const id = parseInt(deleteButton.getAttribute('data-id') || '0');
                    const name = deleteButton.getAttribute('data-name') || '';
                    this.confirmDelete(id, name);
                }
            });
        }
    }

    // --- Filter Methods ---

    // Apply filters
    public applyFilters(): void {
        this.filters.submitted = true;
        this.reloadDataTable(true);
    }

    // Check if user has access to all locations
    public hasAccessAllLocations(): boolean{
		return this.app.hasAccessAllLocations();
	}

    // --- Form Data Methods ---

    // Load form data (items)
    private loadFormData(): void {
        this.http.get<any>('/api/inventory/getstockformdata').subscribe({
            next: response => {
                this.items = response.items || [];
            },
            error: error => {
                this.app.handleApiError(error);
            }
        });
    }

    // --- Modal Management Methods ---

    // Reset modal state and form data
    private resetMainModal(): void {
        this.stock = {
            id: 0,
            locationId: this.app.getSelectedLocationId(),
            itemId: null,
            initialQuantity: '',
            unitCost: '',
            minLevel: '',
            maxLevel: ''
        };
        this.mainModal = {
            isUpdate: false,
            show: false,
            title: '',
            loading: false,
            submitted: false,
            validated: false,
            btnSaveText: this.app.localize('Save'),
            btnCancelText: this.app.localize('Cancel')
        };
    }

    // Open stock modal for add/edit
    public openMainModal(id: number): void {
        if (id > 0) {
            this.resetMainModal();
            this.mainModal.loading = true;
            this.mainModal.title = this.app.localize('Edit Stock Settings');
            this.mainModal.btnSaveText = this.app.localize('Update');
            this.mainModal.show = true;
            this.mainModal.isUpdate = true;

            this.http.get<any>(`/api/inventory/getstock/${id}`).subscribe({
                next: data => {
                    const stockData = data.stock;
                    this.stock = {
                        id: stockData.id,
                        locationId: stockData.locationId,
                        itemId: stockData.itemId,
                        minLevel: this.app.apiNumberToLocale(stockData.minLevel || 0),
                        maxLevel: stockData.maxLevel ? this.app.apiNumberToLocale(stockData.maxLevel) : '',
                        initialQuantity: this.app.apiNumberToLocale(stockData.currentStock || 0),
                        unitCost: this.app.apiNumberToLocale(stockData.averageCost || 0),
                        item: stockData.item
                    };
                    this.mainModal.loading = false;
                },
                error: error => {
                    this.app.handleApiError(error);
                    this.resetMainModal();
                }
            });
        } else {
            this.resetMainModal();
            this.mainModal.title = this.app.localize('Add Initial Stock');
            this.mainModal.show = true;
        }
        history.pushState(null, '', `${window.location.pathname}`);
    }

    // Close stock modal
    public closeMainModal(): void {
        this.resetMainModal();
        history.back();
    }

    // --- Form Submission Methods ---

    // Submit stock form
    public submitForm(form: NgForm): void {
        if (!form.valid) {
            this.mainModal.validated = true;
            return;
        }

        this.mainModal.submitted = true;
        const isUpdate = this.stock.id > 0 && this.mainModal.isUpdate;
        const url = isUpdate
            ? `/api/inventory/updatestock/${this.stock.id}`
            : '/api/inventory/createstock';

        const payload = this.prepareStockData();

        const request$ = isUpdate
            ? this.http.put<any>(url, payload)
            : this.http.post<any>(url, payload);

        request$.subscribe({
            next: () => {
                const msg = isUpdate
                    ? this.app.localize('Stock settings updated successfully.')
                    : this.app.localize('Stock record created successfully.');
                this.app.showSuccessMessage(this.app.localize('Success!'), msg);
                this.closeMainModal();
                this.reloadDataTable();
            },
            error: err => {
                this.app.handleApiError(err);
                this.mainModal.submitted = false;
            }
        });
    }

    // Prepare stock data for submission
    private prepareStockData(): any {
        if (this.mainModal.isUpdate) {
            return {
                id: this.stock.id,
                minimumStockLevel: this.app.localeToAPINumber(this.stock.minLevel),
                maximumStockLevel: this.stock.maxLevel ? this.app.localeToAPINumber(this.stock.maxLevel) : null
            };
        } else {
            return {
                locationId: this.stock.locationId,
                itemId: this.stock.itemId,
                initialQuantity: this.app.localeToAPINumber(this.stock.initialQuantity),
                unitCost: this.app.localeToAPINumber(this.stock.unitCost),
                minLevel: this.app.localeToAPINumber(this.stock.minLevel),
                maxLevel: this.stock.maxLevel ? this.app.localeToAPINumber(this.stock.maxLevel) : null
            };
        }
    }

    // --- Action Methods ---

    // Show confirmation dialog before deleting stock
    private confirmDelete(id: number, name: string): void {
        const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${name}"</strong>?<br>
        ${this.app.localize('This action can only be performed if current stock is zero.')}`;
        this.app.confirmDialog(
            this.app.localize('Confirm Delete'),
            message,
            () => this.delete(id),
            null,
            `<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
            `<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
            'danger'
        );
    }

    // Delete stock by id
    private delete(id: number): void {
        const dialogId = this.app.showLoadingDialog('Deleting...');
        this.http.delete<any>(`/api/inventory/deletestock/${id}`).subscribe({
            next: () => {
                this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Stock record deleted successfully.'));
                this.reloadDataTable();
                this.app.closeLoadingDialog(dialogId);
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.app.closeLoadingDialog(dialogId);
            }
        });
    }

    // --- Utility Methods ---

    // Handle item change in modal
    public onItemChange(event: any): void {
        const selectedItem = this.items.find(i => i.id === event);
        if (selectedItem) {
            this.stock.unitCost = this.app.apiNumberToLocale(selectedItem.cost || 0);
        }
    }

    // --- Window Event Handlers ---

    // Reset modal state on browser back navigation
    private onPopState = (): void => {
        if (this.mainModal.show) this.resetMainModal();
    };
}