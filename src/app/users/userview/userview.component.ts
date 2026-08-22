import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AppService } from '../../services/app.service';
import { Subject, takeUntil } from 'rxjs';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-userview',
	templateUrl: './userview.component.html',
	standalone: true,
	imports: [AppImports]
})
export class UserViewComponent implements OnInit, OnDestroy {
	// Component state
	public loading = true;
	public user: any = null;
	public userId: number = 0;

	// Subscription management
	private destroy$ = new Subject<void>();

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) { }

	// Lifecycle hooks
	ngOnInit(): void {
		this.initializeComponent();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	// --- Initialization Methods ---

	private initializeComponent(): void {
		this.validateRouteParams();
	}

	private validateRouteParams(): void {
		const userId = Number(this.route.snapshot.paramMap.get('id'));

		if (!userId || userId <= 0) {
			this.app.showErrorMessage(
				this.app.localize('Invalid Request'),
				this.app.localize('Invalid user ID provided.')
			);
			this.router.navigate(['/users/list']);
			return;
		}

		this.userId = userId;
		this.loadUserData();
	}

	private loadUserData(): void {
		this.loading = true;

		this.http.get<any>(`/api/users/getuser/${this.userId}`)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: (response) => {
					this.user = response.user;
					this.processUserData();
					this.loading = false;
					// Load images after DOM update
					setTimeout(() => this.app.loadImages('[data-img="true"]'), 100);
				},
				error: (error) => {
					this.loading = false;
					this.app.handleApiError(error);
					this.router.navigate(['/users/list']);
				}
			});
	}

	private processUserData(): void {
		if (!this.user) return;

		// Process profile image URL
		this.user.profileImageUrl = this.user.profileImageUrl
			? `/api/media/getthumbnailimage/users/${this.user.profileImageUrl}`
			: 'assets/images/user.png';
	}

	// --- Display Helper Methods ---

	public getLocationNames(): string {
		if (!this.user?.userLocations || this.user.userLocations.length === 0) {
			return this.app.localize('No locations assigned');
		}

		if (this.user.accessAllLocations) {
			return this.app.localize('All Locations');
		}

		return this.user.userLocations
			.map((ul: any) => ul.location?.locationName)
			.filter((name: string) => name)
			.join(', ');
	}

	public getStatusBadgeClass(): string {
		const statusClasses: { [key: string]: string } = {
			'1': 'badge-success',
			'2': 'badge-danger', 
			'3': 'badge-warning'
		};
		return statusClasses[String(this.user?.status)] || 'badge-light';
	}

	public getStatusLabel(): string {
		const statusLabels: { [key: string]: string } = {
			'1': this.app.localize('Active'),
			'2': this.app.localize('Inactive'),
			'3': this.app.localize('Suspended')
		};
		return statusLabels[String(this.user?.status)] || this.app.localize('Unknown');
	}

	public getOnlineStatusClass(): string {
		return (this.user?.status === 1 && this.user?.isOnline) ? 'text-success' : 'text-muted';
	}

	public getOnlineStatusIcon(): string {
		return (this.user?.status === 1 && this.user?.isOnline) ? 'ri-circle-fill' : 'ri-circle-line';
	}

	public getOnlineStatusLabel(): string {
		return (this.user?.status === 1 && this.user?.isOnline) 
			? this.app.localize('Online') 
			: this.app.localize('Offline');
	}

	public getTwoFactorStatusClass(): string {
		return this.user?.isTwoFactorEnabled ? 'text-success' : 'text-muted';
	}

	public getTwoFactorStatusIcon(): string {
		return this.user?.isTwoFactorEnabled ? 'ri-shield-check-line' : 'ri-shield-line';
	}

	public getTwoFactorStatusLabel(): string {
		return this.user?.isTwoFactorEnabled 
			? this.app.localize('Enabled') 
			: this.app.localize('Disabled');
	}

	public getAccessTypeBadgeClass(): string {
		return this.user?.accessAllLocations ? 'badge-warning' : 'badge-info';
	}

	public getAccessTypeLabel(): string {
		return this.user?.accessAllLocations 
			? this.app.localize('All Locations')
			: this.app.localize('Specific Locations');
	}

	public getSystemUserBadgeClass(): string {
		return this.user?.isSystemUser ? 'badge-warning' : 'badge-light';
	}

	public getSystemUserLabel(): string {
		return this.user?.isSystemUser 
			? this.app.localize('Yes') 
			: this.app.localize('No');
	}

	public getLastLoginFormatted(): string {
		return this.user?.lastLogin 
			? this.app.formatDateTime(this.user.lastLogin)
			: this.app.localize('Never');
	}

	public getFullAddress(): string {
		// For future enhancement if address fields are added to user model
		return this.app.localize('Not specified');
	}
}