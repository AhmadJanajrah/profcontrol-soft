import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-supplieraddedit',
	templateUrl: './supplieraddedit.component.html',
	standalone: true,
	imports: [AppImports]
})
export class SupplierAddEditComponent implements OnInit {

	// Component state flags
	public isLoading = true;
	public isSubmitted = false;
	public isValidated = false;
	public isEditMode = false;

	// Supplier data model
	public supplier = {
		id: 0,
		supplierName: '',
		contactPerson: '',
		email: '',
		phone: '',
		address: '',
		city: '',
		state: '',
		country: '',
		postalCode: '',
		taxIdentificationNumber: '',
		paymentTerms: '',
		notes: '',
		rating: 5,
		isActive: true
	};

	// Rating options
	public ratingOptions = [
		{ value: 1, label: '1 Star' },
		{ value: 2, label: '2 Stars' },
		{ value: 3, label: '3 Stars' },
		{ value: 4, label: '4 Stars' },
		{ value: 5, label: '5 Stars' }
	];

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) {
		this.resetForm();
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.checkRouteParams();
	}

	// --- Initialization Methods ---

	// Check route parameters and determine mode
	private checkRouteParams(): void {
		const supplierId = Number(this.route.snapshot.paramMap.get('id'));

		if (supplierId && supplierId > 0) {
			this.isEditMode = true;
			this.supplier.id = supplierId;
			this.loadSupplierData(supplierId);
		} else {
			this.isEditMode = false;
			this.isLoading = false;
		}
	}

	// Reset supplier form model and validation state
	private resetForm(): void {
		this.supplier = {
			id: 0,
			supplierName: '',
			contactPerson: '',
			email: '',
			phone: '',
			address: '',
			city: '',
			state: '',
			country: '',
			postalCode: '',
			taxIdentificationNumber: '',
			paymentTerms: '',
			notes: '',
			rating: 5,
			isActive: true
		};
		this.isSubmitted = false;
		this.isValidated = false;
	}

	// Load existing supplier data for editing
	private loadSupplierData(supplierId: number): void {
		this.http.get<any>(`/api/inventory/getsupplier/${supplierId}`).subscribe({
			next: (response) => {
				const supplierData = response.supplier;
				this.supplier = {
					id: supplierData.id,
					supplierName: supplierData.supplierName,
					contactPerson: supplierData.contactPerson || '',
					email: supplierData.email || '',
					phone: supplierData.phone || '',
					address: supplierData.address || '',
					city: supplierData.city || '',
					state: supplierData.state || '',
					country: supplierData.country || '',
					postalCode: supplierData.postalCode || '',
					taxIdentificationNumber: supplierData.taxIdentificationNumber || '',
					paymentTerms: supplierData.paymentTerms || '',
					notes: supplierData.notes || '',
					rating: supplierData.rating || 0,
					isActive: supplierData.isActive
				};
				this.isLoading = false;
			},
			error: (error) => {
				this.app.handleApiError(error);
				history.back();
			}
		});
	}

	// --- Form Submission Methods ---

	// Handle form submission
	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.isValidated = true;
			return;
		}

		this.isSubmitted = true;

		const url = this.isEditMode
			? `/api/inventory/updatesupplier/${this.supplier.id}`
			: '/api/inventory/createsupplier';

		const request$ = this.isEditMode
			? this.http.put<any>(url, this.supplier)
			: this.http.post<any>(url, this.supplier);

		request$.subscribe({
			next: (response) => {
				const successMessage = this.isEditMode
					? this.app.localize('Supplier updated successfully.')
					: this.app.localize('Supplier created successfully.');

				this.app.showSuccessMessage(this.app.localize('Success!'), successMessage);
				
				if(!this.isEditMode){
					this.resetForm();
				}
				this.isSubmitted = false;
				this.isValidated = false;
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.isSubmitted = false;
			}
		});
	}

	// --- Utility Methods ---

	// Get page title
	public getPageTitle(): string {
		return this.isEditMode
			? this.app.localize('Edit Supplier')
			: this.app.localize('Add Supplier');
	}

	// Get rating display text
	public getRatingText(rating: number): string {
		const option = this.ratingOptions.find(r => r.value === rating);
		return option ? this.app.localize(option.label) : '';
	}
}