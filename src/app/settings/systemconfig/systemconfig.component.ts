import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { AppService } from '../../services/app.service';
import { AppImports } from '../../app.imports';

@Component({
	selector: 'app-systemconfig',
	templateUrl: './systemconfig.component.html',
	standalone: true,
	imports: [AppImports]
})
export class SystemConfigComponent implements OnInit {
	// Tabs
	public activeTab: 'general' | 'pos' | 'receipt' | 'integration' | 'payroll' | 'accounting' | 'theme' = 'general';

	// Loading states
	public loading = {
		general: false,
		pos: false,
		receipt: false,
		integration: false,
		payroll: false, 
		accounting: false,
		theme: false
	};

	// Submission states
	public submitting = {
		general: false,
		pos: false,
		receipt: false,
		integrationEmail: false,
		integrationSms: false,
		payroll: false,
		accounting: false,
		theme: false
	};

	// Validation states
	public validated = {
		general: false,
		pos: false,
		receipt: false,
		integrationEmail: false,
		integrationSms: false,
		payroll: false,
		accounting: false,
		theme: false
	};

	// Form data sources
	public timezones: Array<{ id: string; displayName: string }> = [];
	public accounts: Array<{ id: number; accountCode: string; accountName: string; displayName?: string }> = [];

	// Select options (must match DTO/controller allowed values)
	public invoiceTemplates = [
		{ value: 'Standard', label: 'Standard' },
		{ value: 'Thermal', label: 'Thermal' }
	];

	public qrTypes = [
		{ value: 'None', label: 'None' },
		{ value: 'Zatca', label: 'ZATCA' },
		{ value: 'EmvCo', label: 'EMV-Co' },
		{ value: 'Url', label: 'URL' }
	];

	public taxTypes = [
		{ value: 'Inclusive', label: 'Tax Inclusive' },
		{ value: 'Exclusive', label: 'Tax Exclusive' }
	];

	public applicationTypes = [
		{ value: 'Item', label: 'Per Item' },
		{ value: 'Order', label: 'Per Order' }
	];

	public taxCalculationOrders = [
		{ value: 'BeforeDiscount', label: 'Before Discount' },
		{ value: 'AfterDiscount', label: 'After Discount' }
	];

	public callCenterTypes = [
		{ value: 'Internal', label: 'Internal' },
		{ value: 'Independent', label: 'Independent' }
	];

	public paidDriverOptions = [
		{ value: 'Paid', label: 'Paid' },
		{ value: 'OnAccount', label: 'On Account' }
	];

	public fiscalMonths: any[] = [];

