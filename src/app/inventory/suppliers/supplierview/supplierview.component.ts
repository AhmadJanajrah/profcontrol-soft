import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-supplierview',
	templateUrl: './supplierview.component.html',
	standalone: true,
	imports: [AppImports]
})
export class SupplierViewComponent implements OnInit {

	// State
	public loading = true;
	public supplier: any = null;

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) {}

	// Lifecycle
	ngOnInit(): void {
		const id = Number(this.route.snapshot.paramMap.get('id'));
		if (!id || id <= 0) {
			this.app.showErrorMessage(this.app.localize('Invalid Request'), this.app.localize('Invalid supplier ID provided.'));
			this.router.navigate(['/inventory/suppliers']);
			return;
		}
		this.loadSupplier(id);
	}

	// Data loader
	private loadSupplier(id: number): void {
		this.loading = true;
		this.http.get<any>(`/api/inventory/getsupplier/${id}`).subscribe({
			next: res => {
				this.supplier = res.supplier;
				this.loading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.router.navigate(['/inventory/suppliers']);
			}
		});
	}

	// --- Utility Methods ---

	// Get status badge class
	public getStatusBadgeClass(isActive: boolean): string {
		return isActive ? 'badge-primary' : 'badge-danger';
	}

	// Get status label
	public getStatusLabel(isActive: boolean): string {
		return isActive ? this.app.localize('Active') : this.app.localize('Inactive');
	}

	// Get rating stars HTML
	public getRatingStars(rating: number): string {
		if (!rating) return '';
		
		let stars = '';
		for (let i = 1; i <= 5; i++) {
			if (i <= rating) {
				stars += '<i class="ri-star-fill text-warning"></i>';
			} else {
				stars += '<i class="ri-star-line text-muted"></i>';
			}
		}
		return stars;
	}

	// Get full address
	public getFullAddress(): string {
		return this.app.formatAddress(
			this.supplier?.address,
			this.supplier?.city,
			this.supplier?.state,
			this.supplier?.postalCode,
			this.supplier?.country
		);
	}
}