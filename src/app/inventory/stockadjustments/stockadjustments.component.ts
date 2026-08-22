import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

// Enums matching backend
export enum AdjustmentType {
    Damage = 1,
    Spoilage = 2,
    Theft = 3,
    Waste = 4,
    Transfer = 5,
    Count = 6,
    Other = 7
}

export enum AdjustmentStatus {
    Pending = 1,
    Approved = 2,
    Rejected = 3
}

@Component({
    selector: 'app-stockadjustments',
    templateUrl: './stockadjustments.component.html',
	standalone: true,
	imports: [AppImports]
})
export class StockAdjustmentsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger = new Subject<any>();

    // Current adjustment object
    public adjustment: any = {};

    // Form data
    public items: any[] = [];
    public adjustmentTypes: any[] = [];
    public adjustmentStatuses: any[] = [];

    // Filters
    public filters = {
        adjustmentType: null as AdjustmentType | null,
        status: null as AdjustmentStatus | null,
        dateFrom: null as string | null,
        dateTo: null as string | null,
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

    // View modal state management
    public viewModal = {
        show: false,
        title: '',
        loading: false,
        adjustment: null as any
    };

    // Enums for template
    public AdjustmentType = AdjustmentType;
    public AdjustmentStatus = AdjustmentStatus;

    constructor(
        private http: HttpClient,
        private renderer: Renderer2,
        private elementRef: ElementRef,
        public app: AppService
    ) {
        this.initializeEnums();
        this.resetMainModal();
        this.resetViewModal();
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

    // --- Initialization Methods ---

    // Initialize adjustment type and status enums with localization
    private initializeEnums(): void {
        this.adjustmentTypes = [
            { value: AdjustmentType.Damage, label: this.app.localize('Damage'), badge: 'danger' },
            { value: AdjustmentType.Spoilage, label: this.app.localize('Spoilage'), badge: 'warning' },
            { value: AdjustmentType.Theft, label: this.app.localize('Theft'), badge: 'danger' },
            { value: AdjustmentType.Waste, label: this.app.localize('Waste'), badge: 'secondary' },
            { value: AdjustmentType.Transfer, label: this.app.localize('Transfer'), badge: 'info' },
            { value: AdjustmentType.Count, label: this.app.localize('Count'), badge: 'primary' },
            { value: AdjustmentType.Other, label: this.app.localize('Other'), badge: 'light' }
        ];

        this.adjustmentStatuses = [
            { value: AdjustmentStatus.Pending, label: this.app.localize('Pending'), badge: 'warning' },
            { value: AdjustmentStatus.Approved, label: this.app.localize('Approved'), badge: 'primary' },
            { value: AdjustmentStatus.Rejected, label: this.app.localize('Rejected'), badge: 'danger' }
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
                { title: this.app.localize('Adjustment Date'), data: 'adjustmentDate', orderSequence: ['asc', 'desc'] },
                {
                    title: this.app.localize('Type'),
                    data: 'adjustmentType',
                    orderable: false,
                    render: (data: any) => this.renderTypeColumn(data)
                },
                { title: this.app.localize('Reason'), data: 'reason', orderable: false },
                {
                    title: this.app.localize('Status'),
                    data: 'status',
                    orderable: false,
                    render: (data: any) => this.renderStatusColumn(data)
                },
                { 
                    title: this.app.localize('Total Cost'), 
                    data: 'totalCost', 
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
                this.http.get<any>('/api/inventory/getstockadjustments', { params: query as any }).subscribe({
                    next: response => {
                        const formattedData = (response.data || []).map((item: any) => ({
                            ...item,
                            adjustmentDate: this.app.formatDate(item.adjustmentDate)
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
            adjustmentType: this.filters.adjustmentType || '',
            status: this.filters.status || '',
            dateFrom: this.filters.dateFrom || '',
            dateTo: this.filters.dateTo || ''
        };
    }

    // Render adjustment type column with badge
    private renderTypeColumn(adjustmentType: number): string {
        const type = this.adjustmentTypes.find(t => t.value === adjustmentType);
        if (type) {
            return `<span class="badge badge-${type.badge}">${type.label}</span>`;
        }
        return '';
    }

    // Render status column with badge
    private renderStatusColumn(status: number): string {
        const statusObj = this.adjustmentStatuses.find(s => s.value === status);
        if (statusObj) {
            return `<span class="badge badge-${statusObj.badge}">${statusObj.label}</span>`;
        }
        return '';
    }

    // Render action dropdown for each row
    private renderActionColumn(row: any): string {
        return `
        <button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="ri-more-fill"></i>
        </button>
        <div class="dropdown-menu dropdown-menu-end">
            <a class="dropdown-item view-button" data-id="${row.id}" href="javascript:void(0);">
                <i class="ri-eye-line"></i>${this.app.localize('View')}
            </a>
            ${row.status === AdjustmentStatus.Pending ? `
            <a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
                <i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
            </a>
            <a class="dropdown-item approve-button" data-id="${row.id}" href="javascript:void(0);">
                <i class="ri-check-line text-success"></i>${this.app.localize('Approve')}
            </a>` : ''}
            <a class="dropdown-item text-danger delete-button" data-id="${row.id}" href="javascript:void(0);">
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
                const viewButton = target.closest('.view-button');
                const editButton = target.closest('.edit-button');
                const approveButton = target.closest('.approve-button');
                const deleteButton = target.closest('.delete-button');

                if (viewButton) {
                    const id = parseInt(viewButton.getAttribute('data-id') || '0');
                    this.openViewModal(id);
                }

                if (editButton) {
                    const id = parseInt(editButton.getAttribute('data-id') || '0');
                    this.openMainModal(id);
                }

                if (approveButton) {
                    const id = parseInt(approveButton.getAttribute('data-id') || '0');
                    this.confirmApprove(id);
                }

                if (deleteButton) {
                    const id = parseInt(deleteButton.getAttribute('data-id') || '0');
                    this.confirmDelete(id);
                }
            });
        }
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
        this.filters.adjustmentType = null;
        this.filters.status = null;
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

    // --- Form Data Methods ---

    // Load form data (items)
    private loadFormData(): void {
        this.http.get<any>('/api/inventory/getstockadjustmentformdata').subscribe({
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
        this.adjustment = {
            id: 0,
            locationId: this.app.getSelectedLocationId(),
            adjustmentType: AdjustmentType.Count,
            adjustmentDate: this.app.currentHTMLDate(),
            reason: '',
            notes: '',
            items: []
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

    // Reset view modal state
    private resetViewModal(): void {
        this.viewModal = {
            show: false,
            title: '',
            loading: false,
            adjustment: null
        };
    }

    // Open adjustment modal for add/edit
    public openMainModal(id: number): void {
        if (id > 0) {
            this.resetMainModal();
            this.mainModal.loading = true;
            this.mainModal.title = this.app.localize('Edit Stock Adjustment');
            this.mainModal.btnSaveText = this.app.localize('Update');
            this.mainModal.show = true;
            this.mainModal.isUpdate = true;

            this.http.get<any>(`/api/inventory/getstockadjustment/${id}`).subscribe({
                next: data => {
                    const adj = data.stockAdjustment;
                    this.adjustment = {
                        id: adj.id,
                        locationId: adj.locationId,
                        adjustmentType: adj.adjustmentType,
                        adjustmentDate: this.app.APIDateTimeToHTMLDate(adj.adjustmentDate),
                        reason: adj.reason,
                        notes: adj.notes,
                        items: adj.stockAdjustmentItems?.map((item: any) => ({
							...item,
                            adjustmentQuantity: this.app.apiNumberToLocale(item.adjustmentQuantity),
                            unitCost: this.app.apiNumberToLocale(item.unitCost)
                        })) || []
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
            this.mainModal.title = this.app.localize('Add Stock Adjustment');
            this.mainModal.show = true;
        }
        history.pushState(null, '', `${window.location.pathname}`);
    }

    // Close adjustment modal
    public closeMainModal(): void {
        this.resetMainModal();
        history.back();
    }

    // Open view modal to display adjustment details
    public openViewModal(id: number): void {
        if (id <= 0) return;

        this.resetViewModal();
        this.viewModal.loading = true;
        this.viewModal.title = this.app.localize('Stock Adjustment Details');
        this.viewModal.show = true;

        this.http.get<any>(`/api/inventory/getstockadjustment/${id}`).subscribe({
            next: data => {
                this.viewModal.adjustment = data.stockAdjustment;
                this.viewModal.loading = false;
            },
            error: error => {
                this.app.handleApiError(error);
                this.resetViewModal();
            }
        });

        history.pushState(null, '', `${window.location.pathname}`);
    }

    // Close view modal
    public closeViewModal(): void {
        this.resetViewModal();
        history.back();
    }

    // Get adjustment type display name and badge
    public getAdjustmentTypeDisplay(type: number): { label: string; badge: string } {
        const typeObj = this.adjustmentTypes.find(t => t.value === type);
        return typeObj || { label: 'Unknown', badge: 'secondary' };
    }

    // Get adjustment status display name and badge
    public getAdjustmentStatusDisplay(status: number): { label: string; badge: string } {
        const statusObj = this.adjustmentStatuses.find(s => s.value === status);
        return statusObj || { label: 'Unknown', badge: 'secondary' };
    }

    // --- Adjustment Items Management ---

    // Add new adjustment item
    public addAdjustmentItem(itemId: any): void {
        if (!itemId) return;

        // Check if item already exists in this adjustment
        if (this.adjustment.items.some((item: any) => item.itemId === itemId))
            return;

        const item = this.items.find(i => i.id === itemId);
        if (item) {
            this.adjustment.items.push({
				id: 0,
				stockAdjustmentId: this.adjustment.id,
                itemId: itemId,
                adjustmentQuantity: '1',
                unitCost: this.app.apiNumberToLocale(item.cost || 0),
                notes: '',
                item: item
            });
        }
    }

    // Remove adjustment item by index
    public removeAdjustmentItem(index: number): void {
        if (this.adjustment.items.length > 0) {
            this.adjustment.items.splice(index, 1);
        }
    }

    // Increase quantity
    public increaseQuantity(index: number): void {
        const item = this.adjustment.items[index];
        const current = this.app.localeToAPINumber(item.adjustmentQuantity as string) || 0;
        item.adjustmentQuantity = this.app.apiNumberToLocale(current + 1);
        this.onQuantityChange(item);
    }

    // Decrease quantity
    public decreaseQuantity(index: number): void {
        const item = this.adjustment.items[index];
        const current = this.app.localeToAPINumber(item.adjustmentQuantity as string) || 0;
        item.adjustmentQuantity = this.app.apiNumberToLocale(current - 1);
        this.onQuantityChange(item);
    }

    // Handle quantity change
    public onQuantityChange(adjustmentItem: any): void {
        // Recalculate total cost when quantity changes
        this.calculateItemTotal(adjustmentItem);
    }

    // Handle cost change
    public onCostChange(adjustmentItem: any): void {
        // Recalculate total cost when unit cost changes
        this.calculateItemTotal(adjustmentItem);
    }

    // Calculate individual item total cost
    private calculateItemTotal(adjustmentItem: any): void {
        const qty = this.app.localeToAPINumber(adjustmentItem.adjustmentQuantity as string) || 0;
        const cost = this.app.localeToAPINumber(adjustmentItem.unitCost as string) || 0;
        const total = (qty * cost).toFixed(2);
        adjustmentItem.totalCost = parseFloat(total);
    }

    // Get total cost for a single item
    public getTotalCost(item: any): number {
        const qty = this.app.localeToAPINumber(item.adjustmentQuantity as string) || 0;
        const cost = this.app.localeToAPINumber(item.unitCost as string) || 0;
        return parseFloat((qty * cost).toFixed(2));
    }

    // Get total cost for viewed item
    public getViewItemTotalCost(item: any): number {
        const qty = item.adjustmentQuantity || 0;
        const cost = item.unitCost || 0;
        return parseFloat((qty * cost).toFixed(2));
    }

    // Get total adjustment cost
    public getTotalAdjustmentCost(): number {
        return this.adjustment.items?.reduce((total: number, item: any) => {
            return total + this.getTotalCost(item);
        }, 0) || 0;
    }

    // Get total viewed adjustment cost
    public getViewTotalAdjustmentCost(): number {
        if (!this.viewModal.adjustment?.stockAdjustmentItems) return 0;
        return this.viewModal.adjustment.stockAdjustmentItems.reduce((total: number, item: any) => {
            return total + this.getViewItemTotalCost(item);
        }, 0);
    }

    // --- Form Submission Methods ---

    // Submit adjustment form
    public submitForm(form: NgForm): void {
		this.mainModal.validated = true;
        if (!form.valid) {
            return;
        }

		if (!this.adjustment.items || this.adjustment.items.length === 0) {
            this.app.showErrorMessage(this.app.localize('Error'), this.app.localize('Adjustment must contain at least one item.'));
            return;
        }

        this.mainModal.submitted = true;
        const isUpdate = this.adjustment.id > 0 && this.mainModal.isUpdate;
        const url = isUpdate
            ? `/api/inventory/updatestockadjustment/${this.adjustment.id}`
            : '/api/inventory/createstockadjustment';

        const payload = {
            locationId: this.adjustment.locationId,
            adjustmentDate: this.adjustment.adjustmentDate,
            adjustmentType: this.adjustment.adjustmentType,
            reason: this.adjustment.reason,
            notes: this.adjustment.notes,
            items: this.adjustment.items.map((item: any) => ({
                itemId: item.itemId,
                adjustmentQuantity: this.app.localeToAPINumber(item.adjustmentQuantity as string) || 0,
                unitCost: this.app.localeToAPINumber(item.unitCost as string) || 0,
                notes: item.notes || ''
            }))
        };

        const request$ = isUpdate
            ? this.http.put<any>(url, payload)
            : this.http.post<any>(url, payload);

        request$.subscribe({
            next: () => {
                const msg = isUpdate
                    ? this.app.localize('Stock adjustment updated successfully.')
                    : this.app.localize('Stock adjustment created successfully.');
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

    // --- Action Methods ---
    // Show confirmation dialog before approving adjustment
    private confirmApprove(id: number): void {
        const message = `${this.app.localize('Are you sure you want to approve this stock adjustment')}?<br>
        ${this.app.localize('This action will update stock levels and cannot be undone.')}`;
        this.app.confirmDialog(
            this.app.localize('Confirm Approval'),
            message,
            () => this.approveAdjustment(id),
            null,
            `<i class="ri-check-line"></i>` + this.app.localize('Approve'),
            `<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
            'success'
        );
    }

    // Approve adjustment by id
    private approveAdjustment(id: number): void {
        const dialogId = this.app.showLoadingDialog('Approving...');
        this.http.post<any>(`/api/inventory/approvestockadjustment/${id}`, {}).subscribe({
            next: () => {
                this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Stock adjustment approved successfully.'));
                this.reloadDataTable();
                this.app.closeLoadingDialog(dialogId);
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.app.closeLoadingDialog(dialogId);
            }
        });
    }

    // Show confirmation dialog before deleting adjustment
    private confirmDelete(id: number): void {
        const message = `${this.app.localize('Are you sure you want to delete')} <strong>"#${id}"</strong>?<br>
        ${this.app.localize('Once deleted you will not able to recover this record.')}`;
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

    // Delete adjustment by id
    private delete(id: number): void {
        const dialogId = this.app.showLoadingDialog('Deleting...');
        this.http.delete<any>(`/api/inventory/deletestockadjustment/${id}`).subscribe({
            next: () => {
                this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Stock adjustment deleted successfully.'));
                this.reloadDataTable();
                this.app.closeLoadingDialog(dialogId);
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.app.closeLoadingDialog(dialogId);
            }
        });
    }

    // --- Window Event Handlers ---

    // Reset modal state on browser back navigation
    private onPopState = (): void => {
        if (this.mainModal.show) this.resetMainModal();
        if (this.viewModal.show) this.resetViewModal();
    };
}