import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-modifiers',
	templateUrl: './modifiers.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ModifiersComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current modifier object
	public modifier: any = {
		id: 0,
		modifierName: '',
		description: '',
		minSelection: 0,
		maxSelection: 1,
		isRequired: false,
		modifierOptions: []
	};

	// Form data
	public ingredients: any[] = [];

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
				{ title: this.app.localize('Modifier Name'), data: 'modifierName', orderSequence: ['asc', 'desc'] },
				{
					title: this.app.localize('Options'),
					data: 'options',
					orderable: false,
					render: (data: any, type: any, row: any) => this.renderOptionsColumn(row)
				},
				{ title: this.app.localize('Selections'), data: 'selections', orderable: false },
				{ title: this.app.localize('Required'), data: 'isRequired', orderable: false },
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
				this.http.get<any>('/api/products/getmodifiers', { params: query as any }).subscribe({
					next: response => {
						const formattedData = (response.data || []).map((item: any) => ({
							...item,
							selections: `${item.minSelection} / ${item.maxSelection}`,
							isRequired: item.isRequired
								? `<span class="badge badge-warning">${this.app.localize('Yes')}</span>`
								: `<span class="badge badge-light">${this.app.localize('No')}</span>`
						}));
						callback({
							recordsTotal: response.recordsTotal,
							recordsFiltered: response.recordsFiltered,
							data: formattedData
						});
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

	// Render options column for each row
	private renderOptionsColumn(row: any): string {
		var res = '';
		row.modifierOptions?.forEach((option: any, index: number) => {
			res += `<span class="badge badge-light me-1 mb-1">${option.optionName}</span>`;
		});
		return res;
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
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.modifierName}" href="javascript:void(0);">
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

	// --- Form Data Methods ---

	// Load form data (ingredients)
	private loadFormData(): void {
		this.http.get<any>('/api/products/getmodifierformdata').subscribe({
			next: response => {
				this.ingredients = response.ingredients || [];
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.modifier = {
			id: 0,
			modifierName: '',
			description: '',
			minSelection: 0,
			maxSelection: 1,
			isRequired: false,
			modifierOptions: []
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

	// Open modifier modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Modifier');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/products/getmodifier/${id}`).subscribe({
				next: data => {
					this.modifier = {
						...data.modifier,
						modifierOptions: data.modifier.modifierOptions?.map((option: any) => ({
							...option,
							price: this.app.apiNumberToLocale(option.price || 0),
							modifierIngredients: option.modifierIngredients?.map((ing: any) => ({
								...ing,
								quantity: this.app.apiNumberToLocale(ing.quantity || 0)
							})) || []
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
			this.mainModal.title = this.app.localize('Add Modifier');
			this.mainModal.show = true;
			// Add a default option
			this.addOption();
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close modifier modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Modifier Options Management ---

	// Add new option
	public addOption(): void {
		this.modifier.modifierOptions.push({
			optionName: '',
			price: '',
			isDefault: false,
			modifierIngredients: []
		});
	}

	// Remove option by index
	public removeOption(index: number): void {
		if (this.modifier.modifierOptions.length > 1) {
			this.modifier.modifierOptions.splice(index, 1);
		}
	}

	// Add ingredient to option
	public addIngredient(optionIndex: number, ingredientId: any): void {
		if (!ingredientId) return;
		
		// Check if ingredient already exists in this option
		if (this.modifier.modifierOptions[optionIndex].modifierIngredients.some((ri: any) => ri.ingredientId === ingredientId))
			return;

		const ingredient = this.ingredients.find(i => i.id === ingredientId);
		if (ingredient) {
			this.modifier.modifierOptions[optionIndex].modifierIngredients.push({
				ingredientId: ingredientId,
				quantity: this.app.apiNumberToLocale(1),
				ingredient: ingredient
			});
		}
	}

	// Remove ingredient from option
	public removeIngredient(optionIndex: number, ingredientIndex: number): void {
		this.modifier.modifierOptions[optionIndex].modifierIngredients.splice(ingredientIndex, 1);
	}

	// Increase ingredient quantity
	public increaseQuantity(i: number, j: number): void {
		let qty: number = 0;
		const parsed = this.app.localeToAPINumber((this.modifier.modifierOptions[i].modifierIngredients[j].quantity as any) + '');
		if (typeof parsed === 'number' && !isNaN(parsed)) {
			qty = parsed;
		}
		qty = (isNaN(qty as any) ? 0 : qty) + 1;
		this.modifier.modifierOptions[i].modifierIngredients[j].quantity = this.app.apiNumberToLocale(qty);
	}

	// Decrease ingredient quantity
	public decreaseQuantity(i: number, j: number): void {
		let qty: number = 0;
		const parsed = this.app.localeToAPINumber((this.modifier.modifierOptions[i].modifierIngredients[j].quantity as any) + '');
		if (typeof parsed === 'number' && !isNaN(parsed)) {
			qty = parsed;
		}
		qty = (isNaN(qty as any) ? 0 : qty) - 1;
		if (qty < 0) qty = 0;
		this.modifier.modifierOptions[i].modifierIngredients[j].quantity = this.app.apiNumberToLocale(qty);
	}

	// --- Form Submission Methods ---

	// Submit modifier form
	public submitForm(form: NgForm): void {
		if (!form.valid || !this.validateModifier()) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.modifier.id > 0 && this.mainModal.isUpdate;
		const url = isUpdate
			? `/api/products/updatemodifier/${this.modifier.id}`
			: '/api/products/createmodifier';

		// Prepare payload with proper number formatting
		const payLoad = { ...this.modifier };
		payLoad.modifierOptions.forEach((option: any) => {
			option.price = this.app.localeToAPINumber(option.price as string) || 0;
			option.modifierIngredients.forEach((ing: any) => {
				ing.quantity = this.app.localeToAPINumber(ing.quantity as string) || 0;
			});
		});

		const request$ = isUpdate
			? this.http.put<any>(url, payLoad)
			: this.http.post<any>(url, payLoad);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Modifier updated successfully.')
					: this.app.localize('Modifier created successfully.');
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

	// Validate modifier data
	private validateModifier(): boolean {
		// Check if at least one option exists
		if (!this.modifier.modifierOptions || this.modifier.modifierOptions.length === 0) {
			this.app.showErrorMessage(this.app.localize('Error'), this.app.localize('Modifier must have at least one option.'));
			return false;
		}

		// Validate min/max selection
		if (this.modifier.minSelection > this.modifier.maxSelection) {
			this.app.showErrorMessage(this.app.localize('Error'), this.app.localize('Min selection cannot be greater than max selection.'));
			return false;
		}

		if (this.modifier.maxSelection > this.modifier.modifierOptions.length) {
			this.app.showErrorMessage(this.app.localize('Error'), this.app.localize('Max selection cannot be greater than number of options.'));
			return false;
		}

		if (this.modifier.isRequired && this.modifier.minSelection < 1) {
			this.app.showErrorMessage(this.app.localize('Error'), this.app.localize('Required modifier must have minimum selection of at least 1.'));
			return false;
		}

		// Check for duplicate option names
		const optionNames = this.modifier.modifierOptions.map((o: any) => o.optionName.toLowerCase().trim()).filter((n: any) => n);
		const uniqueNames = [...new Set(optionNames)];
		if (optionNames.length !== uniqueNames.length) {
			this.app.showErrorMessage(this.app.localize('Error'), this.app.localize('Option names must be unique.'));
			return false;
		}

		// Validate each option has a name
		for (let i = 0; i < this.modifier.modifierOptions.length; i++) {
			if (!this.modifier.modifierOptions[i].optionName?.trim()) {
				this.app.showErrorMessage(this.app.localize('Error'), `${this.app.localize('Option')} ${i + 1} ${this.app.localize('must have a name')}.`);
				return false;
			}
		}

		return true;
	}

	// --- Action Methods ---

	// Show confirmation dialog before deleting modifier
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

	// Delete modifier by id
	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/products/deletemodifier/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Modifier deleted successfully.'));
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