import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AppService } from '../../services/app.service';
import { FloorService, FloorTable, FloorArea, FloorPlanConfig, SaveLayoutRequest } from '../../services/floor.service';
import { AppImports } from '../../app.imports';

/*
|--------------------------------------------------------------------------
| FloorPlans Component
| - Minimal UI logic (API via FloorService)
| - Canvas rendering with service helpers
|--------------------------------------------------------------------------
*/

interface FloorAreaForm {
  id: number;
  locationId: number;
  areaName: string;
  description: string;
  width: number;
  height: number;
  isSmokingAllowed: boolean;
  isOutdoor: boolean;
  isActive: boolean;
}

interface TableForm {
  id: number;
  floorAreaId: number;
  tableNumber: string;
  capacity: number;
  shapeType: number;
  posX: number;
  posY: number;
  rotation: number;
  status: number;
  allowSelfOrdering: boolean;
  description?: string;
}

@Component({
  selector: 'app-floorplans',
  templateUrl: './floorplans.component.html',
  standalone: true,
  imports: [AppImports]
})
export class FloorPlansComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('floorCanvas') floorCanvasRef!: ElementRef<HTMLDivElement>;

  // Destroy notifier
  private destroy$ = new Subject<void>();

  // Page state
  public isLoading = true;
  public locationId = 1;

  // Options
  public shapeOptions: any = [];
  public statusOptions: any = [];

  // Floor and Tables
  public floorAreas: Array<{ id: number; areaName: string }> = [];
  public selectedFloorId: number | null = null;
  public currentFloor: FloorArea | null = null;
  public tables: FloorTable[] = [];
  public selectedTable: FloorTable | null = null;
  public hasChanges = false;

  // Canvas runtime
  private canvasScale = 1;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private canvasElement: HTMLElement | null = null;
  public floorConfig: FloorPlanConfig;

  // Forms
  public floorArea: FloorAreaForm = {} as FloorAreaForm;
  public table: TableForm = {} as TableForm;
  private editingTableId = 0;

  // Drag & drop
  private draggedTable: FloorTable | null = null;
  private dragOffset = { x: 0, y: 0 };
  private isDragging = false;
  private dragStartTime = 0;

  // Bound handlers (for add/remove) - use generic Event to support mouse/touch/pointer
  private onMouseMoveHandler = (e: Event) => this.onMouseMove(e as any);
  private onMouseUpHandler = () => this.onMouseUp();

  // Modals
  public modals = {
    floor: { show: false, submitted: false, loading: false, validated: false, isEdit: false, title: '', btnText: '' },
    table: { show: false, submitted: false, loading: false, validated: false, isEdit: false, title: '', btnText: '' }
  };

  constructor(
    private http: HttpClient,
    public app: AppService,
    public floorService: FloorService
  ) {
    this.shapeOptions = this.floorService.getShapeOptions();
    this.statusOptions = this.floorService.getStatusOptions();
    this.shapeOptions.forEach((s: any) => s.label = this.app.localize(s.label));
    this.statusOptions.forEach((s: any) => s.label = this.app.localize(s.label));
    this.floorConfig = { ...this.floorService.defaultConfig, enableDragging: true, enableSelection: true };
    this.initForms();
  }

  /*
  |--------------------------------------------------------------------------
  | Lifecycle
  |--------------------------------------------------------------------------
  */

  ngOnInit(): void {
    this.locationId = this.app.getSelectedLocationId();
    this.loadFormData();

    this.floorService.selectedTable$.pipe(takeUntil(this.destroy$)).subscribe(t => {
      this.selectedTable = t;
      this.renderFloorPlan();
    });

    this.floorService.selectedFloor$.pipe(takeUntil(this.destroy$)).subscribe(f => {
      this.currentFloor = f;
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.addGlobalListeners(), 50);
    window.addEventListener('popstate', this.onPopState);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.removeGlobalListeners();
    window.removeEventListener('popstate', this.onPopState);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    setTimeout(() => this.calculateCanvasScale(), 150);
  }

  /*
  |--------------------------------------------------------------------------
  | Init & Data
  |--------------------------------------------------------------------------
  */

  private initForms(): void {
    this.floorArea = {
      id: 0, locationId: this.locationId, areaName: '', description: '',
      width: 1000, height: 600, isSmokingAllowed: false, isOutdoor: false, isActive: true
    };

    this.table = {
      id: 0, floorAreaId: 0, tableNumber: '', capacity: 4, shapeType: 1,
      posX: 100, posY: 100, rotation: 0, status: 1, allowSelfOrdering: true
    };
  }

  private loadFormData(): void {
    this.floorService.getFloorAreaFormData(this.locationId).subscribe({
      next: res => {
        this.floorAreas = res.floorAreas || [];
        if (this.floorAreas.length > 0) this.selectFloor(this.selectedFloorId || this.floorAreas[0].id);
        this.isLoading = false;
      },
      error: err => {
        this.app.handleApiError(err);
        this.isLoading = false;
      }
    });
  }

  public selectFloor(floorId: number): void {
    this.selectedFloorId = floorId;
    this.selectedTable = null;
    this.hasChanges = false;

    this.floorService.getFloorPlan(floorId, this.locationId).subscribe({
      next: res => {
        this.currentFloor = {
          id: res.floor.id,
          areaName: res.floor.areaName,
          width: res.floor.width,
          height: res.floor.height,
          isActive: res.floor.isActive ?? true,
          isSmokingAllowed: res.floor.isSmokingAllowed ?? false,
          isOutdoor: res.floor.isOutdoor ?? false,
          tables: res.tables || []
        };
        this.tables = (res.tables || []).map(t => ({ ...t, rotation: t.rotation || 0 }));
        this.floorService.setSelectedFloor(this.currentFloor);
        setTimeout(() => this.renderFloorPlan(), 50);
      },
      error: err => {
        this.app.handleApiError(err);
        this.tables = [];
      }
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Canvas Rendering
  |--------------------------------------------------------------------------
  */

  private calculateCanvasScale(): void {
    if (!this.floorCanvasRef || !this.currentFloor) return;
    const el = this.floorCanvasRef.nativeElement;
    this.canvasWidth = el.clientWidth;
    this.canvasHeight = el.clientHeight;
    this.canvasScale = this.floorService.calculateCanvasScale(
      this.canvasWidth,
      this.canvasHeight,
      this.currentFloor.width,
      this.currentFloor.height,
      this.floorConfig
    );
  }

  private renderFloorPlan(): void {
    if (!this.floorCanvasRef || !this.currentFloor) return;

    const container = this.floorCanvasRef.nativeElement;
    container.innerHTML = '';
    this.calculateCanvasScale();

    // Canvas
    const canvas = this.floorService.createFloorCanvas();
    this.canvasElement = canvas;

    // Tables
    this.tables.forEach(table => {
      const tableEl = this.createTableElement(table);
      canvas.appendChild(tableEl);
    });

    container.appendChild(canvas);
    setTimeout(() => this.addCanvasListeners(), 30);
  }

  private createTableElement(table: FloorTable): HTMLElement {
    const canvasPos = this.floorService.floorToCanvas(
      table.posX, table.posY,
      this.canvasWidth, this.canvasHeight,
      this.currentFloor!.width, this.currentFloor!.height
    );
    const tableSize = this.floorService.getScaledTableSize(table, this.canvasScale);
    const isSelected = this.selectedTable?.id === table.id;

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.style.cssText = this.floorService.getWrapperStyles(table, canvasPos, isSelected);
    // Prevent default touch actions (panning/zooming) while interacting with table
    wrapper.style.touchAction = 'none';
    wrapper.setAttribute('data-table-id', String(table.id));

    const shape = document.createElement('div');
    shape.className = 'table-shape';
    shape.style.cssText = this.floorService.getTableStyles(table, this.canvasScale, isSelected);

    // content (number & capacity)
    const content = document.createElement('div');
    content.className = 'table-content';
    const number = document.createElement('div');
    number.className = 'table-number';
    number.textContent = table.tableNumber;
    content.appendChild(number);
    /*
    if (tableSize.width >= 60 && tableSize.height >= 40) {
      const cap = document.createElement('div');
      cap.className = 'table-capacity';
      cap.style.fontSize = `${Math.max(8, 10 * this.canvasScale)}px`;
      cap.textContent = String(table.capacity);
      content.appendChild(cap);
    }
      */
    shape.appendChild(content);

    // chairs
    if (this.floorConfig.showChairs) {
      const chairPositions = this.floorService.getDynamicChairPositions(table, tableSize);
      const chairSize = Math.max(8, 12 * this.canvasScale);
      chairPositions.forEach(pos => {
        const node = document.createElement('div');
        node.className = 'chair-node position-absolute';
        node.style.cssText = `
				left: ${pos.x - chairSize / 2}px; top: ${pos.y - chairSize / 2}px;
				width: ${chairSize}px; height: ${chairSize}px; pointer-events: none; z-index: -1;
				transform: rotate(${pos.angle}deg); transform-origin: center center;
				`;
        node.appendChild(this.floorService.createChairElement(chairSize, this.canvasScale).firstElementChild!);
        wrapper.appendChild(node);
      });
    }

    // action buttons
    if (isSelected) {
      const size = Math.max(20, 18 * this.canvasScale);
      const offset = Math.max(8, 12 * this.canvasScale);
      const font = Math.max(8, 12 * this.canvasScale);

      const buttons = [
        { icon: 'ri-edit-2-line', color: '#007bff', click: () => this.showTableModal(table.id) },
        { icon: 'ri-delete-bin-6-line', color: '#dc3545', click: () => this.deleteTable() },
        { icon: 'ri-refresh-line', color: '#17a2b8', click: () => this.rotateTable(table) }
      ];

      buttons.forEach((b, i) => {
        const btn = this.floorService.createActionButton(b.icon, b.color, size, font, table.rotation || 0);
        btn.style.top = `-${offset}px`;
        btn.style.right = `${-offset + (size + 5) * i}px`;
        btn.addEventListener('click', (e) => { e.stopPropagation(); b.click(); });
        wrapper.appendChild(btn);
      });
    }

    // hover effect (reduced)
    wrapper.addEventListener('mouseenter', () => {
      if (!isSelected) shape.classList.add('hover');
    });
    wrapper.addEventListener('mouseleave', () => {
      if (!isSelected) shape.classList.remove('hover');
    });

    wrapper.appendChild(shape);
    return wrapper;
  }

  /*
  |--------------------------------------------------------------------------
  | Events (canvas, global, drag)
  |--------------------------------------------------------------------------
  */

  private addGlobalListeners(): void {
    // Prefer pointer events (works for mouse + touch + pen). Fallback to touch + mouse.
    if ((window as any).PointerEvent) {
      document.addEventListener('pointermove', this.onMouseMoveHandler);
      document.addEventListener('pointerup', this.onMouseUpHandler);
      document.addEventListener('pointercancel', this.onMouseUpHandler);
    } else {
      // allow preventDefault on touchmove to avoid page scroll during drag
      document.addEventListener('touchmove', this.onMouseMoveHandler as EventListener, { passive: false } as any);
      document.addEventListener('touchend', this.onMouseUpHandler as EventListener);
      document.addEventListener('touchcancel', this.onMouseUpHandler as EventListener);
      document.addEventListener('mousemove', this.onMouseMoveHandler as EventListener);
      document.addEventListener('mouseup', this.onMouseUpHandler as EventListener);
    }
  }

  private removeGlobalListeners(): void {
    if ((window as any).PointerEvent) {
      document.removeEventListener('pointermove', this.onMouseMoveHandler);
      document.removeEventListener('pointerup', this.onMouseUpHandler);
      document.removeEventListener('pointercancel', this.onMouseUpHandler);
    } else {
      document.removeEventListener('touchmove', this.onMouseMoveHandler as EventListener);
      document.removeEventListener('touchend', this.onMouseUpHandler as EventListener);
      document.removeEventListener('touchcancel', this.onMouseUpHandler as EventListener);
      document.removeEventListener('mousemove', this.onMouseMoveHandler as EventListener);
      document.removeEventListener('mouseup', this.onMouseUpHandler as EventListener);
    }
  }

  private addCanvasListeners(): void {
    if (!this.canvasElement) return;

    this.canvasElement.addEventListener('click', (e) => {
      if (e.target === this.canvasElement) this.floorService.setSelectedTable(null);
    });

    this.canvasElement.querySelectorAll('.table-wrapper').forEach(wrapper => {
      // Use pointer events where available; otherwise fall back touch + mouse.
      if ((window as any).PointerEvent) {
        (wrapper as HTMLElement).addEventListener('pointerdown', (e) => this.onTableMouseDown(e as PointerEvent));
      } else {
        (wrapper as HTMLElement).addEventListener('touchstart', (e) => this.onTableMouseDown(e as TouchEvent), { passive: false } as any);
        (wrapper as HTMLElement).addEventListener('mousedown', (e) => this.onTableMouseDown(e as MouseEvent));
      }
      (wrapper as HTMLElement).addEventListener('click', (e) => this.onTableClick(e as MouseEvent));
    });
  }

  // Helper to normalize client coordinates from mouse/pointer/touch
  private getClientXY(event: any): { x: number; y: number } {
    if (!event) return { x: 0, y: 0 };
    if (event.touches && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    if (event.changedTouches && event.changedTouches.length > 0) {
      return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    }
    // PointerEvent and MouseEvent
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      return { x: event.clientX, y: event.clientY };
    }
    return { x: 0, y: 0 };
  }

  private onTableMouseDown(event: MouseEvent | TouchEvent | PointerEvent): void {
    const wrapper = (event.target as Element).closest('.table-wrapper') as HTMLElement;
    if (!wrapper) return;
    const id = parseInt(wrapper.getAttribute('data-table-id') || '0', 10);
    this.draggedTable = this.tables.find(t => t.id === id) || null;

    if (this.draggedTable) {
      this.isDragging = false;
      this.dragStartTime = Date.now();

      // Use normalized client coords
      const { x: clientX, y: clientY } = this.getClientXY(event);
      const rect = wrapper.getBoundingClientRect();
      this.dragOffset = { x: clientX - rect.left, y: clientY - rect.top };

      // Prevent page scroll/zoom while starting drag on touch
      if ((event as TouchEvent).preventDefault) (event as TouchEvent).preventDefault();
      event.stopPropagation();
    }
  }

  private onTableClick(event: MouseEvent): void {
    // If dragging just finished or in progress, ignore click
    if (this.isDragging) return;
    const wrapper = (event.target as Element).closest('.table-wrapper') as HTMLElement;
    if (!wrapper) return;

    const tableId = parseInt(wrapper.getAttribute('data-table-id') || '0', 10);
    const clicked = this.tables.find(t => t.id === tableId);
    if (clicked) {
      const newSelection = this.selectedTable?.id === tableId ? null : clicked;
      this.floorService.setSelectedTable(newSelection);
    }
    event.stopPropagation();
  }

  private onMouseMove(event: MouseEvent | TouchEvent | PointerEvent): void {
    if (!this.draggedTable || !this.canvasElement || !this.currentFloor) return;

    const now = Date.now();
    if (!this.isDragging && now - this.dragStartTime > 100) this.isDragging = true;
    if (!this.isDragging) return;

    // Prevent default scrolling when dragging with touch
    if ((event as TouchEvent).preventDefault) (event as TouchEvent).preventDefault();

    const rect = this.canvasElement.getBoundingClientRect();
    const tableSize = this.floorService.getScaledTableSize(this.draggedTable, this.canvasScale);

    const { x: clientX, y: clientY } = this.getClientXY(event);
    const canvasX = clientX - rect.left - this.dragOffset.x;
    const canvasY = clientY - rect.top - this.dragOffset.y;
    const pos = this.floorService.canvasToFloor(
      canvasX, canvasY, this.canvasWidth, this.canvasHeight, this.currentFloor.width, this.currentFloor.height
    );

    this.draggedTable.posX = Math.max(0, Math.min(pos.x, this.currentFloor.width - (tableSize.width / this.canvasScale)));
    this.draggedTable.posY = Math.max(0, Math.min(pos.y, this.currentFloor.height - (tableSize.height / this.canvasScale)));

    this.hasChanges = true;
    this.renderFloorPlan();
  }

  private onMouseUp(): void {
    // finalize drag
    this.draggedTable = null;
    this.isDragging = false;
  }

  /*
  |--------------------------------------------------------------------------
  | Table Actions
  |--------------------------------------------------------------------------
  */

  public rotateTable(table: FloorTable): void {
    table.rotation = ((table.rotation || 0) + 45) % 360;
    this.hasChanges = true;
    this.renderFloorPlan();
  }

  public saveLayout(): void {
    if (!this.selectedFloorId || this.tables.length === 0) return;

    const payload: SaveLayoutRequest = {
      locationId: this.locationId,
      tables: this.tables.map(t => ({ id: t.id, posX: Math.round(t.posX), posY: Math.round(t.posY), rotation: t.rotation || 0 }))
    };

    this.floorService.saveLayout(this.selectedFloorId, payload).subscribe({
      next: () => {
        this.hasChanges = false;
        this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Layout saved successfully.'));
      },
      error: err => this.app.handleApiError(err)
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Floor & Table Modals (CRUD)
  |--------------------------------------------------------------------------
  */

  private resetFloorModal() {
    this.modals.floor = { show: false, submitted: false, loading: false, validated: false, isEdit: false, title: '', btnText: '' };
  }

  public showFloorModal(id: number = 0): void {
    this.modals.floor = {
      show: true, submitted: false, loading: false, validated: false,
      isEdit: id > 0,
      title: id > 0 ? this.app.localize('Edit Floor Area') : this.app.localize('Add Floor Area'),
      btnText: id > 0 ? this.app.localize('Update') : this.app.localize('Save')
    };

    if (id > 0) {
      this.modals.floor.loading = true;
      this.floorService.getFloorArea(id, this.locationId).subscribe({
        next: res => {
          const fa = res.floorArea;
          this.floorArea = {
            id: fa.id, locationId: this.locationId, areaName: fa.areaName || '',
            description: fa.description || '', width: fa.width, height: fa.height,
            isSmokingAllowed: !!fa.isSmokingAllowed, isOutdoor: !!fa.isOutdoor, isActive: fa.isActive ?? true
          };
          this.modals.floor.loading = false;
        },
        error: err => {
          this.app.handleApiError(err);
          this.closeFloorModal();
        }
      });
    } else {
      this.initForms();
      this.floorArea.locationId = this.locationId;
    }

    history.pushState(null, '', window.location.pathname);
  }

  public closeFloorModal(): void {
    this.resetFloorModal();
    history.back();
  }

  public submitFloorForm(form: NgForm): void {
    if (!form.valid) {
      this.modals.floor.validated = true;
      return;
    }
    this.modals.floor.submitted = true;

    const fd = new FormData();
    Object.keys(this.floorArea).forEach(key => {
      const value = (this.floorArea as any)[key];
      fd.append(`floorArea.${key}`, value !== null && value !== undefined ? value.toString() : '');
    });

    const req$ = this.modals.floor.isEdit
      ? this.floorService.updateFloorArea(this.floorArea.id, fd)
      : this.floorService.createFloorArea(fd);

    req$.subscribe({
      next: () => {
        this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Floor area saved successfully.'));
        this.loadFormData();
        this.closeFloorModal();
      },
      error: err => {
        this.app.handleApiError(err);
        this.modals.floor.submitted = false;
      }
    });
  }

  private resetTableModal() {
    this.modals.table = { show: false, submitted: false, loading: false, validated: false, isEdit: false, title: '', btnText: '' };
    this.editingTableId = 0;
  }

  private toTableForm(t: any, fallbackId = 0): TableForm {
    const id = Number(t?.id ?? t?.tableId ?? fallbackId) || fallbackId;
    return {
      id,
      floorAreaId: Number(t?.floorAreaId) || Number(t?.floorArea?.id) || Number(this.selectedFloorId) || 0,
      tableNumber: t?.tableNumber ?? '',
      capacity: Number(t?.capacity) || 4,
      shapeType: Number(t?.shapeType) || 1,
      posX: Number(t?.posX) || 100,
      posY: Number(t?.posY) || 100,
      rotation: Number(t?.rotation) || 0,
      status: Number(t?.status) || 1,
      allowSelfOrdering: t?.allowSelfOrdering !== false,
      description: t?.description || ''
    };
  }

  public showTableModal(id: number = 0): void {
    const source = this.tables.find(t => t.id === id) || (this.selectedTable?.id === id ? this.selectedTable : null);
    const tableId = Number(id || source?.id) || 0;
    this.editingTableId = tableId;

    this.modals.table = {
      show: true, submitted: false, loading: false, validated: false,
      isEdit: tableId > 0,
      title: tableId > 0 ? this.app.localize('Edit Table') : this.app.localize('Add Table'),
      btnText: tableId > 0 ? this.app.localize('Update') : this.app.localize('Save')
    };

    if (tableId > 0) {
      if (source) {
        this.table = this.toTableForm(source, tableId);
      }
      this.modals.table.loading = !source;
      this.floorService.getTable(tableId, this.locationId).subscribe({
        next: res => {
          const t = res?.table ?? res;
          this.table = this.toTableForm(t, tableId);
          this.modals.table.loading = false;
        },
        error: err => {
          this.app.handleApiError(err);
          this.closeTableModal();
        }
      });
    } else {
      this.initForms();
      this.table.floorAreaId = this.selectedFloorId || 0;
    }

    history.pushState(null, '', window.location.pathname);
  }

  public closeTableModal(): void {
    this.resetTableModal();
    history.back();
  }

  public submitTableForm(form: NgForm): void {
    if (!form.valid) {
      this.modals.table.validated = true;
      return;
    }
    this.modals.table.submitted = true;

    const tableId = Number(this.table.id || this.editingTableId) || 0;
    const isEdit = this.modals.table.isEdit && tableId > 0;
    const locationId = this.app.getSelectedLocationId() || this.locationId;
    const payload = {
      ...this.table,
      id: isEdit ? tableId : 0,
      floorAreaId: Number(this.table.floorAreaId) || Number(this.selectedFloorId) || 0,
      locationId
    } as FloorTable;

    const req$ = isEdit
      ? this.floorService.updateTable(tableId, payload, locationId)
      : this.floorService.createTable({ ...payload, id: 0 }, locationId);

    req$.subscribe({
      next: (response) => {
        this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Table saved successfully.'));
        if (isEdit) {
          const i = this.tables.findIndex(t => t.id === tableId);
          if (i >= 0) this.tables[i] = { ...this.tables[i], ...payload, id: tableId } as any;
        } else if (response?.table) {
          if (response.table.floorAreaId == this.selectedFloorId)
            this.tables.push(response.table);
        }
        this.renderFloorPlan();
        this.closeTableModal();
      },
      error: err => {
        this.app.handleApiError(err);
        this.modals.table.submitted = false;
      }
    });
  }

  public deleteFloor(): void {
    if (!this.currentFloor) return;
    this.app.confirmDialog(
      this.app.localize('Confirm Delete'),
      `${this.app.localize('Are you sure you want to delete')} <strong>"${this.currentFloor.areaName}"</strong>?
			<br>${this.app.localize('Once deleted you will not able to recover this record.')}`,
      () => {
        const dialogId = this.app.showLoadingDialog('Deleting...');
        this.floorService.deleteFloorArea(this.currentFloor!.id, this.locationId).subscribe({
          next: () => {
            this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Floor area deleted successfully.'));
            this.selectedFloorId = null;
            this.loadFormData();
            this.app.closeLoadingDialog(dialogId);
          },
          error: err => {
            this.app.handleApiError(err);
            this.app.closeLoadingDialog(dialogId);
          }
        });
      },
      null,
      `<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
      `<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
      'danger'
    );
  }

  public deleteTable(): void {
    if (!this.selectedTable) return;
    this.app.confirmDialog(
      this.app.localize('Confirm Delete'),
      `${this.app.localize('Are you sure you want to delete')} <strong>"${this.selectedTable.tableNumber}"</strong>?
			<br>${this.app.localize('Once deleted you will not able to recover this record.')}`,
      () => {
        const dialogId = this.app.showLoadingDialog('Deleting...');
        this.floorService.deleteTable(this.selectedTable!.id, this.locationId).subscribe({
          next: () => {
            this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Table deleted successfully.'));
            this.tables = this.tables.filter(t => t.id !== this.selectedTable!.id);
            this.floorService.setSelectedTable(null);
            this.renderFloorPlan();
            this.app.closeLoadingDialog(dialogId);
          },
          error: err => {
            this.app.handleApiError(err);
            this.app.closeLoadingDialog(dialogId);
          }
        });
      },
      null,
      `<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
      `<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
      'danger'
    );
  }

  // --- Window Event Handlers ---
  private onPopState = (): void => {
    if (this.modals.table.show) {
      this.resetTableModal();
    } else if (this.modals.floor.show) {
      this.resetFloorModal();
    }
  };
}
