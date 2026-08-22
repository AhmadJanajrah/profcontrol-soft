import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppService } from '../../services/app.service';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-notifications',
    templateUrl: './notifications.component.html',
	standalone: true,
	imports: [AppImports]
})
export class NotificationsComponent implements OnInit, OnDestroy {
    @ViewChild('notificationContainer', { static: false }) notificationContainer!: ElementRef;

    // Loading states
    public isLoading = false;
    public isLoadingMore = false;
    public isMarkingAllRead = false;

    // Data properties (flat list, no interfaces)
    public notifications: any[] = [];

    // Pagination
    public pagination = {
        currentPage: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
    };

    // Detail modal
    public detailModal = {
        isVisible: false,
        isLoading: false,
        title: '',
        notification: null as any | null
    };

    // Destruction subject for cleanup
    private destroy$ = new Subject<void>();

    constructor(
        private http: HttpClient,
        public app: AppService
    ) {}

    ngOnInit(): void {
        this.loadNotifications();
		window.addEventListener('popstate', this.onPopState);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
		window.removeEventListener('popstate', this.onPopState);
    }

    public loadNotifications(): void {
        this.resetPagination();
        this.fetchNotifications();
    }

    public reloadNotifications(): void {
        this.loadNotifications();
    }

    public loadMoreNotifications(): void {
        if (!this.pagination.hasNextPage || this.isLoadingMore) {
            return;
        }

        this.pagination.currentPage++;
        this.isLoadingMore = true;
        this.fetchNotifications(true);
    }

    private fetchNotifications(append = false): void {
        if (!append) {
            this.isLoading = true;
        }

        const params = {
            page: this.pagination.currentPage.toString(),
            pageSize: this.pagination.pageSize.toString()
        };

        this.http.get<any>('/api/profile/getnotifications', { params })
            .pipe(
                takeUntil(this.destroy$),
                finalize(() => {
                    this.isLoading = false;
                    this.isLoadingMore = false;
                })
            )
            .subscribe({
                next: (response) => {
                    const newNotifications = response.notifications || [];

                    if (append) {
                        this.notifications = [...this.notifications, ...newNotifications];
                    } else {
                        this.notifications = newNotifications;
                    }

                    this.pagination = response.pagination || this.pagination;
                },
                error: (error) => {
                    this.app.handleApiError(error);
                }
            });
    }

    public resetDetailModal(){
        this.detailModal.isVisible = false;
        this.detailModal.isLoading = false;
        this.detailModal.title = this.app.localize('Notification Details');
        this.detailModal.notification = null;
    }

    public viewNotification(notification: any): void {
        this.detailModal.isVisible = true;
        this.detailModal.isLoading = true;

        this.http.get<any>(`/api/profile/getnotification/${notification.id}`)
            .pipe(
                takeUntil(this.destroy$),
                finalize(() => {
                    this.detailModal.isLoading = false;
                })
            )
            .subscribe({
                next: (response) => {
                    this.detailModal.notification = response.notification;

                    // Update notification in the list
                    const index = this.notifications.findIndex((n: any) => n.id === notification.id);
                    if (index !== -1 && !this.notifications[index].isRead) {
                        this.notifications[index].isRead = true;
                        this.notifications[index].readAt = response.notification.readAt;
                    }
                },
                error: (error) => {
                    this.closeDetailModal();
                    this.app.handleApiError(error);
                }
            });
		history.pushState(null, '', `${window.location.pathname}`);
    }

    public closeDetailModal(): void {
        this.resetDetailModal();
		history.back();
    }

    public markAllAsRead(): void {
        if (this.isMarkingAllRead) {
            return;
        }

        this.isMarkingAllRead = true;

        this.http.put('/api/profile/markallnotificationsread', {})
            .pipe(
                takeUntil(this.destroy$),
                finalize(() => {
                    this.isMarkingAllRead = false;
                })
            )
            .subscribe({
                next: () => {
                    this.notifications.forEach(notification => {
                        notification.isRead = true;
                        notification.readAt = new Date().toISOString();
                    });

                    this.app.showSuccessMessage(
                        this.app.localize('Success!'),
                        this.app.localize('All notifications marked as read.')
                    );
                },
                error: (error) => {
                    this.app.handleApiError(error);
                }
            });
    }

    public getNotificationIcon(notification: any): string {
        const title = (notification && notification.title) ? notification.title.toString().toLowerCase() : '';
        if (title.includes('order')) {
            return 'ri-shopping-cart-line';
        } else if (title.includes('payment')) {
            return 'ri-money-dollar-circle-line';
        } else if (title.includes('user')) {
            return 'ri-user-line';
        }
        return 'ri-notification-3-line';
    }

    private resetPagination(): void {
        this.pagination = {
            currentPage: 1,
            pageSize: 20,
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false
        };
    }

    public trackByNotificationId(index: number, notification: any): any {
        return notification.id;
    }

	// Handle browser back navigation for detail modal
	private onPopState = (): void => {
		if (this.detailModal.isVisible) this.resetDetailModal();
	};
}