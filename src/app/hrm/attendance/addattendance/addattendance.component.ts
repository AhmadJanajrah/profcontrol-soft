import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-addattendance',
	templateUrl: './addattendance.component.html',
	standalone: true,
	imports: [AppImports]
})
export class AddAttendanceComponent implements OnInit {
	// Loading and submission state
	public isLoading = false;
	public isValidated = false;
	public isSubmitted = false;

	// Form fields
	public form = {
		shiftId: null as number | null,
		attendanceDate: '' as string
	};

	// Data sources
	public shifts: any[] = [];
	public employees: any[] = [];
	public statusOptions = [
		{ value: 1, label: 'Present' },
		{ value: 2, label: 'Absent' },
		{ value: 3, label: 'Leave' },
		{ value: 4, label: 'Late' },
		{ value: 5, label: 'Half Day' }
	];

	// Select-all
	public allSelected = false;

	constructor(
		private http: HttpClient,
		public app: AppService
	) {
		this.statusOptions.forEach(o => o.label = this.app.localize(o.label));
	}

	// Lifecycle
	ngOnInit(): void {
		this.isLoading = true;
		this.form.attendanceDate = this.app.currentHTMLDate();
		this.loadFormData();
	}

	// --- Data Loaders ---

	private loadFormData(): void {
		const locationId = this.app.getSelectedLocationId() || 0;
		this.http.get<any>('/api/hrm/getattendanceformdata', { params: { locationId: locationId.toString() } }).subscribe({
			next: res => {
				// Shifts with label for select
				this.shifts = (res.shifts || []).map((s: any) => ({
					id: s.id,
					shiftName: s.shiftName,
					startTime: s.startTime,
					endTime: s.endTime,
					displayName: `${s.shiftName}`
				}));
				this.isLoading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.isLoading = false;
			}
		});
	}

	// Load employees for selected shift
	private loadEmployees(): void {
		this.employees = [];
		if (!this.form.shiftId) return;

		const locationId = this.app.getSelectedLocationId() || 0;
		this.isLoading = true;

		this.http.get<any>('/api/hrm/getattendanceformdata', { params: { locationId: locationId.toString() } }).subscribe({
			next: res => {
				const selectedShift = (this.shifts || []).find(s => s.id === this.form.shiftId);
				const defaultIn = selectedShift?.startTime ? this.app.APITimeToHTMLTime(selectedShift.startTime) : '';
				const defaultOut = selectedShift?.endTime ? this.app.APITimeToHTMLTime(selectedShift.endTime) : '';

				const allEmployees = (res.employees || []) as any[];
				// Filter employees who have this shift assigned
				const filtered = allEmployees.filter(e =>
					(e.shifts || []).some((es: any) => es.id === this.form.shiftId)
				);

				this.employees = filtered.map(e => ({
					id: e.id,
					employeeName: e.employeeName,
					departmentName: e.departmentName,
					designationName: e.designationName,
					include: true,
					clockIn: defaultIn,
					clockOut: defaultOut,
					status: 1,
					notes: ''
				}));

				this.allSelected = this.employees.length > 0 && this.employees.every(x => x.include);
				this.isLoading = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.isLoading = false;
			}
		});
	}

	// --- UI Events ---

	public onShiftChange(): void {
		this.loadEmployees();
	}

	public toggleSelectAll(): void {
		this.employees.forEach(e => e.include = this.allSelected);
	}

	// --- Submission ---

	public submit(frm: NgForm): void {
		this.isValidated = true;

		if (!frm.valid || !this.form.shiftId || !this.form.attendanceDate) return;

		const selected = this.employees.filter(e => e.include);
		if (selected.length === 0) {
			this.app.showWarningMessage(this.app.localize('Error!'), this.app.localize('Please select at least one employee.'));
			return;
		}

		this.isSubmitted = true;

		const payload = {
			locationId: this.app.getSelectedLocationId() || 0,
			shiftId: this.form.shiftId,
			attendanceDate: this.app.HTMLDateToAPIDateTime(this.form.attendanceDate),
			attendanceRecords: selected.map(e => ({
				employeeId: e.id,
				clockIn: this.app.HTMLTimeToAPITime(e.clockIn || '00:00'),
				clockOut: this.app.HTMLTimeToAPITime(e.clockOut || '00:00'),
				status: e.status,
				notes: e.notes || ''
			}))
		};

		this.http.post<any>('/api/hrm/addattendance', payload).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Attendance saved successfully.'));
				this.isSubmitted = false;
				this.app.goBack();
			},
			error: err => {
				this.app.handleApiError(err);
				this.isSubmitted = false;
			}
		});
	}
}