import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../../services/app.service';
import { Router } from '@angular/router';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-itemlist',
	templateUrl: './itemlist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ItemListComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Form data
	public categories: any[] = [];
	public itemTypes: any[] = [
		{ value: 1, label: 'Recipe', badge: 'primary' },
		{ value: 2, label: 'Ingredient', badge: 'warning' },
		{ value: 3, label: 'Retail', badge: 'info' },
		{ value: 4, label: 'Combo', badge: 'dark' },
		{ value: 5, label: 'Service', badge: 'light' }
	];

	// Filters
	public filters = {
		categoryId: null as number | null,
		itemType: null as number | null,
		validated: false,
		submitted: false
	};

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		private router: Router,
		public app: AppService
	) {
		this.itemTypes.forEach(type => {
			type.label = this.app.localize(type.label);
		});
		this.filters.itemType = 1; // Default to Recipe
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.initDataTable();
		this.loadFormData();
	}

	ngAfterViewInit(): void {
		this.dtTrigger.next(null);
		this.addTableEventListeners();
	}

	ngOnDestroy(): void {
		this.dtTrigger.unsubscribe();
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
				{
					title: this.app.localize('#'),
					data: 'rowNumber',
					orderable: false,
					searchable: false,
					width: '60px'
				},
				{
					title: this.app.localize('Item Name'),
					data: 'itemName',
					orderSequence: ['asc', 'desc'],
					render: (data: any, type: any, row: any) => this.renderItemColumn(data, row)
				},
				{ title: this.app.localize('Category'), data: 'categoryName', orderSequence: ['asc', 'desc'] },
				{
					title: this.app.localize('Type'),
					data: 'itemType',
					orderSequence: ['asc', 'desc'],
					render: (data: any) => this.renderItemTypeLabel(data)
				},
				{ title: this.app.localize('Price'), data: 'price', orderable: false },
				{ title: this.app.localize('Cost'), data: 'cost', orderable: false },
				{
					title: this.app.localize('Status'),
					data: 'isActive',
					orderable: false,
					render: (data: any) => this.renderStatusBadge(data)
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
				this.http.get<any>('/api/products/getitems', { params: query as any }).subscribe({
					next: response => {
						const start = params.start || 0;
						const formattedData = (response.data || []).map((item: any, index: number) => ({
							...item,
							rowNumber: start + index + 1,
							categoryName: item.category?.categoryName || '—',
							price: this.app.formatCurrency(item.price || 0),
							cost: item.itemType == 1 || item.itemType == 4 ? '—' : this.app.formatCurrency(item.cost || 0),
							primaryImageUrl: this.app.mediaFileName(item.itemImages?.[0]?.imageUrl || item.imageUrl)
						}));
						this.filters.submitted = false;
						this.filters.validated = false;
						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: formattedData
						});

						this.app.loadImages('[data-img="true"]');
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
		return {
			start: params.start,
			length: params.length,
			searchValue: params.search.value,
			sortColumn: params.order[0]?.column ?? 0,
			sortDirection: params.order[0]?.dir ?? 'asc',
			categoryId: this.filters.categoryId || '',
			itemType: this.filters.itemType || ''
		};
	}

	// Render item column with image and name
	private renderItemColumn(data: string, row: any): string {
		const imageUrl = this.app.itemImageUrl(row.primaryImageUrl) || 'assets/images/default.png';

		return `
        <div class="table-img-text">
            <img src="assets/images/default.png" data-img="true" data-url="${imageUrl}" alt="${row.itemName}" class="table-avatar"/>
            <div class="text-block">
                <span class="fw-semibold">${row.itemName}</span>
            </div>
        </div>`;
	}

	// Render item type label
	private renderItemTypeLabel(itemType: number): string {
		const type = this.itemTypes.find(t => t.value === itemType);
		if (type) {
			return `<span class="badge badge-${type.badge}">${type.label}</span>`;
		}
		return '';
	}

	// Render status column
	private renderStatusBadge(isActive: boolean): string {
		return isActive
			? `<span class="badge badge-primary">${this.app.localize('Active')}</span>`
			: `<span class="badge badge-light">${this.app.localize('Inactive')}</span>`;
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
			<a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.itemName}" href="javascript:void(0);">
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
				const deleteButton = target.closest('.delete-button');

				if (viewButton) {
					const id = parseInt(viewButton.getAttribute('data-id') || '0');
					this.viewItem(id);
				}

				if (editButton) {
					const id = parseInt(editButton.getAttribute('data-id') || '0');
					this.editItem(id);
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
	public applyFilters(filterForm: NgForm): void {
		if (filterForm.valid) {
			this.filters.submitted = true;
			if (this.dtElement?.dtInstance) {
				this.dtElement.dtInstance.then(dt => {
					dt.page(0).draw(false); // Reset to first page and redraw
				});
			} else {
				this.reloadDataTable(true);
			}
		} else {
			this.filters.validated = true;
		}
	}

	// Reset filters
	public resetFilters(): void {
		this.filters.categoryId = null;
		this.filters.itemType = null;
		this.filters.validated = false;
		this.filters.submitted = false;
		if (this.dtElement?.dtInstance) {
			this.dtElement.dtInstance.then(dt => {
				dt.page(0).draw(false); // Reset to first page and redraw
			});
		} else {
			this.reloadDataTable(true);
		}
	}

	// --- Form Data Methods ---

	// Load form data (categories)
	private loadFormData(): void {
		this.http.get<any>('/api/products/getitemformdata').subscribe({
			next: response => {
				this.categories = response.categories || [];
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Action Methods ---

	// Navigate to add new item page
	public addItem(): void {
		this.router.navigate(['/products/items/add']);
	}

	// View item details
	private viewItem(id: number): void {
		this.router.navigate(['/products/items/view', id]);
	}

	// Edit item
	private editItem(id: number): void {
		this.router.navigate(['/products/items/edit', id]);
	}

	// Show confirmation dialog before deleting item
	private confirmDelete(id: number, name: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${name}"</strong>?<br>
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

	// Delete item by id
	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/products/deleteitem/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Item deleted successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}
}