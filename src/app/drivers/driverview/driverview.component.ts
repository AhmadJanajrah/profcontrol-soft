import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-driverview',
	templateUrl: './driverview.component.html',
	standalone: true,
	imports: [AppImports]
})
export class DriverViewComponent implements OnInit {
	public loading = true;
	public driver: any = null;

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) { }

	ngOnInit(): void {
		const id = Number(this.route.snapshot.paramMap.get('id'));
		if (!id || id <= 0) {
			this.app.showErrorMessage(this.app.localize('Invalid Request'), this.app.localize('Invalid driver ID provided.'));
			this.router.navigate(['/drivers/list']);
			return;
		}
		this.loadDriver(id);
	}

	private loadDriver(id: number): void {
		this.loading = true;
		this.http.get<any>(`/api/drivers/getdriver/${id}`).subscribe({
			next: res => {
				this.driver = res?.driver || res?.data || res;
				this.loading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.router.navigate(['/drivers/list']);
			}
		});
	}

	public getStatusBadgeClass(isActive: boolean): string {
		return isActive ? 'badge-success' : 'badge-danger';
	}

	public getStatusLabel(isActive: boolean): string {
		return isActive ? this.app.localize('Active') : this.app.localize('Inactive');
	}

	public getDriverTypeLabel(): string {
		const t = this.driver?.driverType || '';
		switch (t) {
			case 'Regular': return this.app.localize('Regular');
			case 'VIP': return this.app.localize('VIP');
			case 'Corporate': return this.app.localize('Corporate');
			default: return t ? this.app.localize(t) : this.app.localize('Unknown');
		}
	}

	public getDriverTypeBadgeClass(): string {
		const t = this.driver?.driverType || '';
		switch (t) {
			case 'Regular': return 'badge-primary';
			case 'VIP': return 'badge-warning';
			case 'Corporate': return 'badge-info';
			default: return 'badge-light';
		}
	}

	public getLastVisitFormatted(): string {
		return this.driver?.lastVisitDate
			? this.app.formatDateTime(this.driver.lastVisitDate)
			: this.app.localize('Never');
	}

	public getLastPointsEarnedFormatted(): string {
		return this.driver?.lastPointsEarnedDate
			? this.app.formatDateTime(this.driver.lastPointsEarnedDate)
			: this.app.localize('Never');
	}

	public getLastPointsRedeemedFormatted(): string {
		return this.driver?.lastPointsRedeemedDate
			? this.app.formatDateTime(this.driver.lastPointsRedeemedDate)
			: this.app.localize('Never');
	}

	public getFullAddress(): string {
		return this.app.formatAddress(
			this.driver?.address,
			this.driver?.city,
			this.driver?.state,
			this.driver?.postalCode,
			this.driver?.country
		);
	}
}
