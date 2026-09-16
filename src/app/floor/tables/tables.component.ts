import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { NgForm } from '@angular/forms';
import { FloorService, FloorTable } from '../../services/floor.service';
import { QRCodeWriter, EncodeHintType, BitMatrix, BarcodeFormat } from '@zxing/library';
import { AppImports } from '../../app.imports';

/*
|--------------------------------------------------------------------------
| Tables Component
| - Server-side DataTable with localization
| - CRUD via FloorService
|--------------------------------------------------------------------------
*/

@Component({
	selector: 'app-tables',
	templateUrl: './tables.component.html',
	standalone: true,
	imports: [AppImports]
})
export class TablesComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

	// DataTable config/trigger
	public dtOptions: any;
	public dtTrigger = new Subject<any>();

	// Filters
	public filters = {
		floorAreaId: null as number | null,
		status: null as number | null,
		submitted: false
	};

	// Page Data
	public locationId = 0;
	public floorAreas: Array<{ id: number; areaName: string }> = [];
	public statusOptions: any[] = [];
	public shapeOptions: any = [];

	// Form Model
	public table: any = {
		id: 0,
		floorAreaId: null as number | null,
		tableNumber: '',
		capacity: 4,
		shapeType: 1,
		status: 1,
		allowSelfOrdering: true,
		description: ''
	};

	// Main modal (create/update)
	public mainModal = {
		show: false,
		loading: false,
		submitted: false,
		validated: false,
		title: '',
		btnSaveText: '',
		btnCancelText: ''
	};

	// Detail modal (view)
	public detailModal = {
		show: false,
		loading: false,
		table: null as FloorTable | null
	};

	constructor(
		private http: HttpClient,
		private renderer: Renderer2,
		private elementRef: ElementRef,
		public app: AppService,
		public floorService: FloorService
	) {
		this.shapeOptions = this.floorService.getShapeOptions();
		this.statusOptions = this.floorService.getStatusOptions();
		this.shapeOptions.forEach((s: any) => s.label = this.app.localize(s.label));
		this.statusOptions.forEach((s: any) => s.label = this.app.localize(s.label));
	}

	/*
	|--------------------------------------------------------------------------
	| Lifecycle
	|--------------------------------------------------------------------------
	*/

	ngOnInit(): void {
		this.locationId = this.app.getSelectedLocationId() || 0;
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

	/*
	|--------------------------------------------------------------------------
	| Init & Data
	|--------------------------------------------------------------------------
	*/

	private loadFormData(): void {
		// Floor areas for filters and form
		this.floorService.getTableFormData(this.locationId).subscribe({
			next: res => {
				this.floorAreas = res.floorAreas || [];
			},
			error: err => this.app.handleApiError(err)
		});
	}

	/*
	|--------------------------------------------------------------------------
	| DataTable (server-side)
	|--------------------------------------------------------------------------
	*/

	private initDataTable(): void {
		const dir = document.documentElement.dir || document.body.dir || 'ltr';
		this.dtOptions = {
			autoWidth: false,
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
					previous: dir === 'rtl' ? '<i class="ri-arrow-right-s-line"></i>' : '<i class="ri-arrow-left-s-line"></i>',
					next: dir === 'rtl' ? '<i class="ri-arrow-left-s-line"></i>' : '<i class="ri-arrow-right-s-line"></i>',
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
				{ title: this.app.localize('Table'), data: 'tableNumber', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Floor Area'), data: 'floorAreaName', orderSequence: ['asc', 'desc'] },
				{ title: this.app.localize('Capacity'), data: 'capacity', orderSequence: ['asc', 'desc'] },
				{
					title: this.app.localize('Shape'),
					data: 'shapeType',
					orderSequence: ['asc', 'desc'],
					render: (data: number) => this.renderShapeColumn(data)
				},
				{
					title: this.app.localize('Status'),
					data: 'status',
					orderSequence: ['asc', 'desc'],
					render: (data: number) => this.renderStatusColumn(data)
				},
				{
					title: this.app.localize('Location'),
					data: 'locationName',
					orderable: false,
					render: (data: any) =>
						data ? `<span class="badge badge-light"><i class="ri-store-line"></i> ${data}</span>` : '&mdash;'
				},
				{
					title: this.app.localize('Actions'),
					data: null,
					orderable: false,
					className: 'dt-actions',
					width: '50px',
					render: (_: any, __: any, row: any) => this.renderActionColumn(row)
				}
			],
			columnDefs: [
				{ targets: '_all', type: 'string' },
				{ targets: [-1], className: 'dt-center' }
			],
			layout: { bottomEnd: { paging: { firstLast: false } } },
			ajax: (params: any, callback: any) => {
				const q = this.buildQuery(params);
				this.floorService.getTables(q as any).subscribe({
					next: response => {
						const start = params.start || 0;
						const data = (response.data || []).map((t: any, index: number) => ({
							...t,
							rowNumber: start + index + 1,
							floorAreaName: t.floorArea?.areaName || '',
							locationName: t.floorArea?.location?.locationName || ''
						}));
						this.filters.submitted = false;
						callback({ recordsTotal: response.recordsTotal || 0, recordsFiltered: response.recordsFiltered || 0, data });
					},
					error: err => {
						this.app.handleApiError(err);
						this.filters.submitted = false;
						callback({ recordsTotal: 0, recordsFiltered: 0, data: [] });
					}
				});
			}
		};
	}

	private buildQuery(params: any) {
		return {
			locationId: this.locationId,
			start: params.start,
			length: params.length,
			searchValue: params.search.value || '',
			sortColumn: params.order[0]?.column ?? 0,
			sortDirection: params.order[0]?.dir ?? 'desc',
			floorAreaId: this.filters.floorAreaId || undefined,
			status: this.filters.status || undefined
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

	/*
	|--------------------------------------------------------------------------
	| DataTable render helpers
	|--------------------------------------------------------------------------
	*/

	public renderStatusColumn(status: number): string {
		const opt = this.statusOptions.find(x => x.value === status);
		const badge = opt ? (opt.class || 'badge-light') : 'badge-light';
		const label = opt ? opt.label : this.app.localize('Unknown');
		return `<span class="badge ${badge}"><i class="ri-checkbox-blank-circle-fill me-1" style="font-size:8px"></i>${label}</span>`;
	}

	public renderShapeColumn(shapeType: number): string {
		const name = this.floorService.getShapeString(shapeType);
		const icons: any = { Circle: 'ri-circle-line', Square: 'ri-square-line', Rectangle: 'ri-rectangle-line' };
		const icon = icons[name] || 'ri-question-line';
		return `<i class="${icon} me-1"></i>${this.app.localize(name)}`;
	}

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
			<a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.tableNumber}" href="javascript:void(0);">
				<i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
			</a>
		</div>
		`;
	}

	private addTableEventListeners(): void {
		const body = this.elementRef.nativeElement.querySelector('#dataTable tbody');
		if (!body) return;

		this.renderer.listen(body, 'click', (ev: Event) => {
			const target = ev.target as Element;
			const viewBtn = target.closest('.view-button') as HTMLElement | null;
			const editBtn = target.closest('.edit-button') as HTMLElement | null;
			const delBtn = target.closest('.delete-button') as HTMLElement | null;

			if (viewBtn) {
				const id = parseInt(viewBtn.getAttribute('data-id') || '0', 10);
				this.openDetailModal(id);
			}
			if (editBtn) {
				const id = parseInt(editBtn.getAttribute('data-id') || '0', 10);
				this.showMainModal(id);
			}
			if (delBtn) {
				const id = parseInt(delBtn.getAttribute('data-id') || '0', 10);
				const name = delBtn.getAttribute('data-name') || '';
				this.confirmDelete(id, name);
			}
		});
	}

	/*
	|--------------------------------------------------------------------------
	| Filters
	|--------------------------------------------------------------------------
	*/

	public applyFilters(): void {
		this.filters.submitted = true;
		this.reloadDataTable(true);
	}

	public clearFilters(): void {
		this.filters.floorAreaId = null;
		this.filters.status = null;
		this.filters.submitted = false;
		this.reloadDataTable(true);
	}

	/*
	|--------------------------------------------------------------------------
	| Main Modal (Create / Update)
	|--------------------------------------------------------------------------
	*/

	private resetMainModal() {
		this.mainModal = {
			show: false,
			loading: false,
			submitted: false,
			validated: false,
			title: '',
			btnSaveText: '',
			btnCancelText: ''
		};
	}

	public showMainModal(id: number = 0): void {
		this.mainModal = {
			show: true,
			loading: false,
			submitted: false,
			validated: false,
			title: id > 0 ? this.app.localize('Edit Table') : this.app.localize('Add New Table'),
			btnSaveText: id > 0 ? this.app.localize('Update') : this.app.localize('Save'),
			btnCancelText: this.app.localize('Cancel')
		};

		if (id > 0) {
			this.mainModal.loading = true;
			this.floorService.getTable(id, this.locationId).subscribe({
				next: res => {
					const t = res?.table ?? res;
					this.table = {
						id: Number(t?.id ?? t?.tableId ?? id) || id,
						floorAreaId: Number(t?.floorAreaId) || Number(t?.floorArea?.id) || 0,
						tableNumber: t.tableNumber,
						capacity: t.capacity, shapeType: t.shapeType, posX: t.posX, posY: t.posY,
						rotation: t.rotation || 0, status: t.status, allowSelfOrdering: !!t.allowSelfOrdering,
						description: t.description || '',
						locationId: this.locationId
					};
					this.mainModal.loading = false;
				},
				error: err => {
					this.app.handleApiError(err);
					this.closeMainModal();
				}
			});
		} else {
			this.table = {
				id: 0,
				floorAreaId: this.filters.floorAreaId || null,
				tableNumber: '',
				capacity: 4,
				shapeType: 1,
				status: 1,
				allowSelfOrdering: true,
				description: ''
			};
		}

		history.pushState(null, '', window.location.pathname);
	}

	public closeMainModal(): void {
		this.resetMainModal();
		history.back();
	}

	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.mainModal.validated = true;
			return;
		}
		this.mainModal.submitted = true;

		const tableId = Number(this.table.id) || 0;
		const locationId = this.app.getSelectedLocationId() || this.locationId;
		const payload = {
			...this.table,
			id: tableId,
			floorAreaId: Number(this.table.floorAreaId) || 0,
			locationId
		} as FloorTable;
		const req$ = tableId > 0
			? this.floorService.updateTable(tableId, payload, locationId)
			: this.floorService.createTable({ ...payload, id: 0 }, locationId);

		req$.subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Table saved successfully.'));
				this.closeMainModal();
				this.reloadDataTable();
			},
			error: err => {
				this.app.handleApiError(err);
				this.mainModal.submitted = false;
			}
		});
	}

	/*
	|--------------------------------------------------------------------------
	| Details Modal
	|--------------------------------------------------------------------------
	*/

	private resetDetailModal() {
		this.detailModal.loading = false;
		this.detailModal.show = false;
		this.detailModal.table = null;
	}

	private openDetailModal(id: number): void {
		this.detailModal.loading = true;
		this.detailModal.show = true;
		this.detailModal.table = null;

		this.floorService.getTable(id, this.locationId).subscribe({
			next: res => {
				this.detailModal.table = res.table;
				this.detailModal.loading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.closeDetailModal();
			}
		});

		history.pushState(null, '', window.location.pathname);
	}

	public closeDetailModal(): void {
		this.resetDetailModal();
		history.back();
	}

	public generateQrHtml(text: string, width = 200, height = 200): string {
		const writer = new QRCodeWriter();
		const hints = new Map();
		hints.set(EncodeHintType.CHARACTER_SET, 'UTF-8');

		const bitMatrix: BitMatrix = writer.encode(text, BarcodeFormat.QR_CODE, width, height, hints);
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return '';

		const scaleX = width / bitMatrix.getWidth();
		const scaleY = height / bitMatrix.getHeight();

		for (let y = 0; y < bitMatrix.getHeight(); y++) {
			for (let x = 0; x < bitMatrix.getWidth(); x++) {
				ctx.fillStyle = bitMatrix.get(x, y) ? '#000' : '#fff';
				ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
			}
		}

		return `<img src="${canvas.toDataURL('image/png')}" width="${width}" height="${height}" alt="QR Code">`;
	}

	public printQRCode(): void {
		if (!this.detailModal.table?.qrcode) return;

		const printWindow = window.open('', '_blank');
		if (printWindow) {
			printWindow.document.write(`
				<html>
				<head>
					<title>QR Code - ${this.detailModal.table.tableNumber}</title>
					<style>
					body { font-family: Arial, sans-serif; text-align: center; padding: 20px; margin: 0; }
					.qr-container { border: 2px solid #000; padding: 20px; display: inline-block; margin: 20px; }
					.table-info { margin-bottom: 15px; font-size: 18px; font-weight: bold; }
					.qr-code { margin: 20px 0; }
					.instructions { font-size: 14px; margin-top: 15px; color: #666; }
					@media print { body { margin: 0; } .qr-container { margin: 10px; } }
					</style>
				</head>
				<body>
					<div class="qr-container">
					<div class="table-info">
						Table: ${this.detailModal.table.tableNumber}<br>
						${this.detailModal.table.floorArea?.areaName || ''}
					</div>
					<div class="qr-code">
						${this.generateQrHtml(this.detailModal.table.qrcode, 200, 200)}
					</div>
					<div class="instructions">Scan to order from this table</div>
					</div>
				</body>
				</html>
			`);
			printWindow.document.close();
			printWindow.focus();
			setTimeout(() => {
				printWindow.print();
				printWindow.close();
			}, 500);
		}
	}

	/*
	|--------------------------------------------------------------------------
	| Actions
	|--------------------------------------------------------------------------
	*/

	private confirmDelete(id: number, name: string): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${name}"</strong>?
    <br>${this.app.localize('Once deleted you will not able to recover this record.')}`;
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

	private delete(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.floorService.deleteTable(id, this.locationId).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Table deleted successfully.'));
				this.reloadDataTable();
				this.app.closeLoadingDialog(dialogId);
			},
			error: err => {
				this.app.handleApiError(err);
				this.app.closeLoadingDialog(dialogId);
			}
		});
	}

	public generateAllQRCodes(): void {
		this.app.confirmDialog(
			this.app.localize('Generate All QR Codes'),
			this.app.localize('This will regenerate QR codes for all tables. Continue?'),
			() => {
				const dialogId = this.app.showLoadingDialog('Generating...');
				this.floorService.generateAllQRCodes(this.locationId).subscribe({
					next: (res) => {
						this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('QR codes generated.'));
						this.reloadDataTable();
						this.app.closeLoadingDialog(dialogId);
					},
					error: err => {
						this.app.handleApiError(err);
						this.app.closeLoadingDialog(dialogId);
					}
				});
			},
			null,
			`<i class="ri-qr-code-line"></i>` + this.app.localize('Generate'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'info'
		);
	}

	// --- Window Event Handlers ---
    private onPopState = (): void => {
        if (this.mainModal.show) {
            this.resetMainModal();
        } else if (this.detailModal.show) {
            this.resetDetailModal();
        }
    };
}