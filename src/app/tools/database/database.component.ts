import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { AppService } from '../../services/app.service';
import { NgForm } from '@angular/forms';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-database',
    templateUrl: './database.component.html',
	standalone: true,
	imports: [AppImports]
})
export class DatabaseComponent implements OnInit, OnDestroy {

    // Restore form state
    public restoreForm = {
        submitted: false,
        validated: false,
        loading: false
    };

    // Backup state
    public backupState = {
        loading: false
    };

    // File upload state for restore
    public selectedBackupFile: File | null = null;
    public selectedBackupFileName: string = '';
    public uploadProgress: number = 0;

    // Data import/export state (for future features)
    public dataExportState = {
        loading: false
    };

    public dataImportState = {
        loading: false,
        selectedFile: null as File | null,
        entityType: ''
    };

    constructor(
        private http: HttpClient,
        public app: AppService
    ) {}

    ngOnInit(): void {
        window.addEventListener('popstate', this.handleBack);
    }

    ngOnDestroy(): void {
        window.removeEventListener('popstate', this.handleBack);
    }

    // Handle browser back button
    private handleBack = (): void => {
        if (this.restoreForm.loading) {
            this.restoreForm.loading = false;
        }
        if (this.backupState.loading) {
            this.backupState.loading = false;
        }
    };

    // --- Database Backup Methods ---

    // Download database backup using controller BackupDatabase endpoint
    public downloadBackup(): void {
        this.backupState.loading = true;

        // Using exact controller endpoint
        this.http.get('/api/Tools/BackupDatabase', {
            responseType: 'blob',
            observe: 'response'
        }).subscribe({
            next: (response) => {
                this.backupState.loading = false;

                // Extract filename from Content-Disposition header or use default
                let filename = 'database_backup.bak';
                const contentDisposition = response.headers.get('Content-Disposition');
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    if (filenameMatch && filenameMatch[1]) {
                        filename = filenameMatch[1].replace(/['"]/g, '');
                    }
                }

                // Create download link
                const blob = response.body;
                if (blob) {
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);

                    this.app.showSuccessMessage(
                        this.app.localize('Success!'),
                        this.app.localize('Database backup downloaded successfully.')
                    );
                }
            },
            error: (error) => {
                this.backupState.loading = false;
                this.app.handleApiError(error);
            }
        });
    }

    // --- Database Restore Methods ---

    // Handle file input change for backup file selection
    public onFileInputChange(event: any): void {
        const file = event.target.files[0];
        if (file) {
            // Validate file type (.bak only as per controller)
            if (!file.name.toLowerCase().endsWith('.bak')) {
                this.app.showErrorMessage(
                    this.app.localize('Invalid File'),
                    this.app.localize('Only .bak files are supported.')
                );
                this.clearFileSelection();
                return;
            }

            // Validate file size (1GB limit as per controller)
            const maxSize = 1000 * 1024 * 1024; // 1GB
            if (file.size > maxSize) {
                this.app.showErrorMessage(
                    this.app.localize('File Too Large'),
                    this.app.localize('Backup file exceeds 1GB limit.')
                );
                this.clearFileSelection();
                return;
            }

            this.selectedBackupFile = file;
            this.selectedBackupFileName = file.name;
        } else {
            this.clearFileSelection();
        }
    }

