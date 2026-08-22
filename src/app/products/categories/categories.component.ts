import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

interface Category {
	id: number;
	categoryName: string;
	description: string;
	imageUrl: string;
	isActive: boolean;
}

@Component({
	selector: 'app-categories',
	templateUrl: './categories.component.html',
	standalone: true,
	imports: [AppImports]
})
export class CategoriesComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current category object
	public category: Category = {} as Category;

	// File upload
	public imageFile: File | null = null;
	public deleteOldImage: boolean = false;
	public imagePreviewUrl: string | null = null;

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
				{ 
					title: this.app.localize('Category Name'), 
					data: 'categoryName', orderSequence:  ['asc', 'desc'],
					render: (data: any, type: any, row: any) => this.renderCategoryColumn(data, row)
				},
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
				this.http.get<any>('/api/products/getcategories', { params: query as any }).subscribe({
					next: response => {
						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: response.data || []
						});
						this.app.loadImages('[data-img="true"]');
					},
					error: error => {
						this.app.handleApiError(error);
						callback({ recordsTotal: 0, recordsFiltered: 0, data: [] });
					}
				});
			}
		};
	}

	// Reload DataTable data
	private reloadDataTable(): void {
		if (this.dtElement?.dtInstance) {
			this.dtElement.dtInstance.then(dt => dt.ajax.reload(undefined, false));
		}
	}

	// Build query params for DataTable server-side
	private buildDataTableQuery(params: any): any {
		return {
			start: params.start,
			length: params.length,
			searchValue: params.search.value,
			sortColumn: params.order[0]?.column ?? 0,
			sortDirection: params.order[0]?.dir ?? 'asc'
		};
	}

		// Render category column with image and name
	private renderCategoryColumn(data: string, row: any): string {
		const imageUrl = row.imageUrl
			? this.app.apiUrl(`/api/media/getthumbnailimage/categories/${row.imageUrl}`)
			: 'assets/images/default.png';

		return `
        <div class="table-img-text">
            <img src="assets/images/default.png" data-img="true" data-url="${imageUrl}" alt="${row.categoryName}" class="table-avatar"/>
            <div class="text-block">
                <span class="fw-semibold">${row.categoryName}</span>
                <span class="text-muted text-wrap small d-block">${row.description || 'N/A'}</span>
            </div>
        </div>`;
	}

	// Render status column
	private renderStatusBadge(isActive: boolean): string {
		return isActive 
			? `<span class="badge badge-primary">${this.app.localize('Active')}</span>`
			: `<span class="badge badge-danger">${this.app.localize('Inactive')}</span>`;
	}

	// Render action dropdown for each row
	private renderActionColumn(row: any): string {
		return `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">
			<a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.categoryName}" href="javascript:void(0);">
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
					const categoryName = deleteButton.getAttribute('data-name') || '';
					this.confirmDelete(id, categoryName);
				}
			});
		}
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.category = {
			id: 0,
			categoryName: '',
			description: '',
			imageUrl: '',
			isActive: true
		};
		this.imageFile = null;
		this.deleteOldImage = false;
		this.imagePreviewUrl = '';
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

		this.app.loadImages('[data-form-img="true"]', true);
	}

	// Open category modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Category');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/products/getcategory/${id}`).subscribe({
				next: data => {
					const c = data.category;
					this.category = {
						id: c.id,
						categoryName: c.categoryName,
						description: c.description || '',
						imageUrl: c.imageUrl || '',
						isActive: c.isActive
					};
					this.imagePreviewUrl = this.category.imageUrl ? this.app.apiUrl(`/api/media/getthumbnailimage/categories/${this.category.imageUrl}`) : '';
					this.mainModal.loading = false;

					this.app.loadImages('[data-form-img="true"]', true);
				},
				error: error => {
					this.app.handleApiError(error);
					this.resetMainModal();
				}
			});
		} else {
			this.resetMainModal();
			this.mainModal.title = this.app.localize('Add Category');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close category modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- File Handling Methods ---

	// Handle image file selection
	public onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		if (!input?.files?.length) {
			return;
		}
		const file = input.files[0];
		if (!this.validateImageFile(file)) {
			return;
		}
		this.imageFile = file;
		this.imagePreviewUrl = URL.createObjectURL(file);
		this.app.loadImages('[data-form-img="true"]', true);
	}

	// Validate image file
	private validateImageFile(file: File): boolean {
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
		const maxSizeMB = 5;

		if (!allowedTypes.includes(file.type)) {
			this.app.showErrorMessage(
				this.app.localize('Error!'),
				this.app.localize('Please select a valid image file (JPG, PNG, GIF, WebP).')
			);
			return false;
		}

		if (file.size > maxSizeMB * 1024 * 1024) {
			this.app.showErrorMessage(
				this.app.localize('Error!'),
				this.app.localize(`File size too large.`)
			);
			return false;
		}

		return true;
	}

	// Clear image selection
	public clearImage(): void {
		this.imageFile = null;

		if (this.category.imageUrl) {
			this.deleteOldImage = true;
		}

		this.imagePreviewUrl = '';

		const fileInput = document.getElementById('imageFile') as HTMLInputElement;
		if (fileInput) {
			fileInput.value = '';
		}

		this.app.loadImages('[data-form-img="true"]', true);
	}
	
	// --- Form Submission Methods ---

	// Submit category form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.category.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/products/updatecategory/${this.category.id}`
			: '/api/products/createcategory';

		const formData = this.prepareFormData();

		const request$ = isUpdate
			? this.http.put<any>(url, formData)
			: this.http.post<any>(url, formData);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Category updated successfully.')
					: this.app.localize('Category created successfully.');
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

	// Prepare form data for submission
	private prepareFormData(): FormData {
		const formData = new FormData();

		// Append category data as form fields
		Object.keys(this.category).forEach(key => {
			const value = (this.category as any)[key];
			formData.append(`category.${key}`, value?.toString() || '');
		});

		// Append image file if selected
		if (this.imageFile) {
			formData.append('imageFile', this.imageFile);
		}

		// Append flag to delete old image if applicable
		if (this.deleteOldImage) {
			formData.append('deleteOldImage', 'true');
		}

		return formData;
	}

	// --- Action Methods ---

	// Show confirmation dialog before deleting category
	private confirmDelete(id: number, categoryName: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${categoryName}"</strong>?<br>
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

	// Delete category by id
	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/products/deletecategory/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Category deleted successfully.'));
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
	};
}