import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-useraddedit',
    templateUrl: './useraddedit.component.html',
	standalone: true,
	imports: [AppImports]
})
export class UserAddEditComponent implements OnInit, OnDestroy {

    // Component state flags
    public isLoading = true;
    public isSubmitted = false;
    public isValidated = false;
    public isEditMode = false;

    // User data model
    public user: any = {};

    // Image handling
    public imageFile: File | null = null;
    public imagePreviewUrl: string | null = '';
    private deleteOldImage = false;

    // Dropdown data sources
    public roles: any[] = [];
    public locations: any[] = [];
    public selectedLocations: any[] = [];
    public availableDefaultLocations: any[] = [];
    public statusOptions = [
        { value: 1, label: 'Active' },
        { value: 2, label: 'Inactive' },
        { value: 3, label: 'Suspended' }
    ];
    public orderTypes = [
        { value: 1, label: 'Dine In' },
        { value: 2, label: 'Takeaway' },
        { value: 3, label: 'Handover' },
        { value: 4, label: 'Online' },
        { value: 5, label: 'Courier' }
    ];

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute,
        private router: Router,
        public app: AppService
    ) {
        this.orderTypes.forEach(option => {
            option.label = this.app.localize(option.label);
        });
        this.resetForm();
    }

    // Lifecycle hooks
    ngOnInit(): void {
        this.checkRouteParams();
    }

    ngOnDestroy(): void {
        // Cleanup object URLs if any
        if (this.imagePreviewUrl && this.imagePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(this.imagePreviewUrl);
        }
    }

    // --- Initialization Methods ---

    // Check route parameters and determine mode
    private checkRouteParams(): void {
        const userId = Number(this.route.snapshot.paramMap.get('id'));

        if (userId && userId > 0) {
            this.isEditMode = true;
            this.user.id = userId;
            this.loadUserData(userId);
        } else {
            this.isEditMode = false;
            this.loadFormData();
        }
    }

    // Reset user form model and validation state
    private resetForm(): void {
        this.user = {
            id: 0,
            fullName: '',
            userName: '',
            email: '',
            passwordHash: '',
            phone: '',
            roleId: null,
            userLocations: [],
            defaultLocationId: null,
            defOrderType: 1,
            profileImageUrl: '',
            status: 1,
            accessAllLocations: false,
            isTwoFactorEnabled: false,
            pin: ''
        };
        this.selectedLocations = [];
        this.availableDefaultLocations = [];
        this.isSubmitted = false;
        this.isValidated = false;
        this.imageFile = null;
        this.imagePreviewUrl = '';
        this.deleteOldImage = false;
    }

    // Load dropdown data for form
    private loadFormData(): void {
        this.http.get<any>('/api/users/getuserformdata').subscribe({
            next: (data) => {
                this.roles = data.roles || [];
                this.locations = data.locations || [];

                // Localize status options
                this.statusOptions.forEach(option => {
                    option.label = this.app.localize(option.label);
                });

                this.isLoading = false;
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.isLoading = false;
            }
        });
    }

    // Load user data for editing
    private loadUserData(userId: number): void {
        this.http.get<any>('/api/users/getuserformdata').subscribe({
            next: (formData) => {
                this.roles = formData.roles || [];
                this.locations = formData.locations || [];
                
                this.statusOptions.forEach(option => {
                    option.label = this.app.localize(option.label);
                });
                
                this.http.get<any>(`/api/users/getuser/${userId}`).subscribe({
                    next: (response) => {
                        this.user = response.user;
                        this.user.defOrderType = Number(this.user.defOrderType ?? this.user.DefOrderType) || 1;
                        this.selectedLocations = this.user.userLocations?.map((ul: any) => ul.locationId) || [];
                        this.updateAvailableDefaultLocations();
                        this.user.userLocations = this.selectedLocations.map(locationId => ({ locationId }));
                        
                        this.imagePreviewUrl = this.user.profileImageUrl ? this.app.apiUrl(`/api/media/getthumbnailimage/users/${this.user.profileImageUrl}`) : '';
                        this.app.loadImages('[data-form-img="true"]');

                        this.isLoading = false;
                    },
                    error: (error) => {
                        this.app.handleApiError(error);
                        this.isLoading = false;
                    }
                });
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.isLoading = false;
            }
        });
    }

    // --- Form Methods ---

    // Generate a random password
    public generatePassword(length: number = 6): void {
        const minLen = 6;
        const len = Math.max(length, minLen);
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$!%*#?&';

        let password = '';
        for (let i = 0; i < len; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            password += charset.charAt(randomIndex);
        }

        this.user.passwordHash = password;
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
        this.user.profileImageUrl = '';
        this.app.loadImages('[data-form-img="true"]');
    }

    // Update available default locations based on selected locations
    private updateAvailableDefaultLocations(): void {
        this.availableDefaultLocations = this.locations.filter(location => 
            this.selectedLocations.includes(location.id)
        );
    }

    // Handle location selection changes
    public onLocationSelectionChange(): void {
        this.user.userLocations = this.selectedLocations.map(locationId => ({ locationId }));
        this.updateAvailableDefaultLocations();
        if (!this.selectedLocations.includes(this.user.defaultLocationId)) {
            this.user.defaultLocationId = null;
        }
    }

    // Validate location requirements
    private validateLocationRequirements(): boolean {
        // Check if at least one location is selected
        if (!this.selectedLocations || this.selectedLocations.length === 0) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Please select at least one location.')
            );
            return false;
        }

        // Check if default location is selected
        if (!this.user.defaultLocationId) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Please select a default location.')
            );
            return false;
        }

        // Check if default location is in selected locations
        if (!this.selectedLocations.includes(this.user.defaultLocationId)) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Default location must be one of the selected locations.')
            );
            return false;
        }

        return true;
    }

    // Submit form for create/update
    public submitForm(form: NgForm): void {
        this.isValidated = true;

        if (!form.valid) {
            return;
        }

        // Validate location requirements
        if (!this.validateLocationRequirements()) {
            return;
        }

        // Additional validation for edit mode password
        if (this.isEditMode && this.user.passwordHash && this.user.passwordHash.length < 6) {
            this.app.showErrorMessage(
                this.app.localize('Validation Error'),
                this.app.localize('Password must be at least 6 characters long.')
            );
            return;
        }

        this.isSubmitted = true;

        // Prepare form data
        const formData = new FormData();
        formData.append('user.id', this.user.id.toString());
        formData.append('user.fullName', this.user.fullName || '');
        formData.append('user.userName', this.user.userName || '');
        formData.append('user.email', this.user.email || '');
        formData.append('user.phone', this.user.phone || '');
        formData.append('user.roleId', this.user.roleId?.toString() || '');
        formData.append('user.defaultLocationId', this.user.defaultLocationId?.toString() || '');
        formData.append('user.defOrderType', this.user.defOrderType?.toString() || '1');
        formData.append('user.status', this.user.status?.toString() || '1');
        formData.append('user.accessAllLocations', this.user.accessAllLocations?.toString() || 'false');
        formData.append('user.isTwoFactorEnabled', this.user.isTwoFactorEnabled?.toString() || 'false');

        // Add password if provided
        if (this.user.passwordHash) {
            formData.append('user.passwordHash', this.user.passwordHash);
        }

        // Add PIN if provided
        if (this.user.pin) {
            formData.append('user.pin', this.user.pin);
        }

        // Add locations
        this.selectedLocations.forEach((locationId: number, index: number) => {
            formData.append(`user.userLocations[${index}].id`, '0');
            formData.append(`user.userLocations[${index}].userId`, '0');
            formData.append(`user.userLocations[${index}].locationId`, locationId.toString());
        });

        // Add profile image if selected
        if (this.imageFile) {
            formData.append('profileImage', this.imageFile);
        }

        formData.append('deleteOldImage', this.deleteOldImage.toString());

        // Submit request
        const request$ = this.isEditMode
            ? this.http.put<any>(`/api/users/updateuser/${this.user.id}`, formData)
            : this.http.post<any>('/api/users/createuser', formData);

        request$.subscribe({
            next: (response) => {
                const message = this.isEditMode
                    ? this.app.localize('User updated successfully.')
                    : this.app.localize('User created successfully.');

                this.app.showSuccessMessage(this.app.localize('Success!'), message);
                
                if (!this.isEditMode) {
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
}