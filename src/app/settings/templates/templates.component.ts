import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-templates',
	templateUrl: './templates.component.html',
	standalone: true,
	imports: [AppImports]
})
export class TemplatesComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable configuration and trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Current template object
	public template: any = {};

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
			order: [[0, 'asc']],
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
				{ title: this.app.localize('Title'), data: 'title', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Template Name'), data: 'templateName', orderSequence: ['asc', 'desc'] },
				{
					title: this.app.localize('Email'),
					data: 'isEmailEnabled',
					orderable: false,
					render: (data: boolean) => this.renderStatusBadges(data)
				},
				{
					title: this.app.localize('SMS'),
					data: 'isSmsEnabled',
					orderable: false,
					render: (data: boolean) => this.renderStatusBadges(data)
				},
				{
					title: this.app.localize('In-App'),
					data: 'isInAppEnabled',
					orderable: false,
					render: (data: boolean) => this.renderStatusBadges(data)
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
				this.http.get<any>('/api/settings/getnotificationtemplates', { params: query }).subscribe({
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

	// Render status badges
	private renderStatusBadges(data: any): string {
		return `
			<span class="badge ${data ? 'badge-primary' : 'badge-light'}">
				${data ? this.app.localize('Enabled') : this.app.localize('Disabled')}
			</span>
		`;
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

				if (editButton) {
					const templateId = parseInt(editButton.getAttribute('data-id') || '0');
					this.openMainModal(templateId);
				}
			});
		}
	}

	// --- Modal Management Methods ---

	// Reset modal state and form data
	private resetMainModal(): void {
		this.template = {
			id: 0,
			title: '',
			templateName: '',
			isEmailEnabled: false,
			isSmsEnabled: false,
			isInAppEnabled: false,
			emailSubject: '',
			emailBody: '',
			emailDefaultBody: '',
			smsBody: '',
			smsDefaultBody: '',
			inAppBody: '',
			inAppDefaultBody: '',
			description: '',
			placeholderInfo: ''
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

	// Open template modal for edit
	public openMainModal(id: number): void {
		this.resetMainModal();
		this.mainModal.loading = true;
		this.mainModal.title = this.app.localize('Edit Template');
		this.mainModal.btnSaveText = this.app.localize('Update');
		this.mainModal.show = true;
		this.mainModal.isUpdate = true;

		this.http.get<any>(`/api/settings/getnotificationtemplate/${id}`).subscribe({
			next: data => {
				this.template = { ...data.template };
				this.mainModal.loading = false;
			},
			error: error => {
				this.app.handleApiError(error);
				this.resetMainModal();
			}
		});
		history.pushState(null, '', `${window.location.pathname}`);
	}

	// Close template modal
	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	// --- Form Submission Methods ---

	// Submit template form
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}

		this.mainModal.submitted = true;
		const url = `/api/settings/updatenotificationtemplate/${this.template.id}`;

		const emailBody = this.app.getSummernoteCode('#emailBody');

		this.http.put<any>(url, { ...this.template, emailBody }).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Template updated successfully.'));
				this.closeMainModal();
				this.reloadDataTable();
			},
			error: err => {
				this.app.handleApiError(err);
				this.mainModal.submitted = false;
			}
		});
	}

	// --- Utility Methods ---
	
	public getPlaceholderHtml(jsonString: string): string {
		try {
			const jsonObj = JSON.parse(jsonString);
			
			var html = '';
			for (const key in jsonObj['placeholders']) {
				html += `<span class="badge badge-info me-1 mb-1">${jsonObj['placeholders'][key]}</span>`;
			}
			return html;
		}
		catch {
			return jsonString;
		}
	}

	// --- Window Event Handlers ---

	// Reset modal state on browser back navigation
	private onPopState = (): void => {
		if (this.mainModal.show) this.resetMainModal();
	};
}