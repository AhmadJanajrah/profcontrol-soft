import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-myprofile',
	templateUrl: './myprofile.component.html',
	standalone: true,
	imports: [AppImports]
})
export class MyProfileComponent implements OnInit {
	public profile: any = {
		id: 0,
		fullName: '',
		userName: '',
		email: '',
		phone: '',
		profileImageUrl: '',
		isTwoFactorEnabled: false,
		roleName: '',
		defaultLocationName: ''
	};

	public activeTab: 'profile' | 'security' = 'profile';

	// Image handling
	public imageFile: File | null = null;
	public imagePreviewUrl: string | null = '';
	private deleteOldImage = false;

	// Form states
	public profileSubmitting = false;
	public profileValidated = false;
	public pwdSubmitting = false;
	public pwdValidated = false;

	public passwordForm = {
		oldPassword: '',
		newPassword: '',
		confirmNewPassword: ''
	};

	constructor(private http: HttpClient, public app: AppService) { }

	ngOnInit(): void {
		this.loadProfile();
	}

	public selectTab(tab: 'profile' | 'security'): void {
		this.activeTab = tab;
	}

	// API: GetProfile
	public loadProfile(): void {
		this.http.get<any>('/api/profile/getprofile').subscribe({
			next: res => {
				const p = res?.profile;
				if (p) {
					this.profile = {
						id: p.id,
						fullName: p.fullName || '',
						userName: p.userName || '',
						email: p.email || '',
						phone: p.phone || '',
						profileImageUrl: p.profileImageUrl || '',
						isTwoFactorEnabled: p.isTwoFactorEnabled || false,
						roleName: p.roleName || '',
						defaultLocationName: p.defaultLocationName || ''
					};
					this.imagePreviewUrl = this.profile.profileImageUrl ? this.app.apiUrl(`/api/media/getthumbnailimage/users/${this.profile.profileImageUrl}`) : '';
					this.app.loadImages('[data-form-img="true"]');
				}
			},
			error: err => this.app.handleApiError(err)
		});
	}

	// File selection
	public onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		if (!input?.files?.length) return;
		const f = input.files[0];
		if (!this.validateImageFile(f)) return;
		this.imageFile = f;
		this.imagePreviewUrl = URL.createObjectURL(f);
		this.deleteOldImage = false;
		this.app.loadImages('[data-form-img="true"]');
	}

	private validateImageFile(file: File): boolean {
		const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
		const maxMB = 5;
		if (!allowed.includes(file.type)) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Please select a valid image file (JPG, PNG, GIF, WebP).'));
			return false;
		}
		if (file.size > maxMB * 1024 * 1024) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('File size too large.'));
			return false;
		}
		return true;
	}

	public clearImage(): void {
		this.imageFile = null;
		this.imagePreviewUrl = '';
		this.deleteOldImage = true;
		// clear input element if present
		const inp = document.getElementById('profileImage') as HTMLInputElement;
		if (inp) inp.value = '';
		this.profile.profileImageUrl = '';
		this.app.loadImages('[data-form-img="true"]');
	}

	// Submit profile update
	public submitProfile(form: NgForm): void {
		if (!form.valid) {
			this.profileValidated = true;
			return;
		}
		this.profileSubmitting = true;

		const formData = new FormData();
		formData.append('fullName', this.profile.fullName || '');
		formData.append('email', this.profile.email || '');
		formData.append('phone', this.profile.phone || '');
		if (this.imageFile) {
			formData.append('profileImage', this.imageFile);
		}

		formData.append('deleteOldImage', this.deleteOldImage.toString());

		this.http.put<any>('/api/profile/updateprofile', formData).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Profile updated successfully.'));
				this.profileSubmitting = false;
				this.loadProfile();
			},
			error: err => {
				this.app.handleApiError(err);
				this.profileSubmitting = false;
			}
		});
	}

	// Change password
	public changePassword(form: NgForm): void {
		if (!form.valid) {
			this.pwdValidated = true;
			return;
		}
		if (this.passwordForm.newPassword !== this.passwordForm.confirmNewPassword) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Passwords do not match.'));
			return;
		}
		this.pwdSubmitting = true;
		const payload = {
			OldPassword: this.passwordForm.oldPassword,
			NewPassword: this.passwordForm.newPassword
		};
		this.http.post<any>('/api/profile/changepassword', payload).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Password changed successfully.'));
				this.pwdSubmitting = false;
				this.passwordForm.oldPassword = '';
				this.passwordForm.newPassword = '';
			},
			error: err => {
				this.app.handleApiError(err);
				this.pwdSubmitting = false;
			}
		});
	}

	// Toggle 2FA
	public toggleTwoFactor(): void {
		const prev = this.profile.isTwoFactorEnabled;
		// optimistic UI
		this.profile.isTwoFactorEnabled = !prev;
		this.http.post<any>('/api/profile/toggletwofactorauth', {}).subscribe({
			next: () => {
				const msg = this.profile.isTwoFactorEnabled ? this.app.localize('Two-factor enabled.') : this.app.localize('Two-factor disabled.');
				this.app.showSuccessMessage(this.app.localize('Success!'), msg);
			},
			error: err => {
				// rollback on error
				this.profile.isTwoFactorEnabled = prev;
				this.app.handleApiError(err);
			}
		});
	}
}