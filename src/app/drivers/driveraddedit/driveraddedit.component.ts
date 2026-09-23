import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-driveraddedit',
	templateUrl: './driveraddedit.component.html',
	standalone: true,
	imports: [AppImports]
})
export class DriverAddEditComponent implements OnInit, OnDestroy {

	public isLoading = true;
	public isSubmitted = false;
	public isValidated = false;
	public isEditMode = false;

	public driver: any = {};

	public driverTypes = [
		{ id: 'Regular', name: 'Regular' },
		{ id: 'VIP', name: 'VIP' },
		{ id: 'Corporate', name: 'Corporate' }
	];

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) {
		this.driverTypes.forEach(type => {
			type.name = this.app.localize(type.name);
		});
		this.resetForm();
	}

	ngOnInit(): void {
		this.checkRouteParams();
	}

	ngOnDestroy(): void { }

	private checkRouteParams(): void {
		const driverId = Number(this.route.snapshot.paramMap.get('id'));

		if (driverId && driverId > 0) {
			this.isEditMode = true;
			this.driver.id = driverId;
			this.loadDriverData(driverId);
		} else {
			this.isEditMode = false;
			this.isLoading = false;
		}
	}

	private resetForm(): void {
		this.driver = {
			id: 0,
			driverType: 'Regular',
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

	private loadDriverData(driverId: number): void {
		this.http.get<any>(`/api/drivers/getdriver/${driverId}`).subscribe({
			next: (response) => {
				const driverData = response?.driver || response?.data || response;
				if (!driverData?.id && !driverData?.fullName) {
					this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Invalid driver ID provided.'));
					this.router.navigate(['/drivers/list']);
					return;
				}

				this.driver = {
					id: driverData.id,
					driverType: driverData.driverType || 'Regular',
					fullName: driverData.fullName,
					email: driverData.email,
					phone: driverData.phone,
					address: driverData.address,
					city: driverData.city,
					state: driverData.state,
					country: driverData.country,
					postalCode: driverData.postalCode,
					birthDate: driverData.birthDate ? String(driverData.birthDate).split('T')[0] : null,
					notes: driverData.notes,
					taxIdentificationNumber: driverData.taxIdentificationNumber,
					isActive: driverData.isActive
				};

				this.isLoading = false;
			},
			error: (error) => {
				this.app.handleApiError(error);
				this.router.navigate(['/drivers/list']);
			}
		});
	}

	public submitForm(form: NgForm): void {
		if (!form.valid) {
			this.isValidated = true;
			return;
		}

		this.isSubmitted = true;
		const url = this.isEditMode
			? `/api/drivers/updatedriver/${this.driver.id}`
			: '/api/drivers/createdriver';

		const request$ = this.isEditMode
			? this.http.put<any>(url, this.driver)
			: this.http.post<any>(url, this.driver);

		request$.subscribe({
			next: () => {
				const successMessage = this.isEditMode
					? this.app.localize('Driver updated successfully')
					: this.app.localize('Driver created successfully');

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

	public getPageTitle(): string {
		return this.isEditMode
			? this.app.localize('Edit Driver')
			: this.app.localize('Add Driver');
	}
}
