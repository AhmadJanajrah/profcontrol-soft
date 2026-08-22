import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-customeraddedit',
	templateUrl: './customeraddedit.component.html',
	standalone: true,
	imports: [AppImports]
})
export class CustomerAddEditComponent implements OnInit, OnDestroy {

	// Component state flags
	public isLoading = true;
	public isSubmitted = false;
	public isValidated = false;
	public isEditMode = false;

	// Customer data model
	public customer: any = {};

	// Dropdown data sources
	public customerTypes = [
		{ id: 'Regular', name: 'Regular' },
		{ id: 'VIP', name: 'VIP' },
		{ id: 'Corporate', name: 'Corporate' }
	];;

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) {
		this.customerTypes.forEach(type => {
			type.name = this.app.localize(type.name);
		});
		this.resetForm();
	}

	// Lifecycle hooks
	ngOnInit(): void {
		this.checkRouteParams();
	}

	ngOnDestroy(): void {
		// Any cleanup if needed
	}

	// --- Initialization Methods ---

	// Check route parameters and determine mode
	private checkRouteParams(): void {
		const customerId = Number(this.route.snapshot.paramMap.get('id'));

		if (customerId && customerId > 0) {
			this.isEditMode = true;
			this.customer.id = customerId;
			this.loadCustomerData(customerId);
		} else {
			this.isEditMode = false;
			this.isLoading = false;
		}
	}

	// Reset customer form model and validation state
	private resetForm(): void {
		this.customer = {
			id: 0,
			customerType: 'Regular',
			fullName: '',
			email: '',
			phone: '',
			address: '',
			city: '',
			state: '',
			country: '',
			postalCode: '',
			birthDate: null,
			notes: '',
			taxIdentificationNumber: '',
			isActive: true
		};
		this.isSubmitted = false;
		this.isValidated = false;
	}

	// Load existing customer data for editing
	private loadCustomerData(customerId: number): void {
		this.http.get<any>(`/api/customers/getcustomer/${customerId}`).subscribe({
			next: (response) => {
				const customerData = response.customer;

				this.customer = {
					id: customerData.id,
					customerType: customerData.customerType || 'Regular',
					fullName: customerData.fullName,
					email: customerData.email,
					phone: customerData.phone,
					address: customerData.address,
					city: customerData.city,
					state: customerData.state,
					country: customerData.country,
					postalCode: customerData.postalCode,
					birthDate: customerData.birthDate ? customerData.birthDate.split('T')[0] : null,
					notes: customerData.notes,
					taxIdentificationNumber: customerData.taxIdentificationNumber,
					isActive: customerData.isActive
				};

				this.isLoading = false;
			},
			error: (error) => {
				this.app.handleApiError(error);
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
			? `/api/customers/updatecustomer/${this.customer.id}`
			: '/api/customers/createcustomer';

		const request$ = this.isEditMode
			? this.http.put<any>(url, this.customer)
			: this.http.post<any>(url, this.customer);

		request$.subscribe({
			next: (response) => {
				const successMessage = this.isEditMode
					? this.app.localize('Customer updated successfully')
					: this.app.localize('Customer created successfully');

				this.app.showSuccessMessage(this.app.localize('Success!'), successMessage);
				if (this.isEditMode) {
					this.isSubmitted = false;
					this.isValidated = false;
				} else {
					this.resetForm();
				}
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
			? this.app.localize('Edit Customer')
			: this.app.localize('Add Customer');
	}
}