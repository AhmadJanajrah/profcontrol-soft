import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-languages',
	templateUrl: './languages.component.html',
	standalone: true,
	imports: [AppImports]
})
export class LanguagesComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current language object for add/edit modal
	public language: any = {};

	// Available cultures for selection
	public cultures: any[] = [];

	// Translation file handling
	public translationFile: File | null = null;

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
		this.loadCultures();
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
				{ title: this.app.localize('Code'), data: 'languageCode', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Language'), data: 'languageName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Native Name'), data: 'nativeName', orderSequence: ['asc', 'desc'] },
				{ 
					title: this.app.localize('Direction'), 
					data: 'isRtl', 
					orderable: false,
					render: (data: any) => this.renderDirectionBadge(data)
				},
				{ 
					title: this.app.localize('Default'), 
					data: 'isDefault', 
					orderable: false,
					render: (data: any) => this.renderIsDefaultBadge(data)
				},
				{ 
					title: this.app.localize('Status'), 
					data: 'isActive', 
					orderable: false,
					render: (data: any) => this.renderStatusBadges(data)
				},
				{
					title: this.app.localize('Actions'),
					data: null,
					orderable: false,
					className: 'dt-center',
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
				this.http.get<any>('/api/settings/getlanguages', { params: query }).subscribe({
					next: response => {
						const formattedData = response.data;
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
			sortColumn: params.order[0].column,
			sortDirection: params.order[0].dir
		};
	}

	// Render direction badge
	private renderDirectionBadge(isRTL: boolean): string {
		return `
			<span class="badge ${isRTL ? 'badge-primary' : 'badge-light'}">
				${isRTL ? this.app.localize('RTL') : this.app.localize('LTR')}
			</span>
		`;
	}

	// Render is default badge
	private renderIsDefaultBadge(isDefault: boolean): string {
		return `
			<span class="badge ${isDefault ? 'badge-primary' : 'badge-light'}">
				${isDefault ? this.app.localize('Yes') : this.app.localize('No')}
			</span>
		`;
	}

	// Render status badges
	private renderStatusBadges(isActive: boolean): string {
		return `
			<span class="badge ${isActive ? 'badge-primary' : 'badge-danger'}">
				${isActive ? this.app.localize('Active') : this.app.localize('Inactive')}
			</span>
		`;
	}

	// Render action dropdown for each row
	private renderActionColumn(row: any): string {
		let actions = `
		<button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
			<i class="ri-more-fill"></i>
		</button>
		<div class="dropdown-menu dropdown-menu-end">
			<a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
				<i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
			</a>
			<a class="dropdown-item download-button" data-code="${row.languageCode}" href="javascript:void(0);">
				<i class="ri-download-2-line"></i>${this.app.localize('Download Translation')}
			</a>
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.languageName}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>
		</div>`;
		return actions;
	}

	// Attach event listeners for table actions
	private addTableEventListeners(): void {
		const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (tableBody) {
			this.renderer.listen(tableBody, 'click', (event: Event) => {
				const target = event.target as Element;
				const editButton = target.closest('.edit-button');
				const deleteButton = target.closest('.delete-button');
				const downloadButton = target.closest('.download-button');

				if (editButton) {
					const languageId = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(languageId);
				}

				if (deleteButton) {
					const languageId = parseInt(deleteButton.getAttribute('data-id') || '0');
					const languageName = deleteButton.getAttribute('data-name') || '';
					this.confirmDeleteLanguage(languageId, languageName);
				}

				if (downloadButton) {
					const languageCode = downloadButton.getAttribute('data-code') || '';
					this.downloadTemplate(languageCode);
				}
			});
		}
	}

	// --- Culture/Form Data Methods ---

	// Load available cultures for language selection
	private loadCultures(): void {
		this.http.get<any>('/api/settings/getlanguagecultures').subscribe({
			next: response => {
				this.cultures = response.cultures;
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// Download language template
	public downloadTemplate(languageCode: string): void {
		this.http.get(`/api/settings/downloadlanguagetemplate/${languageCode}`, { responseType: 'blob' }).subscribe({
			next: (blob) => {
				const url = window.URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = `language-${languageCode}.json`;
				link.click();
				window.URL.revokeObjectURL(url);
			},
			error: error => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.language = {
			id: 0,
			languageCode: null,
			isActive: true,
			isDefault: false
		};
		this.translationFile = null;
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

	// Open language modal for add/edit
	public openMainModal(id: number): void {
		if (id > 0) {
			this.resetMainModal();
			this.mainModal.loading = true;
			this.mainModal.title = this.app.localize('Edit Language');
			this.mainModal.btnSaveText = this.app.localize('Update');
			this.mainModal.show = true;
			this.mainModal.isUpdate = true;

			this.http.get<any>(`/api/settings/getlanguage/${id}`).subscribe({
				next: data => {
					this.language = { ...data.language };
					this.mainModal.loading = false;
				},
				error: error => {
					this.app.handleApiError(error);
					this.resetMainModal();
				}
			});
		} else {
			this.resetMainModal();
			this.mainModal.title = this.app.localize('Add Language');
			this.mainModal.show = true;
		}
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close language modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- File Handling Methods ---

	// Handle file input change
	public onFileInputChange(event: any): void {
		const input = event.target as HTMLInputElement;
		if (!input?.files?.length) {
			this.translationFile = null;
			return;
		}

		const file = input.files[0];
		if (!this.validateTranslationFile(file)) {
			this.translationFile = null;
			input.value = '';
			return;
		}

		this.translationFile = file;
	}

	// Validate translation file
	private validateTranslationFile(file: File): boolean {
		const allowedTypes = ['application/json'];
		const maxSizeMB = 10;

		if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.json')) {
			this.app.showErrorMessage(
				this.app.localize('Invalid File'),
				this.app.localize('Please select a valid JSON file.')
			);
			return false;
		}

		if (file.size > maxSizeMB * 1024 * 1024) {
			this.app.showErrorMessage(
				this.app.localize('File Too Large'),
				this.app.localize(`File size must be less than ${maxSizeMB}MB.`)
			);
			return false;
		}

		return true;
	}

	// --- Form Submission Methods ---

	// Submit language form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		// For create, translation file is required
		if (!this.mainModal.isUpdate && !this.translationFile) {
			this.app.showErrorMessage(
				this.app.localize('Missing File'),
				this.app.localize('Translation file is required for new languages.')
			);
			return;
		}

		this.mainModal.submitted = true;
		const isUpdate = this.language.id > 0 && this.mainModal.isUpdate;

		// Create FormData for file upload
		const formData = new FormData();
		if (isUpdate) {
			formData.append('id', this.language.id.toString());
		} else {
			formData.append('languageCode', this.language.languageCode);
		}
		formData.append('isActive', this.language.isActive.toString());
		formData.append('isDefault', this.language.isDefault.toString());

		if (this.translationFile) {
			formData.append('translationFile', this.translationFile);
		}

		const url = isUpdate
			? `/api/settings/updatelanguage/${this.language.id}`
			: '/api/settings/createlanguage';

		const request$ = isUpdate
			? this.http.put<any>(url, formData)
			: this.http.post<any>(url, formData);

		request$.subscribe({
			next: () => {
				const msg = isUpdate
					? this.app.localize('Language updated successfully.')
					: this.app.localize('Language created successfully.');
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

	// Show confirmation dialog before deleting language
	private confirmDeleteLanguage(id: number, languageName: string): void {
		const message = `${this.app.localize('Are you sure you want to delete language')} <strong>"${languageName}"</strong>?<br>
    ${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => this.deleteLanguage(id),
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	// Delete language by id
	private deleteLanguage(id: number): void {
		var dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/settings/deletelanguage/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Language deleted successfully.'));
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