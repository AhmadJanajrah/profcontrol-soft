import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-employeeview',
	templateUrl: './employeeview.component.html',
	standalone: true,
	imports: [AppImports]
})
export class EmployeeViewComponent implements OnInit {

	// State
	public employee: any = {};
	public loading = true;

	// Documents
	public documents: any[] = [];
	public loadingDocuments = false;

	// Salary Components
	public salaryComponents: any[] = [];
	public loadingSalaryComponents = false;

	constructor(
		private http: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public app: AppService
	) {}

	// Lifecycle
	ngOnInit(): void {
		const employeeId = this.route.snapshot.params['id'];
		if (employeeId) {
			this.loadEmployee(parseInt(employeeId, 10));
		} else {
			this.router.navigate(['/hrm/employees']);
		}
	}

	// --- Data Loaders ---

	// Load employee details
	private loadEmployee(id: number): void {
		this.loading = true;
		this.http.get<any>(`/api/hrm/getemployee/${id}`).subscribe({
			next: response => {
				this.employee = response.employee;
				this.app.loadImages?.('img[data-img="true"]');
				this.loading = false;

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

	// Load employee documents
	private loadDocuments(): void {
		this.loadingDocuments = true;
		this.http.get<any>('/api/hrm/getemployeedocuments', {
			params: {
				employeeId: (this.employee.id || 0).toString()
			}
		}).subscribe({
			next: response => {
				this.documents = response.data || [];
				this.loadingDocuments = false;
			},
			error: error => {
				this.app.handleApiError(error);
				this.loadingDocuments = false;
			}
		});
	}

	// Load salary components
	private loadSalaryComponents(): void {
		this.loadingSalaryComponents = true;
		this.http.get<any>('/api/hrm/getemployeesalarycomponents', {
			params: {
				employeeId: (this.employee.id || 0).toString()
			}
		}).subscribe({
			next: response => {
				this.salaryComponents = response.data || [];
				this.loadingSalaryComponents = false;
			},
			error: error => {
				this.app.handleApiError(error);
				this.loadingSalaryComponents = false;
			}
		});
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

	// --- Helpers ---

	// Get file size in readable format
	public getFileSize(sizeKb: number): string {
		if (sizeKb < 1024) return `${sizeKb} KB`;
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

	// Get profile image URL
	public getProfileImageUrl(): string {
		return this.employee.profileImageUrl
			? this.app.apiUrl(`/api/media/getthumbnailimage/employees/${this.employee.profileImageUrl}`)
			: 'assets/images/user.png';
	}

	// Get payroll type label
	public getPayrollTypeLabel(type: number): string {
		return type === 1 ? this.app.localize('Monthly') : this.app.localize('Hourly');
	}

	// Get status badge class
	public getStatusBadgeClass(isActive: boolean): string {
		return isActive ? 'badge-primary' : 'badge-light';
	}

	// Get status label
	public getStatusLabel(isActive: boolean): string {
		return isActive ? this.app.localize('Active') : this.app.localize('Inactive');
	}
}