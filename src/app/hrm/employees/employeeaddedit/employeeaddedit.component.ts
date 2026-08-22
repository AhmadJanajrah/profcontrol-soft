import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-employeeaddedit',
	templateUrl: './employeeaddedit.component.html',
	standalone: true,
	imports: [AppImports]
})
export class EmployeeAddEditComponent implements OnInit {
	// State
	public isEditMode = false;
	public isLoading = false;
	public isValidated = false;
	public isSubmitted = false;

	// Form model
	public employee: any = {
		id: 0,
		locationId: 0,
		departmentId: null as number | null,
		designationId: null as number | null,
		employeeName: '',
		phoneNumber: '',
		contactNumber: '',
		email: '',
		hireDate: '',
		terminationDate: null as string | null,
		nationalId: '',
		dateOfBirth: null as string | null,
		gender: null as string | null,
		maritalStatus: null as string | null,
		presentAddress: '',
		permanentAddress: '',
		payrollType: null as number | null, // Monthly=1, Hourly=2
		basicPay: '',
		taxInformation: '',
		bankName: '',
		branchName: '',
		swiftCode: '',
		iban: '',
		isActive: true,
		notes: '',
		profileImageUrl: '' as string | null
	};
	public selectedShifts: number[] = [];

	// Data sources
	public departments: any[] = [];
	public designations: any[] = [];
	public filteredDesignations: any[] = [];
	public shifts: any[] = [];

	// Options
	public genderOptions = [
		{ value: 'Male', label: 'Male' },
		{ value: 'Female', label: 'Female' },
		{ value: 'Other', label: 'Other' }
	];
	public maritalStatusOptions = [
		{ value: 'Single', label: 'Single' },
		{ value: 'Married', label: 'Married' },
		{ value: 'Divorced', label: 'Divorced' },
		{ value: 'Widowed', label: 'Widowed' }
	];
	public payrollTypeOptions = [
		{ value: 1, label: 'Monthly' },
		{ value: 2, label: 'Hourly' }
	];

	// Upload controls (profile image)
	public selectedFile: File | null = null;
	public imagePreviewUrl: string | null = null;
	private deleteOldImage = false;

	// Documents tab state
	public documents = {
		loading: false,
		uploading: false,
		selectedFile: null as File | null,
		fileName: '' as string,
		documentType: null as null | string,
		documents: [] as any[],
		documentTypes: [
			'ID Card',
			'Resume',
			'Contract',
			'Certificate',
			'Photo',
			'Tax Documents',
			'Bank Details',
			'Emergency Contact',
			'Medical Records',
			'Other'
		]
	};