    // Clear file selection
    public clearFileSelection(): void {
        this.selectedBackupFile = null;
        this.selectedBackupFileName = '';
        this.uploadProgress = 0;
        // Reset file input
        const fileInput = document.getElementById('backupFileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    // Submit restore form
    public submitRestoreForm(form: NgForm): void {
        if (form.valid && this.selectedBackupFile) {
            if (!this.selectedBackupFile.name.toLowerCase().endsWith('.bak')) {
                this.app.showErrorMessage(
                    this.app.localize('Invalid File'),
                    this.app.localize('Please select a valid .bak backup file.')
                );
                this.restoreForm.validated = true;
                return;
            }

            this.restoreForm.submitted = true;
            this.restoreForm.loading = true;
            this.uploadProgress = 0;
            this.restoreDatabase();
        } else {
            if (!this.selectedBackupFile) {
                this.app.showErrorMessage(
                    this.app.localize('No File Selected'),
                    this.app.localize('Please select a backup file to restore.')
                );
            }
            this.restoreForm.validated = true;
        }
    }

    // Restore database using controller RestoreDatabase endpoint
    private restoreDatabase(): void {
        if (!this.selectedBackupFile) {
            this.resetRestoreForm();
            return;
        }

        const formData = new FormData();
        formData.append('backupFile', this.selectedBackupFile);

        // Using exact controller endpoint
        this.http.post('/api/Tools/RestoreDatabase', formData, {
            reportProgress: true,
            observe: 'events'
        }).subscribe({
            next: (event) => {
                if (event.type === HttpEventType.UploadProgress && event.total) {
                    this.uploadProgress = Math.round((event.loaded / event.total) * 100);
                } else if (event.type === HttpEventType.Response) {
                    this.resetRestoreForm();
                    this.clearFileSelection();
                    this.app.showSuccessMessage(
                        this.app.localize('Success!'),
                        this.app.localize('Database restored successfully.')
                    );
                }
            },
            error: (error) => {
                this.resetRestoreForm();
                this.app.handleApiError(error);
            }
        });
    }

    // Reset restore form state
    private resetRestoreForm(): void {
        this.restoreForm = {
            submitted: false,
            validated: false,
            loading: false
        };
        this.uploadProgress = 0;
    }

    // Check if restore form is ready to submit
    public get isRestoreFormReady(): boolean {
        return this.selectedBackupFile !== null && !this.restoreForm.loading;
    }

    // Get formatted file size
    public getFormattedFileSize(): string {
        if (!this.selectedBackupFile) return '';
        
        const bytes = this.selectedBackupFile.size;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // --- Data Export Methods (Future Implementation) ---

    // Export data using controller ExportData endpoint
    public exportData(): void {
        this.dataExportState.loading = true;

        const exportRequest = {
            Tables: ['AuditLogs'], // Example tables
            IncludeHeaders: true,
            Format: 'CSV',
            StartDate: null,
            EndDate: null
        };

        // Using exact controller endpoint
        this.http.post('/api/Tools/ExportData', exportRequest).subscribe({
            next: (response: any) => {
                this.dataExportState.loading = false;
                this.app.showInfoMessage(
                    this.app.localize('Coming Soon'),
                    response.message
                );
            },
            error: (error) => {
                this.dataExportState.loading = false;
                this.app.handleApiError(error);
            }
        });
    }

    // --- Data Import Methods (Future Implementation) ---

    // Handle data import file selection
    public onDataImportFileChange(event: any): void {
        const file = event.target.files[0];
        if (file) {
            this.dataImportState.selectedFile = file;
        }
    }

    // Import data using controller ImportData endpoint
    public importData(): void {
        if (!this.dataImportState.selectedFile || !this.dataImportState.entityType) {
            this.app.showErrorMessage(
                this.app.localize('Missing Data'),
                this.app.localize('Please select a file and entity type.')
            );
            return;
        }

        this.dataImportState.loading = true;

        const formData = new FormData();
        formData.append('file', this.dataImportState.selectedFile);
        formData.append('entityType', this.dataImportState.entityType);

        // Using exact controller endpoint
        this.http.post('/api/Tools/ImportData', formData).subscribe({
            next: (response: any) => {
                this.dataImportState.loading = false;
                this.app.showInfoMessage(
                    this.app.localize('Coming Soon'),
                    response.message
                );
            },
            error: (error) => {
                this.dataImportState.loading = false;
                this.app.handleApiError(error);
            }
        });
    }
}