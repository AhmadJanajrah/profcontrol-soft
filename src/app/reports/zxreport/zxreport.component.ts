import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
    selector: 'app-zxreport',
    templateUrl: './zxreport.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ZXReportComponent implements OnInit, OnDestroy {
    @ViewChild('printSection', { static: false }) printSection!: ElementRef;

    // Component state
    public isLoading = false;
    public reportData: any = null;

    // Filter options
    public filters = {
        reportType: 'z-report',
        reportDate: new Date().toISOString().split('T')[0],
        registerId: null as number | null,
        validated: false,
        submitted: false
    };

    // Dropdown data
    public registers: any[] = [];
    public reportTypes: any[] = [];

    constructor(
        private http: HttpClient,
        private renderer: Renderer2,
        public app: AppService
    ) {
        this.reportTypes = [
            {
                value: 'z-report',
                label: this.app.localize('Z Report')
            },
            {
                value: 'x-report',
                label: this.app.localize('X Report')
            }
        ];
        this.resetFilters();
    }

    ngOnInit(): void {
        this.loadFormData();
        window.addEventListener('popstate', this.onPopState);
    }

    ngOnDestroy(): void {
        window.removeEventListener('popstate', this.onPopState);
    }

    // --- Data Loading Methods ---

    private loadFormData(): void {
        this.http.get<any>('/api/reports/getreportformdata').subscribe({
            next: (data) => {
                this.registers = data.registers || [];

                // Auto-select first register if only one exists
                if (this.registers.length === 1) {
                    this.filters.registerId = this.registers[0].id;
                }
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.isLoading = false;
            }
        });
    }

    public loadReport(): void {
        if (!this.filters.reportType || !this.filters.registerId || !this.filters.reportDate) {
            return;
        }

        const locationId = this.app.getSelectedLocationId();
        this.isLoading = true;
        this.reportData = null;

        const params: any = {
            locationId: locationId,
            registerId: this.filters.registerId,
            date: this.app.HTMLDateToAPIDateTime(this.filters.reportDate)
        };

        const endpoint = this.filters.reportType === 'z-report' ? '/api/reports/getzreport' : '/api/reports/getxreport';

        this.http.get<any>(endpoint, { params }).subscribe({
            next: (response) => {
                this.reportData = response;
                this.isLoading = false;
                this.filters.submitted = false;
                this.filters.validated = false;
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.reportData = null;
                this.isLoading = false;
                this.filters.submitted = false;
                this.filters.validated = false;
            }
        });
    }

    // --- Filter Methods ---

    public applyFilters(form: NgForm): void {
        this.filters.validated = true;
        if (form.valid) {
            this.filters.submitted = true;
            this.loadReport();
        }
    }

    public resetFilters(): void {
        this.filters.reportType = 'z-report';
        this.filters.reportDate = this.app.currentHTMLDate();
        this.filters.registerId = null;
        this.filters.validated = false;
        this.filters.submitted = false;
        this.reportData = null;
    }

    // --- Utility Methods ---

    public getCurrentReportType(): any {
        return this.reportTypes.find(rt => rt.value === this.filters.reportType);
    }

    public getRegisterName(): string {
        if (!this.filters.registerId) return '';
        const register = this.registers.find(r => r.id === this.filters.registerId);
        return register ? register.registerName : '';
    }

    public getCashDifferenceClass(difference: number): string {
        if (difference > 0) return 'text-success';
        if (difference < 0) return 'text-danger';
        return 'text-dark';
    }

    // --- Export Methods ---

    public printReport(): void {
        if (!this.reportData) return;

        const srcEl = document.getElementById('zx-report');
        if (!srcEl) return;

        const printWindow = window.open('', '', 'width=900,height=650');
        if (!printWindow) return;

        const baseHref = document.querySelector('base')?.href || document.baseURI;
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map(node => node.outerHTML)
            .join('\n');
        const title = 'Kitchen Order';

        printWindow.document.write(`
			<!doctype html>
			<html>
			<head>
				<base href="${baseHref}">
				<title>${title}</title>
				${styles}
			</head>
			<body>
			${srcEl.outerHTML}
			</body>
			</html>
		`);

        printWindow.document.close();

        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 600);
    }

    // --- Event Handlers ---

    private onPopState = (): void => {
        // Handle browser back navigation if needed
    };
}