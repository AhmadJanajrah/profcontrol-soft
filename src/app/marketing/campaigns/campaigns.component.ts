import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';
import { AppService } from '../../services/app.service';
import { Router } from '@angular/router';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-campaigns',
    templateUrl: './campaigns.component.html',
	standalone: true,
	imports: [AppImports]
})
export class CampaignsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(DataTableDirective, { static: false }) dtElement!: DataTableDirective;

    // DataTable configuration and trigger
    public dtOptions: any;
    public dtTrigger: Subject<any> = new Subject();

    // Filters
    public filters = {
        channel: null as string | null,
        status: null as string | null,
        submitted: false,
        validated: false,
    };

    // Current campaign object (form model)
    public campaign: any = {};

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

    // Form data
    public formData = {
        customers: [] as any[]
    };

    // Channel and status options for filters and form
    public channelOptions: Array<{ value: string, label: string }> = [
        { value: 'Email', label: 'Email' },
        { value: 'SMS', label: 'SMS' }
    ];
    public statusOptions: Array<{ value: string, label: string }> = [
        { value: 'Scheduled', label: 'Scheduled' },
        { value: 'Running', label: 'Running' },
        { value: 'Completed', label: 'Completed' },
        { value: 'Cancelled', label: 'Cancelled' }
    ];

    constructor(
        private http: HttpClient,
        private renderer: Renderer2,
        private elementRef: ElementRef,
        private router: Router,
        public app: AppService
    ) {
        this.channelOptions.forEach(option => {
            option.label = this.app.localize(option.label);
        });
        this.statusOptions.forEach(option => {
            option.label = this.app.localize(option.label);
        });
        this.resetMainModal();
    }

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
                { title: this.app.localize('#'), data: 'id', orderSequence: ['desc', 'asc'], width: '50px' },
                { title: this.app.localize('Campaign Name'), data: 'campaignName', orderSequence: ['asc', 'desc'] },
                { title: this.app.localize('Channel'), data: 'channel', orderSequence: ['asc', 'desc'] },
                {
                    title: this.app.localize('Status'),
                    data: 'status',
                    orderSequence: ['asc', 'desc'],
                    render: (data: string) => this.renderStatusBadge(data)
                },
                { title: this.app.localize('Created At'), data: 'createdAt', orderable: false },
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
                { targets: [-1], className: 'dt-center' }
            ],
            layout: { bottomEnd: { paging: { firstLast: false } } },
            ajax: (params: any, callback: any) => {
                const query = this.buildDataTableQuery(params);
                this.http.get<any>('/api/campaigns/getcampaigns', { params: query }).subscribe({
                    next: response => {
                        const formattedData = (response.data || []).map((item: any) => ({
                            ...item,
                            createdAt: this.app.formatDateTime(item.createdAt),
                        }));
                        this.filters.submitted = false;
                        this.filters.validated = false;
                        callback({
                            recordsTotal: response.recordsTotal,
                            recordsFiltered: response.recordsFiltered,
                            data: formattedData
                        });
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

    private buildDataTableQuery(params: any): any {
        return {
            start: params.start,
            length: params.length,
            searchValue: params.search.value,
            sortColumn: params.order[0].column,
            sortDirection: params.order[0].dir,
            channel: this.filters.channel || '',
            status: this.filters.status || ''
        };
    }

    // --- Render helpers ---
    public renderStatusBadge(status: string): string {
        const statusClasses: { [key: string]: string } = {
            'Scheduled': 'badge-warning',
            'Running': 'badge-info',
            'Completed': 'badge-success',
            'Cancelled': 'badge-secondary'
        };

        const badgeClass = statusClasses[status] || 'badge-light';
        return `<span class="badge ${badgeClass}">${this.app.localize(status)}</span>`;
    }

    private renderActionColumn(row: any): string {
        let actions = `
        <button class="btn btn-icon btn-light btn-round btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="ri-more-fill"></i>
        </button>
        <div class="dropdown-menu dropdown-menu-end">
            <a class="dropdown-item view-messages" data-id="${row.id}" data-name="${row.campaignName}" href="javascript:void(0);">
                <i class="ri-message-2-line"></i>${this.app.localize('View')}
            </a>
        `;

        // Edit allowed for Scheduled
        if (row.status === 'Scheduled') {
            actions += `
            <a class="dropdown-item edit-campaign" data-id="${row.id}" href="javascript:void(0);">
                <i class="ri-edit-2-line"></i>${this.app.localize('Edit')}
            </a>
            `;
        }
        if (row.status === 'Scheduled' || row.status === 'Running') {
            actions += `
            <a class="dropdown-item cancel-campaign" data-id="${row.id}" data-name="${row.campaignName}" href="javascript:void(0);">
                <i class="ri-close-line"></i>${this.app.localize('Cancel')}
            </a>
            `;
        }
        actions += `
            <a class="dropdown-item text-danger delete-campaign" data-id="${row.id}" data-name="${row.campaignName}" href="javascript:void(0);">
                <i class="ri-delete-bin-6-line"></i>${this.app.localize('Delete')}
            </a>
            `;

        actions += '</div>';
        return actions;
    }

    // Attach event listeners for table actions
    private addTableEventListeners(): void {
        const tableBody = this.elementRef.nativeElement.querySelector('#dataTable tbody');
        if (tableBody) {
            this.renderer.listen(tableBody, 'click', (event: Event) => {
                const target = event.target as Element;
                const editButton = target.closest('.edit-campaign');
                const deleteButton = target.closest('.delete-campaign');
                const messagesButton = target.closest('.view-messages');
                const cancelButton = target.closest('.cancel-campaign');

                if (editButton) {
                    const campaignId = parseInt(editButton.getAttribute('data-id') || '0');
                    this.openMainModal(campaignId);
                }

                if (deleteButton) {
                    const campaignId = parseInt(deleteButton.getAttribute('data-id') || '0');
                    const campaignName = deleteButton.getAttribute('data-name') || '';
                    this.confirmDeleteCampaign(campaignId, campaignName);
                }

                if (messagesButton) {
                    const campaignId = parseInt(messagesButton.getAttribute('data-id') || '0');
                    this.router.navigate([`marketing/campaigns/${campaignId}/messages`]);
                }

                if (cancelButton) {
                    const campaignId = parseInt(cancelButton.getAttribute('data-id') || '0');
                    const campaignName = cancelButton.getAttribute('data-name') || '';
                    this.confirmCancelCampaign(campaignId, campaignName);
                }
            });
        }
    }

    // --- Filter Methods ---
    public applyFilters(filterForm: NgForm): void {
        if (filterForm.valid) {
            this.filters.submitted = true;
            this.reloadDataTable(true);
        } else {
            this.filters.validated = true;
        }
    }

    public resetFilters(): void {
        this.filters = {
            channel: null,
            status: null,
            submitted: false,
            validated: false
        };
        this.reloadDataTable(true);
    }

    // --- Modal Management Methods ---
    private resetMainModal(): void {
        this.campaign = {
            id: 0,
            campaignName: '',
            description: '',
            channel: '',
            startDate: '',   // HTML date: YYYY-MM-DD
            endDate: '',     // HTML date: YYYY-MM-DD
            timing: '',      // HTML time: HH:mm
            message: '',
            sendToAll: true,
            recipientIds: [] as number[]
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

    // Load form data (customers, channels, statuses)
    private loadFormData(): void {
        this.http.get<any>('/api/campaigns/getcampaignformdata').subscribe({
            next: response => {
                this.formData.customers = response.customers || [];
            },
            error: error => {
                this.app.handleApiError(error);
            }
        });
    }

    // Open campaign modal for add/edit
    public openMainModal(id: number): void {
        if (id > 0) {
            this.resetMainModal();
            this.mainModal.loading = true;
            this.mainModal.title = this.app.localize('Edit Campaign');
            this.mainModal.btnSaveText = this.app.localize('Update');
            this.mainModal.show = true;
            this.mainModal.isUpdate = true;

            this.http.get<any>(`/api/campaigns/getcampaign/${id}`).subscribe({
                next: data => {
                    const campaign = data.campaign;
                    this.campaign = {
                        id: campaign.id,
                        campaignName: campaign.campaignName,
                        description: campaign.description,
                        channel: campaign.channel,
                        startDate: campaign.startDate ? this.app.APIDateTimeToHTMLDate(campaign.startDate) : '',
                        endDate: campaign.endDate ? this.app.APIDateTimeToHTMLDate(campaign.endDate) : '',
                        timing: campaign.timing ? this.app.APITimeToHTMLTime(campaign.timing) : '',
                        message: campaign.message,
                        sendToAll: campaign.sendToAll,
                        recipientIds: campaign.campaignRecipients?.map((r: any) => r.customerId) || []
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
            this.mainModal.title = this.app.localize('Add Campaign');
            // Ensure default channel is set if options already loaded
            if (!this.campaign.channel && this.channelOptions.length > 0) {
                this.campaign.channel = this.channelOptions[0].value;
            }
            this.mainModal.show = true;
        }
        history.pushState(null, '', `${window.location.pathname}`);
    }

    // Close campaign modal
    public closeMainModal(): void {
        this.resetMainModal();
        try { history.back(); } catch { /* ignore */ }
    }

    // --- Form Submission Methods ---
    public submitForm(form: NgForm): void {
        if (!form.valid) {
            this.mainModal.validated = true;
            return;
        }

        this.mainModal.submitted = true;
        const isUpdate = this.campaign.id > 0 && this.mainModal.isUpdate;
        const url = isUpdate
            ? `/api/campaigns/updatecampaign/${this.campaign.id}`
            : '/api/campaigns/createcampaign';

        // Get message content based on channel
        let messageContent = this.campaign.message;
        if (this.campaign.channel === 'Email') {
            const emailBody = this.app.getSummernoteCode('#campaignMessage');
            messageContent = emailBody || this.campaign.message;
        }

        // Build payload to match CampaignRequest (server)
        const payload = {
            campaignName: this.campaign.campaignName,
            description: this.campaign.description,
            channel: this.campaign.channel,
            startDate: this.campaign.startDate ? `${this.campaign.startDate}T00:00:00` : null,
            endDate: this.campaign.endDate ? `${this.campaign.endDate}T00:00:00` : null,
            timing: this.campaign.timing ? `${this.campaign.timing}:00` : '00:00:00',
            message: messageContent,
            sendToAll: this.campaign.sendToAll,
            recipientIds: this.campaign.sendToAll ? [] : (this.campaign.recipientIds || [])
        };

        const request$ = isUpdate
            ? this.http.put<any>(url, payload)
            : this.http.post<any>(url, payload);

        request$.subscribe({
            next: () => {
                const msg = isUpdate
                    ? this.app.localize('Campaign updated successfully.')
                    : this.app.localize('Campaign created successfully.');
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
    private confirmDeleteCampaign(id: number, campaignName: string): void {
        const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${campaignName}"</strong>?<br>
        ${this.app.localize('Once deleted you will not able to recover this record.')}`;
        this.app.confirmDialog(
            this.app.localize('Confirm Delete'),
            message,
            () => this.deleteCampaign(id),
            null,
            `<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
            `<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
            'danger'
        );
    }

    private deleteCampaign(id: number): void {
        const dialogId = this.app.showLoadingDialog('Deleting...');
        this.http.delete<any>(`/api/campaigns/deletecampaign/${id}`).subscribe({
            next: () => {
                this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Campaign deleted successfully.'));
                this.reloadDataTable();
                this.app.closeLoadingDialog(dialogId);
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.app.closeLoadingDialog(dialogId);
            }
        });
    }

    private confirmCancelCampaign(id: number, campaignName: string): void {
        const message = `${this.app.localize('Are you sure you want to cancel')} <strong>"${campaignName}"</strong>?<br>
        ${this.app.localize('Once cancelled the campaign cannot be resumed.')}`;
        this.app.confirmDialog(
            this.app.localize('Confirm Cancel'),
            message,
            () => this.cancelCampaign(id),
            null,
            `<i class="ri-close-circle-line"></i>` + this.app.localize('Cancel Campaign'),
            `<i class="ri-close-line"></i>` + this.app.localize('Close'),
            'warning'
        );
    }

    private cancelCampaign(id: number): void {
        const dialogId = this.app.showLoadingDialog('Cancelling...');
        this.http.post<any>(`/api/campaigns/cancelcampaign/${id}`, {}).subscribe({
            next: () => {
                this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Campaign cancelled successfully.'));
                this.reloadDataTable();
                this.app.closeLoadingDialog(dialogId);
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.app.closeLoadingDialog(dialogId);
            }
        });
    }

    // Get default email template for summernote
    public getDefaultEmailTemplate(): string {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                <h2 style="color: #333; margin: 0;">[Company Name]</h2>
            </div>
            <div style="padding: 30px 20px;">
                <h3 style="color: #333;">Hello [Customer Name],</h3>
                <p style="color: #666; line-height: 1.6;">
                    We hope this message finds you well. We wanted to reach out to you with some exciting news!
                </p>
                <p style="color: #666; line-height: 1.6;">
                    [Your message content goes here]
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="#" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Learn More
                    </a>
                </div>
                <p style="color: #666; line-height: 1.6;">
                    Thank you for being a valued customer!
                </p>
                <p style="color: #666; line-height: 1.6;">
                    Best regards,<br>
                    The [Company Name] Team
                </p>
            </div>
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
                <p>This email was sent to [Customer Email]. If you no longer wish to receive these emails, you can <a href="#" style="color: #007bff;">unsubscribe</a>.</p>
            </div>
        </div>
        `;
    }

    // --- Window Event Handlers ---
    private onPopState = (): void => {
        if (this.mainModal.show) {
            this.closeMainModal();
        }
    };
}