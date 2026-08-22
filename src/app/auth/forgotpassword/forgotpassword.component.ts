import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'forgotpassword',
    templateUrl: './forgotpassword.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ForgotPasswordComponent {
    public isFormSubmitted = false;
    public isFormValidated = false;
    public isEmailSent = false;

    constructor(private http: HttpClient, public app: AppService) {
        document.getElementById('auth-back-button')?.classList.remove('d-none');
    }

    // submit forgot password form
    submitForm(form: NgForm) {
        this.isFormSubmitted = true;
        this.isFormValidated = true;
        if (form.valid) {
            this.http.post<any>('/api/auth/forgotpassword', form.value).subscribe({
                next: data => {
                    this.isFormSubmitted = false;
                    this.isFormValidated = false;
                    this.isEmailSent = true;
                },
                error: error => {
                    this.app.showErrorMessage(this.app.localize("Error!"), this.app.localize("Enter valid email address."));
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
