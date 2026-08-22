import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-accountingreports',
	templateUrl: './accountingreports.component.html',
	standalone: true,
	imports: [AppImports]
})
export class AccountingReportsComponent implements OnInit, OnDestroy {

	// Form data
	public accounts: any[] = [];

	// Reports (UI flags reflect controller contracts)
	public availableReports = [
		{ id: 'profitLoss', title: 'Profit & Loss', icon: 'ri-line-chart-line', showDateRange: true, requiresDateRange: true, showAsOfDate: false, requiresAsOfDate: false, showAccount: false, requiresAccount: false },
		{ id: 'balanceSheet', title: 'Balance Sheet', icon: 'ri-scales-line', showDateRange: false, requiresDateRange: false, showAsOfDate: true, requiresAsOfDate: true, showAccount: false, requiresAccount: false },
		{ id: 'cashFlow', title: 'Cash Flow Statement', icon: 'ri-money-dollar-circle-line', showDateRange: true, requiresDateRange: true, showAsOfDate: false, requiresAsOfDate: false, showAccount: false, requiresAccount: false },
		{ id: 'trialBalance', title: 'Trial Balance', icon: 'ri-calculator-line', showDateRange: false, requiresDateRange: false, showAsOfDate: true, requiresAsOfDate: true, showAccount: false, requiresAccount: false },
		{ id: 'generalLedger', title: 'General Ledger', icon: 'ri-book-line', showDateRange: true, requiresDateRange: false, showAsOfDate: false, requiresAsOfDate: false, showAccount: true, requiresAccount: false },
		{ id: 'accountStatement', title: 'Account Statement', icon: 'ri-file-list-line', showDateRange: true, requiresDateRange: true, showAsOfDate: false, requiresAsOfDate: false, showAccount: true, requiresAccount: true }
	];

	// Current report selection
	public currentReport: any = null;

	// Parameters (defaults)
	public reportParams = {
		accountId: null as number | null,
		dateFrom: '',
		dateTo: '',
		asOfDate: '',
		allLocations: false
	};

	// Modal state
	public reportModal = { show: false, loading: false, validated: false };

	// Keep API response casing (camelCase from System.Text.Json)
	public reportData: any = null;

	constructor(private http: HttpClient, public app: AppService) {
		this.reportParams.asOfDate = app.currentHTMLDate();
		this.reportParams.dateFrom = app.monthStartHTMLDate();
		this.reportParams.dateTo = app.currentHTMLDate();
	 }

	ngOnInit(): void {
		this.loadFormData();
		this.reportParams.allLocations = this.hasAccessAllLocations();
		window.addEventListener('popstate', this.onPopState);
	}

	ngOnDestroy(): void {
		window.removeEventListener('popstate', this.onPopState);
	}

	// Load locations and accounts
	private loadFormData(): void {
		this.http.get<any>('/api/accounting/getreportformdata').subscribe({
			next: data => {
				this.accounts = this.app.formatAccountsForNgSelect(data.accounts || []);
			},
			error: err => this.app.handleApiError(err)
		});
	}

	// Open / close modal
	public openReportModal(report: any): void {
		this.currentReport = report;
		this.reportData = null;
		this.reportModal.show = true;
		this.reportModal.loading = false;
		this.reportModal.validated = false;

		if (!report.requiresAccount) this.reportParams.accountId = null;
		history.pushState(null, '', `${window.location.pathname}`);
	}

	public closeReportModal(): void {
		this.currentReport = null;
		this.reportData = null;
		this.reportModal.show = false;
		this.reportModal.loading = false;
		this.reportModal.validated = false;
		history.back();
	}

	// Check if user has access to all locations
	public hasAccessAllLocations(): boolean {
		return this.app.hasAccessAllLocations();
	}

	// Validation (only enforce fields required by controller)
	private validateReportParams(): boolean {
		if (this.currentReport?.requiresDateRange) {
			if (!this.reportParams.dateFrom || !this.reportParams.dateTo) return false;
		}
		if (this.currentReport?.requiresAsOfDate) {
			if (!this.reportParams.asOfDate) return false;
		}
		if (this.currentReport?.requiresAccount && !this.reportParams.accountId) {
			return false;
		}
		return true;
	}

	public resetValidation(): void {
		this.reportModal.validated = false;
	}

	// Generate report (match controller endpoints and param names)
	public generateReport(): void {
		if (!this.validateReportParams()) {
			this.reportModal.validated = true;
			return;
		}

		this.reportModal.loading = true;
		this.reportData = null;

		// Determine if we should use locationId=0 for "all locations"
		const locationId = this.app.getSelectedLocationId() || '';
		const params: any = { locationId: this.hasAccessAllLocations() ? '0' : locationId };
		let apiUrl = '';

		switch (this.currentReport?.id) {
			case 'profitLoss':
				params.dateFrom = this.reportParams.dateFrom;
				params.dateTo = this.reportParams.dateTo;
				apiUrl = '/api/accounting/getprofitandloss';
				break;
			case 'balanceSheet':
				params.asOfDate = this.reportParams.asOfDate;
				apiUrl = '/api/accounting/getbalancesheet';
				break;
			case 'cashFlow':
				params.dateFrom = this.reportParams.dateFrom;
				params.dateTo = this.reportParams.dateTo;
				apiUrl = '/api/accounting/getcashflow';
				break;
			case 'trialBalance':
				params.asOfDate = this.reportParams.asOfDate;
				apiUrl = '/api/accounting/gettrialbalance';
				break;
			case 'generalLedger':
				if (this.reportParams.accountId) params.accountId = this.reportParams.accountId;
				if (this.reportParams.dateFrom) params.dateFrom = this.reportParams.dateFrom;
				if (this.reportParams.dateTo) params.dateTo = this.reportParams.dateTo;
				apiUrl = '/api/accounting/getgeneralledger';
				break;
			case 'accountStatement':
				params.accountId = this.reportParams.accountId;
				params.dateFrom = this.reportParams.dateFrom;
				params.dateTo = this.reportParams.dateTo;
				apiUrl = '/api/accounting/getaccountstatement';
				break;
			default:
				this.reportModal.loading = false;
				this.app.showErrorMessage(this.app.localize('Error'), this.app.localize('Unknown report type'));
				return;
		}

		this.http.get<any>(apiUrl, { params }).subscribe({
			next: (data: any) => {
				this.reportData = data || {};
				this.reportModal.loading = false;
			},
			error: (err) => {
				this.app.handleApiError(err);
				this.reportModal.loading = false;
			}
		});
	}

	// Print the report content as it appears on the page
	public printReport(): void {
		const srcEl = document.getElementById('reportContent');
		if (!srcEl) return;

		const printWindow = window.open('', '', 'width=900,height=650');
		if (!printWindow) return;

		const baseHref = document.querySelector('base')?.href || document.baseURI;
		const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
			.map(node => node.outerHTML)
			.join('\n');
		const title = this.reportData?.reportName || this.app.localize('Report');

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
		}, 300);
	}

	// Handle browser back
	private onPopState = (): void => {
		if (this.reportModal.show) this.closeReportModal();
	};
}