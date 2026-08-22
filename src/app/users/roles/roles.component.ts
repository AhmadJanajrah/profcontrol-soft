import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-roles',
    templateUrl: './roles.component.html',
	standalone: true,
	imports: [AppImports]
})
export class RolesComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger = new Subject<any>();

    // Current role object for add/edit modal
    public role: any = {};

    // All permissions and groups from API
    public permissions: any[] = [];
    public permissionGroups: any[] = [];

    // Permissions selected for the current role
    public selectedPermissions: string[] = [];

    // Modal state and UI flags
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

    // Permission search/filter and expanded group state
    public permissionSearch = '';
    public expandedGroups = new Set<string>();

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
        this.fetchPermissions();
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
                { title: this.app.localize('#'), data: 'id', orderSequence: ['desc', 'asc'], width: '60px' },
                { title: this.app.localize('Role Name'), data: 'roleName', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Description'), data: 'description', orderable: false },
                {
                    title: this.app.localize('Users'),
                    data: 'userCount',
                    orderable: false,
                    render: (data: number) => `<span class="badge badge-info">${data}</span>`
                },
                {
                    title: this.app.localize('Permissions'),
                    data: 'permissionCount',
                    orderable: false,
                    render: (data: number) => `<span class="badge badge-info">${data}</span>`
                },
                {
                    title: this.app.localize('System'),
                    data: 'isSystem',
                    orderable: false,
                    render: (data: boolean) => data
                        ? `<span class="badge badge-warning">${this.app.localize('System')}</span>`
                        : `<span class="badge badge-light">${this.app.localize('Custom')}</span>`
                },
                {
                    title: this.app.localize('Action'),
                    data: null,
                    orderable: false,
                    render: (_: any, __: any, row: any) => this.renderActionColumn(row)
                }
            ],
            columnDefs: [
                { targets: '_all', type: 'string' },
                { targets: [0, 3, 4, 5, 6], className: 'dt-center' }
            ],
            layout: { bottomEnd: { paging: { firstLast: false } } },
            ajax: (params: any, callback: any) => {
                const query = this.buildDataTableQuery(params);
                this.http.get<any>('/api/users/getroles', { params: query }).subscribe({
                    next: response => {
                        const formattedData = response.data.map((item: any) => this.formatRoleRow(item));
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
            start: params.start.toString(),
            length: params.length.toString(),
            searchValue: params.search.value || '',
            sortColumn: params.order[0].column.toString(),
            sortDirection: params.order[0].dir || 'asc'
        };
    }

    // Format role row for DataTable
    private formatRoleRow(data: any): any {
        return {
            ...data,
            description: data.description || '-'
        };
    }

    // Render action dropdown for each row
    private renderActionColumn(row: any): string {
        let actions = `
        <div class="dropdown">
            <button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="ri-more-fill"></i>
            </button>
            <div class="dropdown-menu dropdown-menu-end">
        `;
        
        if (!row.isSystem) {
            actions += `
                <a class="dropdown-item edit-button" data-id="${row.id}" href="javascript:void(0);">
                    <i class="ri-edit-2-line me-2"></i>${this.app.localize('Edit')}
                </a>
                <a class="dropdown-item text-danger delete-button" data-id="${row.id}" data-name="${row.roleName}" href="javascript:void(0);">
                    <i class="ri-delete-bin-6-line me-2"></i>${this.app.localize('Delete')}
                </a>
            `;
        }
        
        actions += `
            </div>
        </div>`;
        
        return actions;
    }

    // Attach edit/delete event listeners to table body
    private addTableEventListeners(): void {
        const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
        if (tableBody) {
            this.renderer.listen(tableBody, 'click', (event: Event) => {
                const editButton = (event.target as Element).closest('.edit-button');
                const deleteButton = (event.target as Element).closest('.delete-button');
                
                if (editButton) {
                    const dataId = parseInt(editButton.getAttribute('data-id') || '0');
                    this.openRoleModal(dataId);
                }
                
                if (deleteButton) {
                    const dataId = parseInt(deleteButton.getAttribute('data-id') || '0');
                    const roleName = deleteButton.getAttribute('data-name') || '';
                    this.confirmDeleteRole(dataId, roleName);
                }
            });
        }
    }

    // --- Permissions Methods ---

    // Fetch permissions and groups from API
    private fetchPermissions(): void {
        this.http.get<any>('/api/users/getroleformdata').subscribe({
            next: (data) => {
                this.permissions = data.permissions || [];
                this.permissionGroups = data.permissionGroups || [];
            },
            error: (error) => this.app.handleApiError(error)
        });
    }

    // Filter permission groups by search
    public getFilteredGroups(): any[] {
        if (!this.permissionSearch.trim()) return this.permissions;
        const searchTerm = this.permissionSearch.toLowerCase();
        return this.permissions
            .map(group => ({
                ...group,
                permissions: group.permissions.filter((p: any) =>
                    p.name.toLowerCase().includes(searchTerm) ||
                    p.displayName?.toLowerCase().includes(searchTerm)
                )
            }))
            .filter(group => group.permissions.length > 0);
    }

    // Toggle expand/collapse for permission group
    public toggleGroup(groupName: string): void {
        this.expandedGroups.has(groupName)
            ? this.expandedGroups.delete(groupName)
            : this.expandedGroups.add(groupName);
    }

    // Check if group is expanded
    public isGroupExpanded(groupName: string): boolean {
        return this.expandedGroups.has(groupName);
    }

    // Toggle individual permission selection
    public togglePermission(permissionName: string): void {
        const idx = this.selectedPermissions.indexOf(permissionName);
        idx > -1
            ? this.selectedPermissions.splice(idx, 1)
            : this.selectedPermissions.push(permissionName);
    }

    // Check if permission is selected
    public isPermissionSelected(permissionName: string): boolean {
        return this.selectedPermissions.includes(permissionName);
    }

    // Toggle all permissions in a group
    public toggleGroupPermissions(group: any): void {
        const groupPermissions = group.permissions.map((p: any) => p.name);
        const allSelected = groupPermissions.every((p: string) => this.isPermissionSelected(p));
        
        groupPermissions.forEach((p: string) => {
            const idx = this.selectedPermissions.indexOf(p);
            if (allSelected && idx > -1) {
                this.selectedPermissions.splice(idx, 1);
            } else if (!allSelected && idx === -1) {
                this.selectedPermissions.push(p);
            }
        });
    }

    // Check if all group permissions are selected
    public isGroupFullySelected(group: any): boolean {
        const groupPermissions = group.permissions.map((p: any) => p.name);
        return groupPermissions.length > 0 && groupPermissions.every((p: string) => this.isPermissionSelected(p));
    }

    // Check if some group permissions are selected
    public isGroupPartiallySelected(group: any): boolean {
        const groupPermissions = group.permissions.map((p: any) => p.name);
        const selectedCount = groupPermissions.filter((p: string) => this.isPermissionSelected(p)).length;
        return selectedCount > 0 && selectedCount < groupPermissions.length;
    }

    // Select or deselect all permissions
    public selectAllPermissions(): void {
        const allPermissions = this.permissions.flatMap(group => group.permissions.map((p: any) => p.name));
        if (this.selectedPermissions.length === allPermissions.length) {
            this.deselectAllPermissions();
        } else {
            this.selectedPermissions = [...allPermissions];
        }
    }

    // Deselect all permissions
    public deselectAllPermissions(): void {
        this.selectedPermissions = [];
    }

    // Check if all permissions are selected
    public isAllPermissionsSelected(): boolean {
        const allPermissions = this.permissions.flatMap(group => group.permissions.map((p: any) => p.name));
        return allPermissions.length > 0 && allPermissions.every((p: string) => this.isPermissionSelected(p));
    }

    // Check if some permissions are selected
    public isSomePermissionsSelected(): boolean {
        return this.selectedPermissions.length > 0 && !this.isAllPermissionsSelected();
    }

    // Get count of selected permissions in a group
    public getSelectedPermissionsCount(group: any): number {
        return group.permissions.filter((p: any) => this.isPermissionSelected(p.name)).length;
    }

    // --- Modal & Form Methods ---

    // Open add/edit role modal
    public openRoleModal(id: number): void {
        if (id > 0) {
            this.resetMainModal();
            this.mainModal.loading = true;
            this.mainModal.title = this.app.localize('Edit Role');
            this.mainModal.btnSaveText = this.app.localize('Update');
            this.mainModal.show = true;
            this.mainModal.isUpdate = true;
            
            this.http.get<any>(`/api/users/getrole/${id}`).subscribe({
                next: data => {
                    this.role = { ...data.roleData };
                    this.selectedPermissions = data.roleData.permissions || [];
                    this.mainModal.loading = false;
                },
                error: error => {
                    this.app.handleApiError(error);
                    this.resetMainModal();
                }
            });
        } else {
            this.resetMainModal();
            this.mainModal.title = this.app.localize('Add Role');
            this.mainModal.show = true;
        }
        history.pushState(null, '', `${window.location.pathname}`);
    }

    // Close role modal and reset state
    public closeMainModal(): void {
        this.resetMainModal();
        history.back();
    }

    // Reset modal and role state
    private resetMainModal(): void {
        this.role = {
            id: 0,
            roleName: '',
            description: '',
            defaultHome: 'home',
            isSystem: false
        };
        this.selectedPermissions = [];
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

    // Handle add/update role form submit
    public submitForm(form: NgForm): void {
        if (!form.valid) {
            this.mainModal.validated = true;
            return;
        }
        
        if (this.selectedPermissions.length === 0) {
            this.app.showErrorMessage(
                this.app.localize('Validation Error'),
                this.app.localize('Please select at least one permission for this role.')
            );
            return;
        }
        
        this.mainModal.submitted = true;
        
        const isUpdate = this.role.id > 0 && this.mainModal.isUpdate;
        const url = isUpdate
            ? `/api/users/updaterole/${this.role.id}`
            : '/api/users/createrole';
        
        const roleData = {
            ...this.role,
            permissions: this.selectedPermissions
        };
        
        const request$ = isUpdate
            ? this.http.put<any>(url, roleData)
            : this.http.post<any>(url, roleData);
        
        request$.subscribe({
            next: () => {
                const msg = isUpdate
                    ? this.app.localize('Role updated successfully.')
                    : this.app.localize('Role created successfully.');
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

    // --- Delete Methods ---

    // Show confirmation dialog before deleting role
    private confirmDeleteRole(id: number, roleName: string): void {
        const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${roleName}"</strong>?
        <br><small class="text-muted">${this.app.localize('Once deleted you will not able to recover this record.')}</small>`;
        
        this.app.confirmDialog(
            this.app.localize('Confirm Delete'),
            message,
            () => this.deleteRole(id),
            null,
            `<i class="ri-delete-bin-5-line me-1"></i>${this.app.localize('Delete')}`,
            `<i class="ri-close-line me-1"></i>${this.app.localize('Cancel')}`,
            'danger'
        );
    }

    // Delete role by id
    private deleteRole(id: number): void {
        const dialogId = this.app.showLoadingDialog(this.app.localize('Deleting...'));
        
        this.http.delete<any>(`/api/users/deleterole/${id}`).subscribe({
            next: (response) => {
                this.app.showSuccessMessage(this.app.localize('Success!'), response.message);
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