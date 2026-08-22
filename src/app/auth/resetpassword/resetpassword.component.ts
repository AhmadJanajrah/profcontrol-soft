import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { ActivatedRoute } from '@angular/router';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'resetpassword',
	templateUrl: './resetpassword.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ResetPasswordComponent {
	public isFormSubmitted = false;
	public isFormValidated = false;
	public token = '';
	public email = '';

	constructor(private http: HttpClient, public app: AppService, private route: ActivatedRoute) {
		// Subscribe to route parameter changes
		this.route.paramMap.subscribe(params => {
			// Get the 'token' and 'email' parameters from the URL
			const token = params.get('token');
			const email = params.get('email');

			if (token && email) {
				this.token = token;
				this.email = email;
			}
			else {
				window.location.href = '/app/auth/login';
			}
		});
	}

	// submit login form
	submitForm(form: NgForm) {
		this.isFormSubmitted = true;
		this.isFormValidated = true;
		const token = this.token;
		const email = this.email;
		if (form.valid) {
			this.http.post<any>('/api/auth/resetpassword', { ...form.value, token, email }).subscribe({
				next: data => {
					this.app.showSuccessMessage(this.app.localize("Success!"), this.app.localize("Password reset successfully."));
					this.app.redirect();
					this.isFormSubmitted = false;
					this.isFormValidated = false;
				},
				error: error => {
					this.app.showErrorMessage(this.app.localize("Error!"), this.app.localize("Enter valid passwords."));
					this.isFormSubmitted = false;
					this.isFormValidated = false;
				},
			});
		}
		else {
			this.isFormSubmitted = false;
		}
	}
}
