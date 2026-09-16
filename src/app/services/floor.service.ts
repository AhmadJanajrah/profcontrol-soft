import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

/*
|--------------------------------------------------------------------------
| Floor Service
| - API methods (Floor Areas, Tables, Layout)
| - Shared state (selected floor/table)
| - Design helpers (sizes, styles, positions)
| - UI helpers (statuses, shapes)
|--------------------------------------------------------------------------
*/

export interface FloorTable {
  id: number;
  tableNumber: string;
  capacity: number;
  status: number;
  floorAreaId: number;
  floorArea?: any;
  locationId?: number;
  posX: number;
  posY: number;
  rotation: number;
  shapeType: number;
  allowSelfOrdering: boolean;
  description?: string;
  qrcode?: string;
  isActive?: boolean;
}

export interface FloorArea {
  id: number;
  areaName: string;
  width: number;
  height: number;
  tables: FloorTable[];
  isOutdoor?: boolean;
  isSmokingAllowed?: boolean;
  isActive?: boolean;
  imageUrl?: string;
  description?: string;
  locationId?: number;
}

export interface FloorPlanConfig {
  showChairs: boolean;
  showTableNumbers: boolean;
  showCapacity: boolean;
  enableSelection: boolean;
  enableDragging: boolean;
  enableHover: boolean;
  minScale: number;
  maxScale: number;
  chairDistance: number;
  animationDuration: number;
}

