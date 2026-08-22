import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-customerview',
	templateUrl: './customerview.component.html',
	standalone: true,
	imports: [AppImports]
})
export class CustomerViewComponent implements OnInit {
	// State
	public loading = true;
	public customer: any = null;

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) { }

	// Lifecycle
	ngOnInit(): void {
		const id = Number(this.route.snapshot.paramMap.get('id'));
		if (!id || id <= 0) {
			this.app.showErrorMessage(this.app.localize('Invalid Request'), this.app.localize('Invalid customer ID provided.'));
			this.router.navigate(['/customers/list']);
			return;
		}
		this.loadCustomer(id);
	}

	// Data loader
	private loadCustomer(id: number): void {
		this.loading = true;
		this.http.get<any>(`/api/customers/getcustomer/${id}`).subscribe({
			next: res => {
				this.customer = res.customer;
				this.app.loadImages?.('img[data-img="true"]');
				this.loading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.router.navigate(['/customers/list']);
			}
		});
	}

	// Helpers

	public getStatusBadgeClass(isActive: boolean): string {
		return isActive ? 'badge-success' : 'badge-danger';
	}

	public getStatusLabel(isActive: boolean): string {
		return isActive ? this.app.localize('Active') : this.app.localize('Inactive');
	}

	public getCustomerTypeLabel(): string {
		const t = this.customer?.customerType || '';
		switch (t) {
			case 'Regular': return this.app.localize('Regular');
			case 'VIP': return this.app.localize('VIP');
			case 'Corporate': return this.app.localize('Corporate');
			default: return this.app.localize('Unknown');
		}
	}

	public getCustomerTypeBadgeClass(): string {
		const t = this.customer?.customerType || '';
		switch (t) {
			case 'Regular': return 'badge-primary';
			case 'VIP': return 'badge-warning';
			case 'Corporate': return 'badge-info';
			default: return 'badge-light';
		}
	}

	public getLastVisitFormatted(): string {
		return this.customer?.lastVisitDate
			? this.app.formatDateTime(this.customer.lastVisitDate)
			: this.app.localize('Never');
	}

	public getLastPointsEarnedFormatted(): string {
		return this.customer?.lastPointsEarnedDate
			? this.app.formatDateTime(this.customer.lastPointsEarnedDate)
			: this.app.localize('Never');
	}

	public getLastPointsRedeemedFormatted(): string {
		return this.customer?.lastPointsRedeemedDate
			? this.app.formatDateTime(this.customer.lastPointsRedeemedDate)
			: this.app.localize('Never');
	}

	public getFullAddress(): string {
		return this.app.formatAddress(
			this.customer?.address,
			this.customer?.city,
			this.customer?.state,
			this.customer?.postalCode,
			this.customer?.country
		);
	}
}