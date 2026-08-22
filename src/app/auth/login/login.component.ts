import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'login',
    templateUrl: './login.component.html',
	standalone: true,
	imports: [AppImports]
})
export class LoginComponent {
    public isFormSubmitted = false;
    public isFormValidated = false;
    public isTwoFactorEnabled = false;
    public isTwoFactorEmailSent = false;
    private loginData = {
        email: '',
        password: '',
        passCode: '',
        isRemember: false,
    }
    constructor(private http: HttpClient, public app: AppService) {
        document.getElementById('auth-back-button')?.classList.add('d-none');
    }

    // submit login form
    submitForm(form: NgForm) {
        this.isFormSubmitted = true;
        this.isFormValidated = true;
        if (form.valid) {
            this.loginData.email = form.value.email;
            this.loginData.password = form.value.password;
            this.loginData.isRemember = form.value.isRemember == true ? true : false;
            // HTTP POST request to login endpoint
            this.http.post<any>('/api/auth/login', this.loginData).subscribe({
                next: data => {
                    if ('isEmailSent' in data) {
                        this.isTwoFactorEnabled = true;
                        this.isTwoFactorEmailSent = true;
                        this.isFormSubmitted = false;
                        this.isFormValidated = false;
                    }
                    else {
                        this.app.showSuccessMessage(this.app.localize("Success!"), this.app.localize("You have been successfully logged in."));
                        this.app.login(data);
                        this.isFormSubmitted = false;
                        this.isFormValidated = false;
                    }
                },
                error: error => {
                    this.app.showErrorMessage(this.app.localize("Error!"), this.app.localize("Enter valid credentials."));
                    this.isFormSubmitted = false;
                    this.isFormValidated = false;
                },
            });
        }
        else {
            this.isFormSubmitted = false;
        }
    }

    submitForm1(form: NgForm) {
        this.isFormSubmitted = true;
        this.isFormValidated = true;
        if (form.valid) {
            this.loginData.passCode = form.value.passCode;
            // HTTP POST request to login endpoint
            this.http.post<any>('/api/auth/login', this.loginData).subscribe({
                next: data => {
                    this.app.showSuccessMessage(this.app.localize("Success!"), this.app.localize("You have been successfully logged in."));
                    this.app.login(data);
                    this.isFormSubmitted = false;
                    this.isFormValidated = false;
                },
                error: error => {
                    this.app.showErrorMessage(this.app.localize("Error!"), this.app.localize("Enter valid pass code."));
                    this.isFormSubmitted = false;
                    this.isFormValidated = false;
                },
            });
        }
        else {
            this.isFormSubmitted = false;
        }
    }

    public resetPage() {
        this.isFormSubmitted = false;
        this.isFormValidated = false;
        this.isTwoFactorEnabled = false;
        this.isTwoFactorEmailSent = false;

        this.loginData = {
            email: '',
            password: '',
            passCode: '',
            isRemember: false,
        }
    }
}