	// Salary components tab state
	public salary = {
		loading: false,
		submitted: false,
		validated: false,
		availableComponents: [] as any[],
		components: [] as any[],
		newComponent: {
			salaryComponentId: null as number | null,
			value: '',
			isPercentage: false,
			effectiveFrom: '' as string,
			effectiveTo: null as string | null
		}
	};

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) {
		this.genderOptions.forEach(o => o.label = this.app.localize(o.label));
		this.maritalStatusOptions.forEach(o => o.label = this.app.localize(o.label));
		this.payrollTypeOptions.forEach(o => o.label = this.app.localize(o.label));
	}

	// Lifecycle
	ngOnInit(): void {
		const id = parseInt(this.route.snapshot.params['id'] || '0', 10);
		this.isEditMode = id > 0;
		this.employee.locationId = this.app.getSelectedLocationId() || 0;
		this.isLoading = true;

		this.loadFormData().then(() => {
			if (this.isEditMode) {
				this.loadEmployee(id);
			} else {
				this.employee.hireDate = this.app.currentHTMLDate();
				this.isLoading = false;
			}
		});
	}

	// --- Form Data Methods ---

	private async loadFormData(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.http.get<any>('/api/hrm/getemployeeformdata').subscribe({
				next: response => {
					this.departments = response.departments || [];
					this.designations = response.designations || [];
					this.shifts = response.shifts || [];
					this.filteredDesignations = this.designations;
					// available salary components for tab
					this.salary.availableComponents = response.salaryComponents || [];
					resolve();
				},
				error: error => {
					this.app.handleApiError(error);
					resolve();
				}
			});
		});
	}

	// Reset form to initial state
	public resetForm(): void {
		this.employee = {
			id: 0,
			locationId: this.app.getSelectedLocationId() || 0,
			departmentId: null,
			designationId: null,
			employeeName: '',
			phoneNumber: '',
			contactNumber: '',
			email: '',
			hireDate: this.app.currentHTMLDate(),
			terminationDate: null,
			nationalId: '',
			dateOfBirth: null,
			gender: null,
			maritalStatus: null,
			presentAddress: '',
			permanentAddress: '',
			payrollType: null,
			basicPay: '',
			taxInformation: '',
			bankName: '',
			branchName: '',
			swiftCode: '',
			iban: '',
			isActive: true,
			notes: '',
			profileImageUrl: null
		};

		this.selectedShifts = [];
		this.selectedFile = null;
		this.imagePreviewUrl = null;
		this.deleteOldImage = false;
		this.isValidated = false;
		this.isSubmitted = false;

		this.app.loadImages?.('[data-form-img="true"]');
	}

	// Load employee details for edit
	private loadEmployee(id: number): void {
		this.http.get<any>(`/api/hrm/getemployee/${id}`).subscribe({
			next: response => {
				const e = response.employee;
				this.employee = {
					id: e.id,
					locationId: e.locationId,
					departmentId: e.departmentId,
					designationId: e.designationId,
					employeeName: e.employeeName,
					phoneNumber: e.phoneNumber,
					contactNumber: e.contactNumber,
					email: e.email,
					hireDate: this.app.APIDateTimeToHTMLDate(e.hireDate),
					terminationDate: e.terminationDate ? this.app.APIDateTimeToHTMLDate(e.terminationDate) : null,
					nationalId: e.nationalId,
					dateOfBirth: e.dateOfBirth ? this.app.APIDateTimeToHTMLDate(e.dateOfBirth) : null,
					gender: e.gender,
					maritalStatus: e.maritalStatus,
					presentAddress: e.presentAddress,
					permanentAddress: e.permanentAddress,
					payrollType: e.payrollType,
					basicPay: this.app.apiNumberToLocale(e.basicPay),
					taxInformation: e.taxInformation,
					bankName: e.bankName,
					branchName: e.branchName,
					swiftCode: e.swiftCode,
					iban: e.iban,
					isActive: e.isActive,
					notes: e.notes,
					profileImageUrl: e.profileImageUrl
				};
				this.selectedShifts = (e.employeeShifts || []).map((x: any) => x.shiftId);
				this.filterDesignations();
				this.isLoading = false;

				// Image
				this.imagePreviewUrl = this.employee.profileImageUrl
					? `/api/media/getthumbnailimage/employees/${this.employee.profileImageUrl}`
					: '';
				this.deleteOldImage = false;
				this.selectedFile = null;
				this.app.loadImages?.('[data-form-img="true"]');

				// Load tabs data
				this.loadDocuments();
				this.loadSalaryComponents();
			},
			error: error => {
				this.app.handleApiError(error);
				this.router.navigate(['/hrm/employees']);
			}
		});
	}

	// Filter designations when department changes
	public onDepartmentChange(): void {
		this.filterDesignations();
		if (!this.filteredDesignations.some(d => d.id === this.employee.designationId)) {
			this.employee.designationId = null;
		}
	}

	private filterDesignations(): void {
		if (this.employee.departmentId) {
			this.filteredDesignations = this.designations.filter(d => d.departmentId === this.employee.departmentId);
		} else {
			this.filteredDesignations = this.designations;
		}
	}

	// --- Profile Image Handlers ---

	public onFileInputChange(event: any): void {
		const file = event.target.files?.[0] as File | undefined;
		if (!file) return;
		this.selectedFile = file;
		this.deleteOldImage = false;
		this.imagePreviewUrl = URL.createObjectURL(file);
		this.app.loadImages?.('[data-form-img="true"]');
	}

	public clearImage(): void {
		this.selectedFile = null;
		this.deleteOldImage = true;
		this.employee.profileImageUrl = null;
		this.imagePreviewUrl = '';
		this.app.loadImages?.('[data-form-img="true"]');
	}

	// --- Documents Tab Methods ---

	private loadDocuments(): void {
		if (!this.employee.id) return;
		this.documents.loading = true;
		this.http.get<any>('/api/hrm/getemployeedocuments', {
			params: {
				employeeId: this.employee.id.toString(),
			}
		}).subscribe({
			next: res => {
				this.documents.documents = res.data || [];
				this.documents.loading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.documents.loading = false;
			}
		});
	}

	public onDocumentFileSelected(event: any): void {
		const allowedFormats = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'image/jpg', 'image/jpeg', 'image/png'];
		const file = event.target.files?.[0] as File | undefined;
		if (!file) return;
		if (file.size > 5 * 1024 * 1024) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('File size too large.'));
			return;
		}
		if (!allowedFormats.includes(file.type)) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Invalid file format.'));
			return;
		}
		this.documents.selectedFile = file;
		this.documents.fileName = file.name;
	}

	public uploadDocument(): void {
		if (!this.employee.id) return;
		if (!this.documents.selectedFile || !this.documents.documentType) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Please select a file and document type.'));
			return;
		}
		this.documents.uploading = true;

		const fd = new FormData();
		fd.append('EmployeeId', this.employee.id.toString());
		fd.append('LocationId', (this.employee.locationId || 0).toString());
		fd.append('DocumentType', this.documents.documentType);
		fd.append('DocumentFile', this.documents.selectedFile);

		this.http.post<any>('/api/hrm/uploademployeedocument', fd).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Document uploaded successfully.'));
				this.documents.selectedFile = null;
				this.documents.documentType = null;
				this.documents.fileName = '';
				this.loadDocuments();
				this.documents.uploading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.documents.uploading = false;
			}
		});
	}

	public deleteDocument(doc: any): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${doc.documentName}"</strong>?`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => {
				this.http.delete<any>(`/api/hrm/deleteemployeedocument/${doc.id}`).subscribe({
					next: () => {
						this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Document deleted successfully.'));
						this.loadDocuments();
					},
					error: error => this.app.handleApiError(error)
				});
			}
		);
	}

	public downloadDocument(doc: any): void {
		this.http.get(`/api/hrm/downloademployeedocument/${doc.id}`, {
			responseType: 'blob'
		}).subscribe({
			next: (data: Blob) => {
				const blob = new Blob([data], { type: data.type || 'application/octet-stream' });

				// Create a download link and simulate a click on it
				const downloadLink = window.document.createElement('a');
				const url = window.URL.createObjectURL(blob);
				downloadLink.href = url;
				downloadLink.download = doc.documentName || 'download';

				// Append the link to the body and trigger a click event
				window.document.body.appendChild(downloadLink);
				downloadLink.click();

				// Clean up the link and revoke the object URL
				window.document.body.removeChild(downloadLink);
				window.URL.revokeObjectURL(url);
			},
			error: (error) => {
				this.app.handleApiError(error);
			}
		});
	}

	// --- Salary Components Tab Methods ---

	public onSalaryComponentChange(component: any): void {
		const comp = this.salary.availableComponents.find(c => c.id === component?.id);
		if (comp && comp.defaultValue !== null && comp.defaultValue !== undefined) {
			this.salary.newComponent.value = this.app.apiNumberToLocale(comp.defaultValue);
			this.salary.newComponent.isPercentage = comp.isPercentage || false;
		} else {
			this.salary.newComponent.value = '';
			this.salary.newComponent.isPercentage = false;
		}
	}

	private loadSalaryComponents(): void {
		if (!this.employee.id) return;
		this.salary.loading = true;
		this.http.get<any>('/api/hrm/getemployeesalarycomponents', {
			params: {
				employeeId: this.employee.id.toString()
			}
		}).subscribe({
			next: res => {
				this.salary.components = res.data || [];
				this.salary.loading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.salary.loading = false;
			}
		});
	}

	public addSalaryComponent(form: NgForm): void {
		if (!this.employee.id) return;

		this.salary.validated = true;
		if (!form.valid || !this.salary.newComponent.salaryComponentId) return;

		this.salary.submitted = true;

		const ef = this.salary.newComponent.effectiveFrom;
		const et = this.salary.newComponent.effectiveTo;

		const payload = {
			employeeId: this.employee.id,
			locationId: this.employee.locationId || 0,
			salaryComponentId: this.salary.newComponent.salaryComponentId,
			value: this.app.localeToAPINumber(this.salary.newComponent.value),
			effectiveFrom: ef ? this.app.HTMLDateToAPIDateTime(ef) : '',
			effectiveTo: et ? this.app.HTMLDateToAPIDateTime(et) : null
		};

		this.http.post<any>('/api/hrm/createemployeesalarycomponent', payload).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Salary component added successfully.'));
				this.resetSalaryForm();
				this.loadSalaryComponents();
			},
			error: error => {
				this.app.handleApiError(error);
				this.salary.submitted = false;
			}
		});
	}

	public deleteSalaryComponent(component: any): void {
		const message = `${this.app.localize('Are you sure you want to delete')} <strong>"${component.salaryComponent?.componentName}"</strong>?<br>
		${this.app.localize('Once deleted you will not able to recover this record.')}`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			message,
			() => {
				this.http.delete<any>(`/api/hrm/deleteemployeesalarycomponent/${component.id}`).subscribe({
					next: () => {
						this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Salary component deleted successfully.'));
						this.loadSalaryComponents();
					},
					error: error => this.app.handleApiError(error)
				});
			}
		);
	}

	private resetSalaryForm(): void {
		this.salary.newComponent = {
			salaryComponentId: null,
			value: '',
			isPercentage: false,
			effectiveFrom: this.app.currentHTMLDate(),
			effectiveTo: null
		};
		this.salary.submitted = false;
		this.salary.validated = false;
	}

	// Get file size in readable format
	public getFileSize(sizeKb: number): string {
		if (sizeKb < 1024) return `${sizeKb.toFixed(1)} KB`;
		return `${(sizeKb / 1024).toFixed(1)} MB`;
	}

	// Get component type label
	public getComponentTypeLabel(type: number): string {
		return type === 1 ? this.app.localize('Earning') : this.app.localize('Deduction');
	}

	// Get component type badge class
	public getComponentTypeBadgeClass(type: number): string {
		return type === 1 ? 'badge-success' : 'badge-danger';
	}

	// --- Submission Methods ---

	private buildFormData(): FormData {
		const fd = new FormData();

		// Convert date/number fields
		const employeeData = {
			...this.employee,
			dateOfBirth: this.employee.dateOfBirth ? this.app.HTMLDateToAPIDateTime(this.employee.dateOfBirth) : '',
			hireDate: this.employee.hireDate ? this.app.HTMLDateToAPIDateTime(this.employee.hireDate) : '',
			terminationDate: this.employee.terminationDate ? this.app.HTMLDateToAPIDateTime(this.employee.terminationDate) : '',
			basicPay: this.app.localeToAPINumber(this.employee.basicPay)
		};

		// Append complex object
		Object.keys(employeeData).forEach(key => {
			const value = (employeeData as any)[key];
			fd.append(`employee.${key}`, value !== null && value !== undefined ? value.toString() : '');
		});

		// Shifts
		this.selectedShifts.forEach((id, idx) => fd.append(`ShiftIds[${idx}]`, id.toString()));

		// Image
		if (this.selectedFile) fd.append('profileImageFile', this.selectedFile);
		if (this.deleteOldImage) fd.append('deleteOldImage', 'true');

		return fd;
	}

	public submitForm(form: NgForm): void {
		this.isValidated = true;
		if (!form.valid || !this.selectedShifts.length || !this.employee.departmentId || !this.employee.designationId || !this.employee.payrollType) {
			return;
		}
		this.isSubmitted = true;

		const formData = this.buildFormData();
		const isUpdate = this.isEditMode && this.employee.id > 0;

		const request$ = isUpdate
			? this.http.put<any>(`/api/hrm/updateemployee/${this.employee.id}`, formData)
			: this.http.post<any>('/api/hrm/createemployee', formData);

		request$.subscribe({
			next: (res) => {
				const msg = isUpdate
					? this.app.localize('Employee updated successfully.')
					: this.app.localize('Employee created successfully.');
				this.app.showSuccessMessage(this.app.localize('Success!'), msg);
				
				if (!isUpdate) {
					this.resetForm();
				}
				this.isSubmitted = false;
				this.isValidated = false;
			},
			error: error => {
				this.app.handleApiError(error);
				this.isSubmitted = false;
			}
		});
	}
}