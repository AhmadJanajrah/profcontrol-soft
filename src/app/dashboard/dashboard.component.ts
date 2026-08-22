import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AppService } from '../services/app.service';
import ApexCharts from 'apexcharts';
import { Subscription, interval } from 'rxjs';
import { AppImports } from '../app.imports';

@Component({
	selector: 'app-dashboard',
	templateUrl: './dashboard.component.html',
	standalone: true,
	imports: [AppImports]
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
	// Chart element references
	@ViewChild('salesTrendChart', { static: false }) salesTrendChart!: ElementRef;
	@ViewChild('paymentsByMethodChart', { static: false }) paymentsByMethodChart!: ElementRef;
	@ViewChild('purchaseTrendChart', { static: false }) purchaseTrendChart!: ElementRef;
	@ViewChild('salesByStatusChart', { static: false }) salesByStatusChart!: ElementRef;

	// Component state
	public isLoading = true;
	public dashboardData: any = null;

	// Subscription and chart management
	private subscriptions: Subscription[] = [];
	private chartInstances: { [key: string]: ApexCharts } = {};
	private componentDestroyed = false;

	// Filters and configuration
	public filters = {
		period: 'monthly',
		autoRefresh: false,
		refreshInterval: 300000 // 5 minutes
	};

	public periodOptions = [
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'yearly', label: 'Yearly' }
	];

	constructor(
		private http: HttpClient,
		public app: AppService
	) {
		this.periodOptions.forEach(option => {
			option.label = this.app.localize(option.label);
		});
	}

	// ==================== Lifecycle Hooks ====================

	ngOnInit(): void {
		this.loadDashboard();
	}

	ngAfterViewInit(): void {
		// Charts are initialized after data loads in loadDashboard()
	}

	ngOnDestroy(): void {
		this.componentDestroyed = true;
		this.subscriptions.forEach(sub => sub.unsubscribe());
		this.destroyAllCharts();
	}

	// ==================== Data Loading ====================

	/**
	 * Load dashboard data from API
	 */
	public loadDashboard(): void {
		const locationId = this.app.getSelectedLocationId() || 0;

		this.isLoading = true;
		const params = new HttpParams()
			.set('locationId', locationId.toString())
			.set('period', this.filters.period);

		const subscription = this.http.get<any>('/api/dashboard/getdashboardoverview', { params })
			.subscribe({
				next: (response) => {
					this.dashboardData = response.data;
					this.isLoading = false;
					// Delay chart initialization to ensure DOM is ready
					setTimeout(() => this.initializeCharts(), 100);
				},
				error: (error) => {
					this.app.handleApiError(error);
					this.isLoading = false;
				}
			});

		this.subscriptions.push(subscription);
	}

	// ==================== User Actions ====================

	/**
	 * Change dashboard period and reload data
	 */
	public changePeriod(period: string): void {
		this.filters.period = period;
		this.destroyAllCharts();
		this.loadDashboard();
	}

	/**
	 * Toggle auto-refresh functionality
	 */
	public toggleAutoRefresh(): void {
		this.filters.autoRefresh = !this.filters.autoRefresh;
		this.setupAutoRefresh();
	}

	/**
	 * Manually refresh dashboard data
	 */
	public refreshDashboard(): void {
		this.destroyAllCharts();
		this.loadDashboard();
	}

	// ==================== Auto-Refresh ====================

	/**
	 * Setup or teardown auto-refresh interval
	 */
	private setupAutoRefresh(): void {
		this.subscriptions.forEach(sub => sub.unsubscribe());
		this.subscriptions = [];

		if (this.filters.autoRefresh) {
			const refreshInterval = interval(this.filters.refreshInterval)
				.subscribe(() => {
					if (!this.componentDestroyed) {
						this.loadDashboard();
					}
				});

			this.subscriptions.push(refreshInterval);
		}
	}

	// ==================== Chart Initialization ====================

	/**
	 * Initialize all dashboard charts
	 */
	private initializeCharts(): void {
		if (!this.dashboardData?.charts) return;

		// Additional delay to ensure all ViewChild elements are available
		setTimeout(() => {
			this.initializeSalesTrendChart();
			this.initializePaymentsByMethodChart();
			this.initializePurchaseTrendChart();
			this.initializeSalesByStatusChart();
		}, 200);
	}

	/**
	 * Initialize sales trend line/bar chart
	 */
	private initializeSalesTrendChart(): void {
		if (!this.salesTrendChart?.nativeElement || !this.dashboardData?.charts.salesTrend) return;

		const chartData = this.dashboardData.charts.salesTrend.data;

		const options: ApexCharts.ApexOptions = {
			series: [
				{ name: 'Revenue', type: 'column', data: chartData.map((i: any) => i.revenue) },
				{ name: 'Profit', type: 'column', data: chartData.map((i: any) => i.profit) },
				{ name: 'Orders', type: 'line', data: chartData.map((i: any) => i.orderCount) },
				{ name: 'Refunds', type: 'line', data: chartData.map((i: any) => i.refunds) }
			],
			chart: {
				redrawOnWindowResize: true,
				height: 315,
				type: 'bar',
				toolbar: { show: false },
			},
			plotOptions: {
				bar: {
					horizontal: false,
					columnWidth: '18%',
					borderRadius: 2
				}
			},
			grid: {
				borderColor: '#f1f1f1',
				strokeDashArray: 3
			},
			dataLabels: { enabled: false },
			stroke: {
				width: [0, 2, 2, 2],
				curve: "smooth"
			},
			legend: {
				show: true,
				fontSize: "12px",
				position: 'bottom',
				horizontalAlign: 'center',
				fontWeight: 500,
				height: 40,
				offsetX: 0,
				offsetY: 10,
				labels: { colors: '#9ba5b7' },
				markers: {
					size: 7,
					shape: "circle",
					strokeWidth: 0,
					offsetX: 0,
					offsetY: 0
				}
			},
			colors: ['var(--brand-primary)', "var(--brand-accent)", '#f59e0b', '#ef4444'],
			yaxis: {
				title: {
					text: this.app.localize('Amount')
				},
				labels: {
					formatter: (y: any) => Number(y).toFixed(0),
				}
			},
			xaxis: {
				type: "category",
				categories: chartData.map((i: any) => i.period),
				labels: {
					style: {
						colors: "#8c9097",
						fontSize: '11px',
						fontWeight: 600
					}
				}
			},
			fill: {
				opacity: 1,
				type: ['solid', 'solid', 'solid', 'solid'],
				gradient: {
					shade: 'light',
					type: "horizontal",
					shadeIntensity: 0.5,
					gradientToColors: ['#fdc530'],
					inverseColors: true,
					opacityFrom: 0.35,
					opacityTo: 0.05,
					stops: [0, 50, 100],
				}
			},
			tooltip: {
				shared: true,
				intersect: false,
				y: {
					formatter: (val: any, opts?: any) => {
						// Show Orders (seriesIndex 2) as integer, others as currency
						if (opts && opts.seriesIndex === 2) {
							return Math.round(Number(val)).toString();
						}
						return this.app.formatCurrency(Number(val));
					}
				}
			}
		};

		this.chartInstances['salesTrend'] = new ApexCharts(this.salesTrendChart.nativeElement, options);
		this.chartInstances['salesTrend'].render();
	}

	/**
	 * Initialize payments by method donut chart
	 */
	private initializePaymentsByMethodChart(): void {
		if (!this.paymentsByMethodChart?.nativeElement || !this.dashboardData?.charts.paymentsByMethod) return;

		const chartData = this.dashboardData.charts.paymentsByMethod.data;
		const series = chartData.map((i: any) => i.totalAmount);
		const total = series.reduce((a: number, b: number) => a + b, 0);

		const textColor = '#8c9097';

		const options: ApexCharts.ApexOptions = {
			series,
			labels: chartData.map((i: any) => i.paymentMethodName),
			chart: {
				height: 350,
				type: 'donut'
			},
			dataLabels: {
				enabled: false
			},
			tooltip: {
				y: {
					formatter: (val: number) => this.app.formatCurrency(val)
				}
			},
			legend: {
				show: true,
				position: 'bottom',
				horizontalAlign: 'center',
				labels: {
					colors: textColor
				}
			},
			plotOptions: {
				pie: {
					donut: {
						size: '75%',
						labels: {
							show: true,
							name: {
								show: true,
								color: textColor,
								fontSize: '13px',
								fontWeight: 500
							},
							value: {
								show: true,
								color: textColor,
								fontSize: '16px',
								fontWeight: 600,
								formatter: (val: number) => this.app.formatCurrency(val)
							},
							total: {
								show: true,
								label: this.app.localize('Total'),
								color: textColor,
								fontSize: '14px',
								fontWeight: 600,
								formatter: () => this.app.formatCurrency(total)
							}
						}
					}
				}
			},
			colors: [
				'var(--brand-primary)',
				'#ffc107',
				'#dc3545',
				'#6c757d',
				'#17a2b8',
				'#6f42c1'
			]
		};

		this.chartInstances['paymentsByMethod'] =
			new ApexCharts(this.paymentsByMethodChart.nativeElement, options);

		this.chartInstances['paymentsByMethod'].render();
	}


	/**
	 * Initialize purchase trend bar chart
	 */
	private initializePurchaseTrendChart(): void {
		if (!this.purchaseTrendChart?.nativeElement || !this.dashboardData?.charts.purchaseTrend) return;

		const chartData = this.dashboardData.charts.purchaseTrend.data;
		const textColor = '#8c9097';

		const options: ApexCharts.ApexOptions = {
			series: [
				{
					name: this.app.localize('Purchases'),
					data: chartData.map((i: any) => i.purchases)
				},
				{
					name: this.app.localize('Returns'),
					data: chartData.map((i: any) => i.returns)
				},
				{
					name: this.app.localize('Orders'),
					data: chartData.map((i: any) => i.orderCount)
				}
			],
			chart: {
				type: 'area',
				height: 350,
				toolbar: { show: true },
				redrawOnParentResize: true
			},
			stroke: {
				width: [2, 2, 2],
				curve: 'smooth'
			},
			grid: {
				borderColor: '#f1f1f1',
				strokeDashArray: 3
			},
			dataLabels: {
				enabled: false
			},
			xaxis: {
				categories: chartData.map((i: any) => i.period),
				type: 'category',
				labels: {
					style: {
						colors: textColor,
						fontSize: '11px',
						fontWeight: 600
					}
				}
			},
			yaxis: {
				labels: {
					style: {
						colors: textColor,
						fontSize: '11px',
						fontWeight: 600
					},
					formatter: (val: number, opts?: any) => {
						// Series index 2 = Orders (count)
						if (opts && opts.seriesIndex === 2) {
							return Math.round(val).toString();
						}
						return this.app.formatCurrency(val);
					}
				},
				title: {
					text: this.app.localize('Amount'),
					style: {
						color: textColor,
						fontSize: '12px',
						fontWeight: 600
					}
				}
			},
			fill: {
				type: ['gradient', 'gradient', 'solid'],
				opacity: [0.45, 0.35, 0.85],
				gradient: {
					shadeIntensity: 1,
					opacityFrom: 0.6,
					opacityTo: 0.05,
					stops: [0, 90, 100]
				}
			},
			tooltip: {
				shared: true,
				intersect: false,
				y: {
					formatter: (val: number, opts?: any) => {
						if (opts && opts.seriesIndex === 2) {
							return Math.round(val).toString();
						}
						return this.app.formatCurrency(val);
					}
				}
			},
			legend: {
				position: 'top',
				labels: {
					colors: textColor
				}
			},
			colors: [
				'var(--brand-primary)',
				'#dc3545',
				'#ffc107'
			]
		};

		this.chartInstances['purchaseTrend'] =
			new ApexCharts(this.purchaseTrendChart.nativeElement, options);

		this.chartInstances['purchaseTrend'].render();
	}


	/**
	 * Initialize sales by status semi-donut chart
	 */
	private initializeSalesByStatusChart(): void {
		if (!this.salesByStatusChart?.nativeElement || !this.dashboardData?.charts.salesByStatus) return;

		const chartData = this.dashboardData.charts.salesByStatus.data;
		const series = chartData.map((i: any) => i.count);
		const labels = chartData.map((i: any) => this.getOrderStatusName(i.status));
		const total = series.reduce((a: number, b: number) => a + b, 0);

		const textColor = '#8c9097';

		const options: ApexCharts.ApexOptions = {
			series,
			labels,
			chart: {
				height: 300,
				type: 'donut'
			},
			dataLabels: {
				enabled: false
			},
			legend: {
				show: true,
				position: 'bottom',
				horizontalAlign: 'center',
				labels: {
					colors: textColor
				}
			},
			grid: {
				padding: {
					bottom: -100
				}
			},
			plotOptions: {
				pie: {
					startAngle: -90,
					endAngle: 90,
					offsetY: 10,
					donut: {
						size: '75%',
						labels: {
							show: true,
							name: {
								show: false
							},
							value: {
								show: false
							},
							total: {
								show: true,
								label: this.app.localize('Total'),
								color: textColor,
								fontSize: '16px',
								fontWeight: 600,
								formatter: () => total.toString()
							}
						}
					}
				}
			},
			colors: [
				'var(--brand-primary)',
				'#ffc107',
				'#dc3545',
				'#6c757d'
			]
		};

		this.chartInstances['salesByStatus'] =
			new ApexCharts(this.salesByStatusChart.nativeElement, options);

		this.chartInstances['salesByStatus'].render();
	}


	/**
	 * Destroy all chart instances
	 */
	private destroyAllCharts(): void {
		Object.values(this.chartInstances).forEach(chart => {
			if (chart) {
				try {
					chart.destroy();
				} catch (error) {
					console.warn('Error destroying chart:', error);
				}
			}
		});
		this.chartInstances = {};
	}

	// ==================== Helper Methods ====================

	/**
	 * Get table status percentage
	 */
	public getTableStatusPercentage(status: number): number {
		const statusData = this.dashboardData.kpis.tables?.data.find((t: any) => t.status === status);
		return statusData ? statusData.percentage : 0;
	}

	/**
	 * Get table status count
	 */
	public getTableStatusCount(status: number): number {
		const statusData = this.dashboardData.kpis.tables?.data.find((t: any) => t.status === status);
		return statusData ? statusData.count : 0;
	}

	/**
	 * Get localized table status name
	 */
	public getTableStatusName(status: number): string {
		const statusMap: { [key: number]: string } = {
			1: 'Available',
			2: 'Reserved',
			3: 'Occupied',
			4: 'Maintenance'
		};
		return this.app.localize(statusMap[status] || 'Unknown');
	}

	/**
	 * Get icon class for alert level
	 */
	public getAlertLevelIcon(level: number): string {
		const iconMap: { [key: number]: string } = {
			3: 'ri-error-warning-line',
			2: 'ri-alert-line',
			1: 'ri-information-line'
		};
		return iconMap[level] || 'ri-information-line';
	}

	private getOrderStatusName(status: number) {
		const statusMap: { [key: number]: string } = {
			1: 'Pending',
			2: 'In Progress',
			3: 'Ready',
			4: 'Completed',
			5: 'Returned',
			6: 'Cancelled'
		};
		return this.app.localize(statusMap[status] || 'Unknown');
	}
}