	public backgroundOptions = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'primary', label: 'Primary' }
	];

	public themes = ['theme1', 'theme2', 'theme3', 'theme4', 'theme5', 'theme6', 'theme7', 'theme8', 
		'theme9', 'theme10', 'theme11', 'theme12', 'theme13', 'theme14', 'theme15', 'theme16'];

	public salaryComponentTypes = [
		{ value: 1, label: 'Earning' },
		{ value: 2, label: 'Deduction' }
	];

	// General
	public general = {
		appName: 'GoRestofy',
		appVersion: '1.0.0',
		logoUrl: '',
		faviconUrl: '',
		copyright: '',
		timezone: 'America/New_York',
		enableCustomerLoyalty: false,
		pointsPerCurrencyUnit: '0',
		redemptionValuePerPoint: '0',
		websiteEnabled: true,
		enableReservation: false,
		companyName: '',
		companyEmail: '',
		companyPhone: '',
		companyTaxNumber: '',
		companyAddress: '',
		companyCity: '',
		companyState: '',
		companyPostalCode: '',
		companyCountry: '',
		auditLogRetentionDays: 90,
		userActivityLogRetentionDays: 90
	};
	public logoFile: File | null = null;
	public faviconFile: File | null = null;
	public logoPreviewUrl = '';
	public faviconPreviewUrl = '';

	// POS
	public pos = {
		invoiceTemplate: 'Thermal',
		isKitchenPrinting: false,
		includeQRCode: false,
		qrType: 'None',
		taxType: 'Exclusive',
		taxApplication: 'Order',
		discountApplication: 'Order',
		taxCalculationOrder: 'AfterDiscount',
		callCenterType: 'Internal',
		paidDriver: 'Paid'
	};

	// Receipt
	public receipt = {
		saleInvoicePrefix: 'INV',
		saleInvoiceNote: '',
		saleReturnInvoicePrefix: 'RTN',
		saleReturnInvoiceNote: '',
		purchaseInvoicePrefix: 'PUR',
		purchaseInvoiceNote: '',
		purchaseReturnInvoicePrefix: 'PRTN',
		purchaseReturnInvoiceNote: '',
		payrollInvoicePrefix: 'PAY',
		payrollInvoiceNote: '',
		quotationPrefix: 'QUO',
		reservationPrefix: 'RES',
		invoiceNumberLength: 8
	};

	// Integration (Email + SMS)
	public email = {
		isActive: false,
		smtpHost: '',
		smtpPort: 587,
		smtpUser: '',
		smtpPassword: '',
		enableSsl: true,
		fromAddress: '',
		fromName: ''
	};
	public sms = {
		isActive: false,
		twilioAccountSID: '',
		twilioAuthToken: '',
		twilioFromNumber: ''
	};

	// Payroll
	public payroll = {
		cycleStartDay: 1,
		isLeavePaid: true,
		isHalfDayCountAsLeave: true,
		latePerMonthToLeave: 3,
		graceMinutes: 0,
		enableOvertime: false,
		overtimeMultiplier: '1.0'
	};

	// Payroll: Salary components management (create/delete only)
	public salaryComponents: Array<any> = [];
	public newSalaryComponent = {
		componentName: '',
		componentType: 1, // 1=Earning, 2=Deduction
		defaultValue: '',
		isPercentage: false,
		description: ''
	};
	public submittingComponent = false;
	public validatedComponent = false;

	// Accounting
	public accounting = {
		isAccountingEnabled: true,
		accountingMethod: 'Accrual',
		fiscalYearStartMonth: 1,
		enablePeriodLocking: false,
		lockDate: null as string | null,
		accountMappings: [] as Array<{ key: string; title: string; info: string; accountCode: string | null }>
	};

	// Theme
	public theme = {
		themeLayout: 'sidebar-fixed',
		themeMode: 'general',
		theme: 'theme1',
		headerBackground: 'light',
		menuBackground: 'light'
	};

	constructor(private http: HttpClient, public app: AppService) {
		// Localize option labels
		this.invoiceTemplates.forEach(o => (o.label = this.app.localize(o.label)));
		this.qrTypes.forEach(o => (o.label = this.app.localize(o.label)));
		this.taxTypes.forEach(o => (o.label = this.app.localize(o.label)));
		this.applicationTypes.forEach(o => (o.label = this.app.localize(o.label)));
		this.taxCalculationOrders.forEach(o => (o.label = this.app.localize(o.label)));
		this.callCenterTypes.forEach(o => (o.label = this.app.localize(o.label)));
		this.paidDriverOptions.forEach(o => (o.label = this.app.localize(o.label)));
		this.backgroundOptions.forEach(o => (o.label = this.app.localize(o.label)));
		this.salaryComponentTypes.forEach(o => (o.label = this.app.localize(o.label)));

		this.fiscalMonths = app.getMonths();

		this.resetSalaryComponent();
	}

	ngOnInit(): void {
		// Pick initial tab from query param if present
		const url = new URL(window.location.href);
		const tab = (url.searchParams.get('tab') || 'general') as typeof this.activeTab;
		if (['general', 'pos', 'receipt', 'integration', 'payroll', 'accounting', 'theme'].includes(tab)) {
			this.activeTab = tab;
		}

		this.loadFormData();
		this.loadTab(this.activeTab);
	}

	// --- Tabs ---

	public switchTab(tab: typeof this.activeTab): void {
		if (this.activeTab === tab) return;
		this.activeTab = tab;
		this.updateTabUrl();
		this.loadTab(tab);
	}

	private updateTabUrl(): void {
		const u = new URL(window.location.href);
		u.searchParams.set('tab', this.activeTab);
		window.history.replaceState({}, '', u.toString());
	}

	// --- Loaders ---

	private loadFormData(): void {
		this.http.get<any>('/api/settings/getsystemconfigformdata').subscribe({
			next: res => {
				this.timezones = (res.timezones || []).map((t: any) => ({
					id: t.id,
					displayName: t.displayName
				}));
				this.accounts = (res.accounts || []).map((a: any) => ({
					id: a.id,
					accountCode: a.accountCode,
					accountName: a.accountName,
					displayName: `${a.accountCode} - ${a.accountName}`
				}));
			},
			error: err => {
				this.app.handleApiError(err);
				this.accounts = [];
				this.timezones = [];
			}
		});
	}

	private loadTab(tab: typeof this.activeTab): void {
		if (this.loading[tab]) return;
		this.loading[tab] = true;

		switch (tab) {
			case 'general':
				this.http.get<any>('/api/settings/getgeneralsettings').subscribe({
					next: res => {
						const s = res?.settings || {};
						this.general = {
							...this.general,
							...s
						};
						// Numbers to locale strings
						if (s?.pointsPerCurrencyUnit !== undefined) {
							this.general.pointsPerCurrencyUnit = this.app.apiNumberToLocale(s.pointsPerCurrencyUnit);
						}
						if (s?.redemptionValuePerPoint !== undefined) {
							this.general.redemptionValuePerPoint = this.app.apiNumberToLocale(s.redemptionValuePerPoint);
						}
						// Resolve image preview URLs
						this.logoPreviewUrl = this.general.logoUrl ? this.app.apiUrl(`/api/media/generalimage/${this.general.logoUrl}`) : '';
						this.faviconPreviewUrl = this.general.faviconUrl ? this.app.apiUrl(`/api/media/generalimage/${this.general.faviconUrl}`) : '';
						this.app.loadImages?.('[data-form-image="true"]', true);
						this.loading[tab] = false;
					},
					error: err => {
						this.app.handleApiError(err);
						this.loading[tab] = false;
					}
				});
				break;

			case 'pos':
				this.http.get<any>('/api/settings/getpossettings').subscribe({
					next: res => {
						this.pos = { ...this.pos, ...res?.settings || {} };
						this.loading[tab] = false;
					},
					error: err => {
						this.app.handleApiError(err);
						this.loading[tab] = false;
					}
				});
				break;

			case 'receipt':
				this.http.get<any>('/api/settings/getreceiptsettings').subscribe({
					next: res => {
						this.receipt = { ...this.receipt, ...res?.settings || {} };
						this.loading[tab] = false;
					},
					error: err => {
						this.app.handleApiError(err);
						this.loading[tab] = false;
					}
				});
				break;

			case 'integration': {
				let done = 0;
				const finish = () => {
					done++;
					if (done >= 2) this.loading[tab] = false;
				};

				this.http.get<any>('/api/settings/getemailsettings').subscribe({
					next: res => {
						this.email = { ...this.email, ...res?.settings || {} };
						finish();
					},
					error: err => {
						this.app.handleApiError(err);
						finish();
					}
				});

				this.http.get<any>('/api/settings/getsmssettings').subscribe({
					next: res => {
						this.sms = { ...this.sms, ...res?.settings || {} };
						finish();
					},
					error: err => {
						this.app.handleApiError(err);
						finish();
					}
				});
				break;
			}

			case 'payroll':
				this.http.get<any>('/api/settings/getpayrollsettings').subscribe({
					next: res => {
						const s = res?.settings || {};
						this.payroll = {
							...this.payroll,
							...s,
							overtimeMultiplier:
								s?.overtimeMultiplier !== undefined ? this.app.apiNumberToLocale(s.overtimeMultiplier) : this.payroll.overtimeMultiplier
						};
						// Load salary components (for management section)
						this.loadSalaryComponents();
						this.loading[tab] = false;
					},
					error: err => {
						this.app.handleApiError(err);
						this.loading[tab] = false;
					}
				});
				break;

			case 'accounting':
				this.http.get<any>('/api/settings/getaccountingsettings').subscribe({
					next: res => {
						const s = res?.settings || {};
						this.accounting.isAccountingEnabled = !!s.isAccountingEnabled;
						this.accounting.accountingMethod = s.accountingMethod || this.accounting.accountingMethod;
						this.accounting.fiscalYearStartMonth = s.fiscalYearStartMonth ?? this.accounting.fiscalYearStartMonth;
						this.accounting.enablePeriodLocking = !!s.enablePeriodLocking;
						this.accounting.lockDate = s.lockDate ? this.app.APIDateTimeToHTMLDate(s.lockDate) : null;
						const mappings = Array.isArray(s.accountMappings) ? s.accountMappings : [];
						// Ensure mapping array exists with Title/Info
						this.accounting.accountMappings = mappings.map((m: any) => ({
							key: m.key,
							title: m.title,
							info: m.info,
							accountCode: m.accountCode ?? null
						}));
						this.loading[tab] = false;
					},
					error: err => {
						this.app.handleApiError(err);
						this.loading[tab] = false;
					}
				});
				break;

			case 'theme':
				this.http.get<any>('/api/settings/getthemesettings').subscribe({
					next: res => {
						this.theme = { ...this.theme, ...res?.settings || {} };
						this.loading[tab] = false;
					},
					error: err => {
						this.app.handleApiError(err);
						this.loading[tab] = false;
					}
				});
				break;
		}
	}

	// --- Submitters ---

	public submitGeneral(form: NgForm): void {
		this.validated.general = true;
		if (!form.valid) {
			this.app.showErrorMessage(this.app.localize('Validation Error'), this.app.localize('Please fill in all required fields correctly'));
			return;
		}
		this.submitting.general = true;

		const fd = new FormData();
		// Copy settings with numeric conversions
		const g = { ...this.general };
		if (g.pointsPerCurrencyUnit) g.pointsPerCurrencyUnit = this.app.localeToAPINumber(g.pointsPerCurrencyUnit).toString();
		if (g.redemptionValuePerPoint) g.redemptionValuePerPoint = this.app.localeToAPINumber(g.redemptionValuePerPoint).toString();

		Object.keys(g).forEach(k => {
			const v = (g as any)[k];
			if (v !== null && v !== undefined) fd.append(`Settings.${k}`, v.toString());
		});
		if (this.logoFile) fd.append('LogoFile', this.logoFile);
		if (this.faviconFile) fd.append('FaviconFile', this.faviconFile);

		this.http.put('/api/settings/updategeneralsettings', fd).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('General settings updated successfully.'));
				// Refresh to pick new logo/favicon urls
				this.loadTab('general');
				this.submitting.general = false;
				this.validated.general = false;
				this.app.reloadAppConfig?.();
			},
			error: err => {
				this.app.handleApiError(err);
				this.submitting.general = false;
			}
		});
	}

	public submitPOS(form: NgForm): void {
		this.validated.pos = true;
		if (!form.valid) return;
		this.submitting.pos = true;

		this.http.put('/api/settings/updatepossettings', this.pos, { headers: { 'Content-Type': 'application/json' } }).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('POS settings updated successfully.'));
				this.submitting.pos = false;
				this.validated.pos = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.submitting.pos = false;
			}
		});
	}

	public submitReceipt(form: NgForm): void {
		this.validated.receipt = true;
		if (!form.valid) return;
		this.submitting.receipt = true;

		this.http.put('/api/settings/updatereceiptsettings', this.receipt, { headers: { 'Content-Type': 'application/json' } }).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Receipt settings updated successfully.'));
				this.submitting.receipt = false;
				this.validated.receipt = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.submitting.receipt = false;
			}
		});
	}

	public submitEmail(form: NgForm): void {
		this.validated.integrationEmail = true;
		if (!form.valid) return;
		this.submitting.integrationEmail = true;

		this.http.put('/api/Settings/UpdateEmailSettings', this.email, { headers: { 'Content-Type': 'application/json' } }).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Email settings updated successfully.'));
				this.submitting.integrationEmail = false;
				this.validated.integrationEmail = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.submitting.integrationEmail = false;
			}
		});
	}

	public submitSMS(form: NgForm): void {
		this.validated.integrationSms = true;
		if (!form.valid) return;
		this.submitting.integrationSms = true;

		this.http.put('/api/settings/updatesmssettings', this.sms, { headers: { 'Content-Type': 'application/json' } }).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('SMS settings updated successfully.'));
				this.submitting.integrationSms = false;
				this.validated.integrationSms = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.submitting.integrationSms = false;
			}
		});
	}

	public submitPayroll(form: NgForm): void {
		this.validated.payroll = true;
		if (!form.valid) return;
		this.submitting.payroll = true;

		const payload = {
			...this.payroll,
			overtimeMultiplier: this.app.localeToAPINumber(this.payroll.overtimeMultiplier)
		};

		this.http.put('/api/settings/updatepayrollsettings', payload, { headers: { 'Content-Type': 'application/json' } }).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Payroll settings updated successfully.'));
				this.submitting.payroll = false;
				this.validated.payroll = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.submitting.payroll = false;
			}
		});
	}

	public submitAccounting(form: NgForm): void {
		this.validated.accounting = true;
		if (!form.valid) return;
		this.submitting.accounting = true;

		const payload: any = {
			...this.accounting,
			lockDate: this.accounting.lockDate ? this.app.HTMLDateToAPIDateTime(this.accounting.lockDate) : null
		};

		this.http.put('/api/settings/updateaccountingsettings', payload, { headers: { 'Content-Type': 'application/json' } }).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Accounting settings updated successfully.'));
				this.submitting.accounting = false;
				this.validated.accounting = false;
			},
			error: err => {
				this.app.handleApiError(err);
				this.submitting.accounting = false;
			}
		});
	}

	public submitTheme(form: NgForm): void {
		this.validated.theme = true;
		if (!form.valid) return;
		this.submitting.theme = true;

		this.http.put('/api/settings/updatethemesettings', this.theme, { headers: { 'Content-Type': 'application/json' } }).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Theme updated successfully.'));
				this.submitting.theme = false;
				this.validated.theme = false;
				this.app.reloadAppConfig?.();
				this.app.applySystemTheme?.();
				window.location.reload();
			},
			error: err => {
				this.app.handleApiError(err);
				this.submitting.theme = false;
			}
		});
	}

	// --- Salary components (Payroll tab) ---

	private loadSalaryComponents(): void {
		this.http.get<any>('/api/settings/getsalarycomponents').subscribe({
			next: res => {
				this.salaryComponents = Array.isArray(res?.salaryComponents) ? res.salaryComponents : [];
			},
			error: err => {
				this.app.handleApiError(err);
				this.salaryComponents = [];
			}
		});
	}

	public resetSalaryComponent(): void {
		this.newSalaryComponent = {
			componentName: '',
			componentType: 1,
			defaultValue: '',
			isPercentage: false,
			description: ''
		};
	}

	public saveComponent(form: NgForm): void {
		this.validatedComponent = true;
		if (!form.valid) return;
		this.submittingComponent = true;

		const payload = {
			componentName: this.newSalaryComponent.componentName,
			componentType: this.newSalaryComponent.componentType, // 1 or 2
			defaultValue: this.app.localeToAPINumber(this.newSalaryComponent.defaultValue),
			isPercentage: this.newSalaryComponent.isPercentage,
			description: this.newSalaryComponent.description
		};

		this.http.post('/api/settings/createsalarycomponent', payload).subscribe({
			next: () => {
				this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Salary component created successfully.'));
				this.submittingComponent = false;
				this.validatedComponent = false;
				this.resetSalaryComponent();
				this.loadSalaryComponents();
			},
			error: err => {
				this.app.handleApiError(err);
				this.submittingComponent = false;
				this.validatedComponent = false;
			}
		});
	}

	public deleteComponent(comp: any): void {
		const msg = `${this.app.localize('Are you sure you want to delete')} <strong>"${comp.componentName}"</strong>?`;
		this.app.confirmDialog(
			this.app.localize('Confirm Delete'),
			msg,
			() => {
				this.http.delete(`/api/settings/deletesalarycomponent/${comp.id}`).subscribe({
					next: () => {
						this.app.showSuccessMessage(this.app.localize('Success!'), this.app.localize('Salary component deleted successfully.'));
						this.loadSalaryComponents();
					},
					error: err => this.app.handleApiError(err)
				});
			},
			null,
			`<i class="ri-delete-bin-5-line"></i>` + this.app.localize('Delete'),
			`<i class="ri-close-line"></i>` + this.app.localize('Cancel'),
			'danger'
		);
	}

	// --- Handlers & Helpers ---

	public onLogoSelected(ev: any): void {
		const f = ev?.target?.files?.[0] as File | undefined;
		if (!f) return;
		if (!this.validateImage(f)) return;
		this.logoFile = f;
		this.logoPreviewUrl = URL.createObjectURL(f);
		this.app.loadImages?.('[data-form-image="true"]', true);
	}

	public onFaviconSelected(ev: any): void {
		const f = ev?.target?.files?.[0] as File | undefined;
		if (!f) return;
		if (!this.validateImage(f)) return;
		this.faviconFile = f;
		this.faviconPreviewUrl = URL.createObjectURL(f);
		this.app.loadImages?.('[data-form-image="true"]', true);
	}

	private validateImage(file: File): boolean {
		const allowed = [
			'image/jpeg',
			'image/jpg',
			'image/png',
			'image/webp',
			'image/gif',
			'image/svg+xml',
			'image/x-icon'
		];
		const maxMB = 2;
		if (!allowed.includes(file.type)) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize('Please select a valid image file.'));
			return false;
		}
		if (file.size > maxMB * 1024 * 1024) {
			this.app.showErrorMessage(this.app.localize('Error!'), this.app.localize(`File size too large.`));
			return false;
		}
		return true;
	}
}