export interface SaveLayoutRequest {
  locationId: number;
  tables: Array<{
    id: number;
    posX: number;
    posY: number;
    rotation: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class FloorService {
  // Shared selection state
  private selectedTableSubject = new BehaviorSubject<FloorTable | null>(null);
  private selectedFloorSubject = new BehaviorSubject<FloorArea | null>(null);
  public selectedTable$ = this.selectedTableSubject.asObservable();
  public selectedFloor$ = this.selectedFloorSubject.asObservable();

  // Default design config
  public defaultConfig: FloorPlanConfig = {
    showChairs: true,
    showTableNumbers: true,
    showCapacity: true,
    enableSelection: true,
    enableDragging: false,
    enableHover: true,
    minScale: 0.1,
    maxScale: 2.0,
    chairDistance: 0,
    animationDuration: 300
  };

  // Design system (colors, shapes, shadows)
  private readonly designSystem = {
    colors: {
      status: {
        1: { primary: 'var(--brand-primary)', secondary: 'var(--brand-primary)', name: 'Available' },
        2: { primary: '#ffc107', secondary: '#e0a800', name: 'Reserved' },
        3: { primary: '#dc3545', secondary: '#c82333', name: 'Occupied' },
        4: { primary: '#cbd5e1', secondary: '#a6aeb9ff', name: 'Maintenance' }
      },
      floor: {
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        border: '#495057',
      },
      chair: {
        primary: '#D2691E',
        secondary: '#CD853F',
        tertiary: '#A0522D',
        border: '#8B4513'
      }
    },
    shadows: {
      table: '0 2px 8px rgba(0,0,0,0.2)',
      tableHover: '0 4px 16px rgba(0,0,0,0.3)',
      tableSelected: '0 0 0 3px rgba(0,123,255,0.3), 0 4px 12px rgba(0,0,0,0.3)',
      chair: '0 1px 3px rgba(0,0,0,0.3)',
      button: '0 2px 6px rgba(0,0,0,0.3)'
    },
    shapes: {
      1: { name: 'Circle', style: 'border-radius: 50%;' },
      2: { name: 'Square', style: 'border-radius: 4px;' },
      3: { name: 'Rectangle', style: 'border-radius: 4px;' }
    }
  };

  constructor(private http: HttpClient) {}

  /*
  |--------------------------------------------------------------------------
  | API METHODS (Floor Areas)
  |--------------------------------------------------------------------------
  */

  getFloorAreaFormData(locationId: number): Observable<{ floorAreas: Array<{ id: number; areaName: string }> }> {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.get<{ floorAreas: Array<{ id: number; areaName: string }> }>('/api/floor/getfloorareaformdata', { params });
  }

  getFloorArea(id: number, locationId: number): Observable<{ floorArea: any }> {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.get<{ floorArea: any }>(`/api/floor/getfloorarea/${id}`, { params });
  }

  createFloorArea(formData: FormData): Observable<any> {
    return this.http.post('/api/floor/createfloorarea', formData);
  }

  updateFloorArea(id: number, formData: FormData): Observable<any> {
    return this.http.put(`/api/floor/updatefloorarea/${id}`, formData);
  }

  deleteFloorArea(id: number, locationId: number): Observable<any> {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.delete(`/api/floor/deletefloorarea/${id}`, { params });
  }

  /*
  |--------------------------------------------------------------------------
  | API METHODS (Layout & Plan)
  |--------------------------------------------------------------------------
  */

  getFloorPlan(floorId: number, locationId: number): Observable<{ floor: FloorArea; tables: FloorTable[] }> {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.get<{ floor: FloorArea; tables: FloorTable[] }>(`/api/floor/getfloorplan/${floorId}`, { params });
    // Controller: GetFloorPlan(int floorId, int locationId)
  }

  saveLayout(floorId: number, layoutData: SaveLayoutRequest): Observable<any> {
    return this.http.post(`/api/floor/savelayout/${floorId}`, layoutData);
    // Controller: SaveLayout(int floorId, [FromBody] SaveLayoutRequest)
  }

  /*
  |--------------------------------------------------------------------------
  | API METHODS (Tables)
  |--------------------------------------------------------------------------
  */

  getTableFormData(locationId: number): Observable<{ floorAreas: Array<{ id: number; areaName: string }> }> {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.get<{ floorAreas: Array<{ id: number; areaName: string }> }>('/api/floor/gettableformdata', { params });
    // Controller: GetTableFormData(int locationId)
  }

  getTables(params: {
    locationId: number;
    start: number;
    length: number;
    searchValue?: string;
    sortColumn?: number;
    sortDirection?: 'asc' | 'desc';
    floorAreaId?: number | null;
    status?: number | null;
  }): Observable<{ recordsTotal: number; recordsFiltered: number; data: any[] }> {
    let httpParams = new HttpParams()
      .set('locationId', params.locationId)
      .set('start', params.start)
      .set('length', params.length)
      .set('searchValue', params.searchValue || '')
      .set('sortColumn', (params.sortColumn ?? 0).toString())
      .set('sortDirection', params.sortDirection || 'asc');

    if (params.floorAreaId) httpParams = httpParams.set('floorAreaId', params.floorAreaId);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http.get<{ recordsTotal: number; recordsFiltered: number; data: any[] }>('/api/floor/gettables', { params: httpParams });
  }

  getTable(id: number, locationId: number): Observable<{ table: any }> {
    const params = new HttpParams().set('locationId', String(locationId || 0));
    return this.http.get<{ table: any }>(`/api/floor/gettable/${id}`, { params });
  }

  createTable(table: FloorTable, locationId: number): Observable<any> {
    return this.http.post('/api/floor/createtable', this.buildTablePayload(table, locationId, 0));
  }

  updateTable(id: number, table: FloorTable, locationId: number): Observable<any> {
    return this.http.put(`/api/floor/updatetable/${id}`, this.buildTablePayload(table, locationId, id));
  }

  private buildTablePayload(table: FloorTable, _locationId: number, id: number): Record<string, any> {
    return {
      id: Number(id) || 0,
      floorAreaId: Number(table.floorAreaId) || 0,
      tableNumber: table.tableNumber ?? '',
      description: table.description ?? '',
      capacity: Number(table.capacity) || 4,
      shapeType: Number(table.shapeType) || 1,
      posX: Math.round(Number(table.posX) || 0),
      posY: Math.round(Number(table.posY) || 0),
      rotation: Math.round(Number(table.rotation) || 0),
      qrcode: table.qrcode ?? null,
      status: Number(table.status) || 1,
      allowSelfOrdering: !!table.allowSelfOrdering
    };
  }

  deleteTable(id: number, locationId: number): Observable<any> {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.delete(`/api/floor/deletetable/${id}`, { params });
  }

  updateTableStatus(tableId: number, status: number, locationId: number): Observable<any> {
    return this.http.put(`/api/floor/updatetablestatus/${tableId}`, { status });
  }

  generateAllQRCodes(locationId: number): Observable<{ message: string }> {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.post<{ message: string }>('/api/floor/generateallqrcodes', null, { params });
  }

  /*
  |--------------------------------------------------------------------------
  | SHARED STATE
  |--------------------------------------------------------------------------
  */

  setSelectedTable(table: FloorTable | null): void {
    this.selectedTableSubject.next(table);
  }
  getSelectedTable(): FloorTable | null {
    return this.selectedTableSubject.value;
  }

  setSelectedFloor(floor: FloorArea | null): void {
    this.selectedFloorSubject.next(floor);
  }
  getSelectedFloor(): FloorArea | null {
    return this.selectedFloorSubject.value;
  }

  /*
  |--------------------------------------------------------------------------
  | COORDINATE & SIZE HELPERS
  |--------------------------------------------------------------------------
  */

  calculateCanvasScale(containerWidth: number, containerHeight: number, floorWidth: number, floorHeight: number, config: FloorPlanConfig): number {
    const scaleX = containerWidth / floorWidth;
    const scaleY = containerHeight / floorHeight;
    const scale = Math.min(scaleX, scaleY, config.maxScale);
    return Math.max(scale, config.minScale);
  }

  floorToCanvas(floorX: number, floorY: number, canvasWidth: number, canvasHeight: number, floorWidth: number, floorHeight: number): { x: number; y: number } {
    return {
      x: (floorX / floorWidth) * canvasWidth,
      y: (floorY / floorHeight) * canvasHeight
    };
  }

  canvasToFloor(canvasX: number, canvasY: number, canvasWidth: number, canvasHeight: number, floorWidth: number, floorHeight: number): { x: number; y: number } {
    return {
      x: (canvasX / canvasWidth) * floorWidth,
      y: (canvasY / canvasHeight) * floorHeight
    };
  }

  getScaledTableSize(table: FloorTable, canvasScale: number): { width: number; height: number } {
    const capacity = Math.max(1, Math.min(table.capacity, 32));
    const shapeType = this.getShapeString(table.shapeType);
    let baseWidth = 40, baseHeight = 40;

    switch (shapeType) {
      case 'Circle': {
        const diameter = Math.max(30, Math.min(40 + (capacity * 8), 200));
        baseWidth = diameter; baseHeight = diameter;
        break;
      }
      case 'Square': {
        const side = Math.max(30, Math.min(40 + (capacity * 6), 150));
        baseWidth = side; baseHeight = side;
        break;
      }
      case 'Rectangle': {
        if (capacity <= 4) { baseWidth = 60 + (capacity * 10); baseHeight = 40; }
        else if (capacity <= 8) { baseWidth = 100 + (capacity * 8); baseHeight = 50; }
        else { baseWidth = 160 + (capacity * 6); baseHeight = 60; }
        break;
      }
    }

    return { width: baseWidth * canvasScale, height: baseHeight * canvasScale };
  }

  /*
  |--------------------------------------------------------------------------
  | VISUAL ELEMENTS (Canvas, Grid, Chairs, Buttons)
  |--------------------------------------------------------------------------
  */

  createFloorCanvas(): HTMLElement {
    const canvas = document.createElement('div');
    canvas.className = 'floor-canvas position-relative';
    return canvas;
  }

  createChairElement(chairSize: number, canvasScale: number): HTMLElement {
    const chair = document.createElement('div');
    chair.className = 'chair';
    chair.innerHTML = `
      <div style="
        width: 100%; height: 100%;
        background: linear-gradient(145deg, ${this.designSystem.colors.chair.primary}, ${this.designSystem.colors.chair.secondary}, ${this.designSystem.colors.chair.tertiary});
        border: ${Math.max(1, canvasScale * 0.5)}px solid ${this.designSystem.colors.chair.border};
        border-radius: ${Math.max(2, 3 * canvasScale)}px;
        box-shadow: ${this.designSystem.shadows.chair};
      "></div>
    `;
    return chair;
  }

  createActionButton(icon: string, color: string, size: number, fontSize: number, rotation: number = 0): HTMLElement {
    const button = document.createElement('button');
    button.className = 'btn btn-sm btn-icon position-absolute rounded-circle border-0 action-button';
    button.style.cssText = `
      width: ${size}px; height: ${size}px;
      background: linear-gradient(145deg, ${color}, ${this.getDarkerColor(color)});
      color: white; font-size: ${fontSize}px;
      box-shadow: ${this.designSystem.shadows.button};
      transform: rotate(-${rotation}deg);
    `;
    button.innerHTML = `<i class="${icon}"></i>`;
    return button;
  }

  /*
  |--------------------------------------------------------------------------
  | UI HELPERS (Statuses & Shapes)
  |--------------------------------------------------------------------------
  */

  getStatusColor(status: number): string {
    return this.designSystem.colors.status[status as 1 | 2 | 3 | 4]?.primary || this.designSystem.colors.status[4].primary;
  }

  getDarkerColor(color: string): string {
    const match = Object.values(this.designSystem.colors.status).find(s => s.primary === color);
    return match?.secondary || color;
  }

  getShapeStyles(shapeType: string | number): string {
    const shapeNum = typeof shapeType === 'string' ? this.getShapeValue(shapeType) : shapeType;
    return this.designSystem.shapes[shapeNum as 1 | 2 | 3]?.style || this.designSystem.shapes[1].style;
  }

  getShapeString(shapeType: number): string {
    return this.designSystem.shapes[shapeType as 1 | 2 | 3]?.name || 'Circle';
  }

  getShapeValue(shapeString: string): number {
    const entry = Object.entries(this.designSystem.shapes).find(([_, s]) => s.name === shapeString);
    return entry ? Number(entry[0]) : 1;
  }

  getStatusOptions(): Array<{ value: number; label: string; class: string }> {
    return [1, 2, 3, 4].map(v => ({
      value: v,
      label: this.designSystem.colors.status[v as 1 | 2 | 3 | 4].name,
      class: v === 1 ? 'badge-primary' : v === 2 ? 'badge-warning' : v === 3 ? 'badge-danger' : 'badge-light'
    }));
  }

  getShapeOptions(): Array<{ value: number; label: string; icon: string }> {
    const icons: Record<string, string> = { Circle: 'ri-circle-line', Square: 'ri-square-line', Rectangle: 'ri-rectangle-line' };
    return [1, 2, 3].map(v => {
      const name = this.designSystem.shapes[v as 1 | 2 | 3].name;
      return { value: v, label: name, icon: icons[name] || 'ri-shape-2-line' };
    });
  }

  /*
  |--------------------------------------------------------------------------
  | STYLE BUILDERS
  |--------------------------------------------------------------------------
  */

  getWrapperStyles(table: FloorTable, canvasPos: { x: number; y: number }, isSelected: boolean = false): string {
    return `
      position: absolute; left: ${canvasPos.x}px; top: ${canvasPos.y}px;
      cursor: move; user-select: none; z-index: ${isSelected ? 20 : 10};
      transform: rotate(${table.rotation || 0}deg); transform-origin: center center;
      transition: all ${this.defaultConfig.animationDuration}ms ease;
    `;
  }

  getTableStyles(table: FloorTable, canvasScale: number, isSelected: boolean = false): string {
    const size = this.getScaledTableSize(table, canvasScale);
    const statusColor = this.getStatusColor(table.status);
    const darkerColor = this.getDarkerColor(statusColor);
    const shapeStyle = this.getShapeStyles(table.shapeType);

    return `
      width: ${size.width}px; height: ${size.height}px;
      background: linear-gradient(145deg, ${statusColor}, ${darkerColor});
      border: ${1.5 * canvasScale}px solid ${isSelected ? '#007bff' : darkerColor};
      color: white; font-weight: bold; font-size: ${Math.max(10, 14 * canvasScale)}px;
      ${shapeStyle}
      box-shadow: ${isSelected ? this.designSystem.shadows.tableSelected : this.designSystem.shadows.table};
      transition: all ${this.defaultConfig.animationDuration}ms ease;
      pointer-events: none; display: flex; align-items: center; justify-content: center;
    `;
  }

  /*
  |--------------------------------------------------------------------------
  | CHAIR POSITIONING
  |--------------------------------------------------------------------------
  */

  getDynamicChairPositions(table: FloorTable, tableSize: { width: number; height: number }): Array<{ x: number; y: number; angle: number }> {
    const positions: Array<{ x: number; y: number; angle: number }> = [];
    const centerX = tableSize.width / 2;
    const centerY = tableSize.height / 2;
    const chairDistance = this.defaultConfig.chairDistance;
    const capacity = Math.max(1, Math.min(table.capacity, 32));
    const shapeType = this.getShapeString(table.shapeType);

    switch (shapeType) {
      case 'Circle':
        for (let i = 0; i < capacity; i++) {
          const angle = (2 * Math.PI * i) / capacity;
          const chairAngle = (angle * 180) / Math.PI + 90;
          positions.push({
            x: centerX + (tableSize.width / 2 + chairDistance) * Math.cos(angle),
            y: centerY + (tableSize.height / 2 + chairDistance) * Math.sin(angle),
            angle: chairAngle
          });
        }
        break;

      case 'Square':
        this.generateSquareChairPositions(positions, tableSize, capacity, chairDistance);
        break;

      case 'Rectangle':
        this.generateRectangleChairPositions(positions, tableSize, capacity, chairDistance);
        break;
    }

    return positions.slice(0, capacity);
  }

  private generateSquareChairPositions(positions: Array<{ x: number; y: number; angle: number }>, tableSize: { width: number; height: number }, capacity: number, chairDistance: number): void {
    const perimeter = tableSize.width * 4;
    const spacing = perimeter / capacity;

    for (let i = 0; i < capacity; i++) {
      const d = i * spacing;
      let x = 0, y = 0, angle = 0;

      if (d <= tableSize.width)      { x = d; y = chairDistance; angle = 0;   }
      else if (d <= tableSize.width * 2) { x = tableSize.width - chairDistance; y = d - tableSize.width; angle = 90; }
      else if (d <= tableSize.width * 3) { x = tableSize.width - (d - tableSize.width * 2); y = tableSize.height - chairDistance; angle = 180; }
      else                           { x = chairDistance; y = tableSize.height - (d - tableSize.width * 3); angle = 270; }

      positions.push({ x, y, angle });
    }
  }

  private generateRectangleChairPositions(positions: Array<{ x: number; y: number; angle: number }>, tableSize: { width: number; height: number }, capacity: number, chairDistance: number): void {
    const longSide = tableSize.width;
    const shortSide = tableSize.height;
    const total = 2 * (longSide + shortSide);

    let top = Math.max(1, Math.round((capacity * longSide) / total));
    let bottom = Math.max(1, Math.round((capacity * longSide) / total));
    let left = Math.max(0, Math.round((capacity * shortSide) / total));
    let right = Math.max(0, Math.round((capacity * shortSide) / total));

    const diff = capacity - (top + bottom + left + right);
    if (diff !== 0) {
      top += Math.ceil(diff / 2);
      bottom += Math.floor(diff / 2);
    }

    this.addChairsToSide(positions, 'top', top, longSide, chairDistance);
    this.addChairsToSide(positions, 'right', right, shortSide, chairDistance, longSide);
    this.addChairsToSide(positions, 'bottom', bottom, longSide, chairDistance, 0, shortSide);
    this.addChairsToSide(positions, 'left', left, shortSide, chairDistance);
  }

  private addChairsToSide(
    positions: Array<{ x: number; y: number; angle: number }>,
    side: 'top' | 'right' | 'bottom' | 'left',
    count: number,
    len: number,
    chairDistance: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    if (count <= 0) return;
    const spacing = len / (count + 1);

    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, angle = 0;

      if (side === 'top')    { x = spacing * (i + 1); y = chairDistance; angle = 0; }
      if (side === 'right')  { x = offsetX - chairDistance; y = spacing * (i + 1); angle = 90; }
      if (side === 'bottom') { x = spacing * (i + 1); y = offsetY - chairDistance; angle = 180; }
      if (side === 'left')   { x = chairDistance; y = spacing * (i + 1); angle = 270; }

      positions.push({ x, y, angle });
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CSS Helper (injectable global CSS fragment if needed)
  |--------------------------------------------------------------------------
  */
  getFloorPlanCSS(): string {
    return `
      .floor-canvas { background: ${this.designSystem.colors.floor.background}; border: 3px solid ${this.designSystem.colors.floor.border}; border-radius: 12px; overflow: hidden; box-shadow: inset 0 2px 10px rgba(0,0,0,0.1); }
      .grid-svg { position: absolute; inset: 0; pointer-events: none; opacity: 0.3; }
      .table-wrapper { transition: all ${this.defaultConfig.animationDuration}ms ease; }
      .table-wrapper:hover .table-shape { transform: scale(1.05); box-shadow: ${this.designSystem.shadows.tableHover}; }
      .table-wrapper.selected .table-shape { box-shadow: ${this.designSystem.shadows.tableSelected}; }
      .chair { width: 100%; height: 100%; }
      .action-button:hover { transform: scale(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
    `;
  }
}