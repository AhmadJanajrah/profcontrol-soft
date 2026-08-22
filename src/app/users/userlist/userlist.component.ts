import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { NgForm } from '@angular/forms';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-userlist',
    templateUrl: './userlist.component.html',
	standalone: true,
	imports: [AppImports]
})
export class UserListComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger = new Subject<any>();

    // Filter options for users
    public filters = {
        roleId: null as number | null,
        status: null as number | null,
        submitted: false,
        validated: false,
    };

    // Dropdown data for filters
    public roles: any[] = [];
    public locations: any[] = [];
    public statusOptions = [
        { value: 1, label: 'Active' },
        { value: 2, label: 'Inactive' },
        { value: 3, label: 'Suspended' }
    ];

    public permissions: any = {};

    constructor(
        private http: HttpClient,
        private renderer: Renderer2,
        private elementRef: ElementRef,
        public app: AppService
    ) { 
        this.permissions = {
            canAdd: this.app.hasPermission('users.add'),
            canEdit: this.app.hasPermission('users.edit'),
            canDelete: this.app.hasPermission('users.delete'),
            canView: this.app.hasPermission('users.view')
        };
    }

    // Lifecycle hooks
    ngOnInit(): void {
        this.initDataTable();
        this.loadFilterData();
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
                zeroRecords: this.app.localize('No users found'),
                info: `<small>${this.app.localize('Showing')} _START_ ${this.app.localize('to')} _END_ ${this.app.localize('of')} _TOTAL_ ${this.app.localize('entries')}</small>`,
                infoEmpty: `<small>${this.app.localize('Showing')} 0 ${this.app.localize('to')} 0 ${this.app.localize('of')} 0 ${this.app.localize('entries')}</small>`,
                infoFiltered: `<small>(${this.app.localize('filtered from')} _MAX_ ${this.app.localize('total entries')})</small>`,
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
                { title: this.app.localize('#'), data: 'id', orderSequence: ['desc', 'asc'], width: '50px' },
                { 
                    title: this.app.localize('User'), 
                    data: 'fullName', 
                    orderSequence: ['asc', 'desc'],
                    render: (data: string, type: any, row: any) => this.renderProfileColumn(data, row)
                },
                { title: this.app.localize('Email'), data: 'email', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Role'), data: 'roleName', orderSequence: ['asc', 'desc'] },
                {
                    title: this.app.localize('Status'),
                    data: 'status',
                    orderSequence: ['asc', 'desc'],
                    render: (data: number, type: any, row: any) => this.renderStatusColumn(data, row)
                },
                { title: this.app.localize('Last Login'), data: 'lastLogin', orderable: false },
                {
                    title: this.app.localize('Action'),
                    data: null,
                    orderable: false,
                    width: '50px',
                    render: (data: any, type: any, row: any) => this.renderActionColumn(row)
                }
            ],
            columnDefs: [
                { targets: '_all', type: 'string' },
                { targets: [0, -3], className: 'dt-center' },
            ],
            layout: { 
                bottomEnd: { 
                    paging: { 
                        firstLast: false 
                    } 
                } 
            },
            ajax: (params: any, callback: any) => {
                const query = this.buildDataTableQuery(params);
                this.http.get<any>('/api/users/getusers', { params: query }).subscribe({
                    next: response => {
                        const formattedData = response.data.map((item: any) => this.formatUserRow(item));
                        this.filters.submitted = false;
                        this.filters.validated = false;
                        callback({
                            recordsTotal: response.recordsTotal,
                            recordsFiltered: response.recordsFiltered,
                            data: formattedData
                        });
                        // Load images after data is rendered
                        this.app.loadImages('[data-img="true"]');
                    },
                    error: error => {
                        this.app.handleApiError(error);
                        this.filters.submitted = false;
                        this.filters.validated = false;
                        callback({ 
                            recordsTotal: 0, 
                            recordsFiltered: 0, 
                            data: [] 
                        });
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

    // Build query params for DataTable server-side matching controller expectations
    private buildDataTableQuery(params: any): any {
        return {
            start: params.start.toString(),
            length: params.length.toString(),
            searchValue: params.search.value || '',
            sortColumn: params.order[0].column.toString(),
            sortDirection: params.order[0].dir || 'asc',
            roleId: this.filters.roleId?.toString() || '',
            status: this.filters.status?.toString() || ''
        };
    }

    // Format user row for DataTable
    private formatUserRow(data: any): any {
        return {
            ...data,
            profileImageUrl: data.profileImageUrl ? this.app.apiUrl(`/api/media/getthumbnailimage/users/${data.profileImageUrl}`) : 'assets/images/user.png',
            createdAt: this.app.formatDateTime(data.createdAt),
            updatedAt: this.app.formatDateTime(data.updatedAt),
            lastLogin: data.lastLogin ? this.app.formatDateTime(data.lastLogin) : '&mdash;',
            roleName: data.roleName || this.app.localize('No Role'),
            locationName: data.locationName || this.app.localize('No Location')
        };
    }

    // Render profile image column
    private renderProfileColumn(fullName: string, row: any): string {
        return `
        <div class="table-img-text">
            <img src="assets/images/user.png" data-img="true" data-url="${row.profileImageUrl}" alt="${row.fullName}" class="table-avatar"/>
            <div class="text-block">
                <span class="fw-semibold">${row.fullName}</span>
                <span class="text-muted small d-block">@${row.userName}</span>
            </div>
        </div>`;
    }

    // Render status column with badges and indicators
    private renderStatusColumn(status: number, row: any): string {
        const statuses: { [key: string]: { text: string; class: string } } = {
            '1': { text: this.app.localize('Active'), class: 'badge-primary' },
            '2': { text: this.app.localize('Inactive'), class: 'badge-danger' },
            '3': { text: this.app.localize('Suspended'), class: 'badge-warning' }
        };

        const { class: badgeClass, text: statusText } = statuses[String(status)] || 
            { text: this.app.localize('Unknown'), class: 'badge-light' };

        let statusHtml = `<span class="badge ${badgeClass}">${statusText}</span>`;

        return statusHtml;
    }

    // Render action column with dropdown menu
    private renderActionColumn(row: any): string {
        let actions = `
        <div class="dropdown">
            <button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="ri-more-fill"></i>
            </button>
            <div class="dropdown-menu dropdown-menu-end">
        `;
        
        // View action
        if (this.permissions.canView) {
            actions += `
            <a class="dropdown-item view-user" data-id="${row.id}" href="javascript:void(0);">
                <i class="ri-eye-line me-2"></i>${this.app.localize('View')}
            </a>
            `;
        }
        
        // Edit action
        if (this.permissions.canEdit) {
            actions += `
            <a class="dropdown-item edit-user" data-id="${row.id}" href="javascript:void(0);">
                <i class="ri-edit-2-line me-2"></i>${this.app.localize('Edit')}
            </a>
            `;
        }
        
        // Delete action (exclude super admin and system users)
        if (row.id !== 1 && this.permissions.canDelete) {
            actions += `
            <a class="dropdown-item text-danger delete-user" data-id="${row.id}" data-name="${row.userName}" href="javascript:void(0);">
                <i class="ri-delete-bin-6-line me-2"></i>${this.app.localize('Delete')}
            </a>
            `;
        }
        
        actions += `
            </div>
        </div>`;
        
        return actions;
    }

    // Attach event listeners for table actions
    private addTableEventListeners(): void {
        const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
        if (tableBody) {
            this.renderer.listen(tableBody, 'click', (event: Event) => {
                const target = event.target as Element;
                const viewButton = target.closest('.view-user');
                const editButton = target.closest('.edit-user');
                const deleteButton = target.closest('.delete-user');

                if (viewButton) {
                    const userId = parseInt(viewButton.getAttribute('data-id') || '0');
                    this.app.navigate(`/users/view/${userId}`);
                }

                if (editButton) {
                    const userId = parseInt(editButton.getAttribute('data-id') || '0');
                    this.app.navigate(`/users/edit/${userId}`);
                }

                if (deleteButton) {
                    const userId = parseInt(deleteButton.getAttribute('data-id') || '0');
                    const userName = deleteButton.getAttribute('data-name') || '';
                    this.confirmDeleteUser(userId, userName);
                }
            });
        }
    }

    // --- Filter Methods ---

    // Load filter dropdown data
    private loadFilterData(): void {
        this.http.get<any>('/api/users/getuserformdata').subscribe({
            next: (data) => {
                this.roles = data.roles || [];
                this.locations = data.locations || [];
                
                // Localize status options
                this.statusOptions.forEach(option => {
                    option.label = this.app.localize(option.label);
                });
            },
            error: (error) => this.app.handleApiError(error)
        });
    }

    // Apply filters and reload data
    public applyFilters(filterForm: NgForm): void {
        if (filterForm.valid) {
            this.filters.submitted = true;
            this.reloadDataTable(true);
        } else {
            this.filters.validated = true;
        }
    }

    // Reset filters to default
    public resetFilters(): void {
        this.filters = {
            roleId: null,
            status: null,
            submitted: false,
            validated: false
        };
        this.reloadDataTable(true);
    }

    // --- Delete Methods ---

    // Show confirmation dialog before deleting user
    private confirmDeleteUser(id: number, userName: string): void {
        const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${userName}"</strong>?
        <br><small class="text-muted">${this.app.localize('Once deleted you will not able to recover this record.')}</small>`;
        
        this.app.confirmDialog(
            this.app.localize('Confirm Delete'),
            message,
            () => this.deleteUser(id),
            null,
            `<i class="ri-delete-bin-5-line me-1"></i>${this.app.localize('Delete')}`,
            `<i class="ri-close-line me-1"></i>${this.app.localize('Cancel')}`,
            'danger'
        );
    }

    // Delete user by id
    private deleteUser(id: number): void {
		const dialogId = this.app.showLoadingDialog('Deleting...');
		this.http.delete<any>(`/api/users/deleteuser/${id}`).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('User deleted successfully.'));
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