import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
  },
  {
    path:  'auth/login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [AuthGuard],
    data: { permission: 'Login' }
  },
  {
    path: 'auth/forgotpassword',
    loadComponent: () => import('./auth/forgotpassword/forgotpassword.component').then(m => m.ForgotPasswordComponent),
    canActivate: [AuthGuard],
    data: { permission: 'ForgotPassword' }
  },
  {
    path: 'auth/resetpassword/: email/: token',
    loadComponent: () => import('./auth/resetpassword/resetpassword.component').then(m => m.ResetPasswordComponent),
    canActivate: [AuthGuard],
    data: { permission: 'ResetPassword' }
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard],
    data: { permission: 'dashboard' }
  },
  {
    path: 'homemenu',
    loadComponent: () => import('./homemenu/homemenu.component').then(m => m.HomeMenuComponent),
    canActivate: [AuthGuard],
    data: { permission: 'home' }
  },

  // Sales Routes
  {
    path: 'sales/pos',
    loadComponent: () => import('./sales/pos/pos.component').then(m => m.POSComponent),
    canActivate: [AuthGuard],
    data: { permission: 'sales.pos' }
  },
  {
    path: 'sales/kitchen',
    loadComponent:  () => import('./sales/kitchen/kitchen.component').then(m => m.KitchenComponent),
    canActivate: [AuthGuard],
    data: { permission: 'sales.kitchen' }
  },
  {
    path: 'sales/orders/list',
    loadComponent: () => import('./sales/orderlist/orderlist.component').then(m => m.OrderListComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'sales.orderlist' }
  },
  {
    path: 'sales/orders/refund/:id',
    loadComponent: () => import('./sales/refundaddedit/refundaddedit.component').then(m => m.RefundAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission:  'sales.refund' }
  },
  {
    path: 'sales/reservations',
    loadComponent: () => import('./sales/reservations/reservations.component').then(m => m.ReservationsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'sales.reservations' }
  },

  // Floor Routes
  {
    path: 'floor/floorplans',
    loadComponent: () => import('./floor/floorplans/floorplans.component').then(m => m.FloorPlansComponent),
    canActivate: [AuthGuard],
    data: { permission: 'floor.floorplans' }
  },
  {
    path: 'floor/tables',
    loadComponent:  () => import('./floor/tables/tables.component').then(m => m.TablesComponent),
    canActivate: [AuthGuard],
    data: { permission:  'floor.tables' }
  },

  // Products Routes
  {
    path:  'products/categories',
    loadComponent: () => import('./products/categories/categories.component').then(m => m.CategoriesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'products.categories' }
  },
  {
    path:  'products/items/list',
    loadComponent: () => import('./products/items/itemlist/itemlist.component').then(m => m.ItemListComponent),
    canActivate: [AuthGuard],
    data: { permission: 'products.itemlist' }
  },
  {
    path: 'products/items/add',
    loadComponent: () => import('./products/items/itemaddedit/itemaddedit.component').then(m => m.ItemAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission: 'products.additem' }
  },
  {
    path: 'products/items/edit/:id',
    loadComponent: () => import('./products/items/itemaddedit/itemaddedit.component').then(m => m.ItemAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission: 'products.edititem' }
  },
  {
    path: 'products/items/view/:id',
    loadComponent:  () => import('./products/items/itemview/itemview.component').then(m => m.ItemViewComponent),
    canActivate: [AuthGuard],
    data: { permission: 'products.viewitem' }
  },
  {
    path: 'products/modifiers',
    loadComponent: () => import('./products/modifiers/modifiers.component').then(m => m.ModifiersComponent),
    canActivate: [AuthGuard],
    data: { permission: 'products.modifiers' }
  },

  // Inventory Routes
  {
    path: 'inventory/suppliers/list',
    loadComponent: () => import('./inventory/suppliers/supplierlist/supplierlist.component').then(m => m.SupplierListComponent),
    canActivate: [AuthGuard],
    data: { permission:  'inventory.supplierlist' }
  },
  {
    path: 'inventory/suppliers/add',
    loadComponent: () => import('./inventory/suppliers/supplieraddedit/supplieraddedit.component').then(m => m.SupplierAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission: 'inventory.addsupplier' }
  },
  {
    path:  'inventory/suppliers/edit/:id',
    loadComponent: () => import('./inventory/suppliers/supplieraddedit/supplieraddedit.component').then(m => m.SupplierAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission: 'inventory.editsupplier' }
  },
  {
    path:  'inventory/suppliers/view/:id',
    loadComponent: () => import('./inventory/suppliers/supplierview/supplierview.component').then(m => m.SupplierViewComponent),
    canActivate: [AuthGuard],
    data: { permission: 'inventory.viewsupplier' }
  },
  {
    path: 'inventory/purchases/list',
    loadComponent:  () => import('./inventory/purchases/purchaselist/purchaselist.component').then(m => m.PurchaseListComponent),
    canActivate: [AuthGuard],
    data: { permission: 'inventory.purchaselist' }
  },
  {
    path: 'inventory/purchases/add',
    loadComponent: () => import('./inventory/purchases/purchaseaddedit/purchaseaddedit.component').then(m => m.PurchaseAddEditComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'inventory.addpurchase' }
  },
  {
    path: 'inventory/purchases/edit/:id',
    loadComponent: () => import('./inventory/purchases/purchaseaddedit/purchaseaddedit.component').then(m => m.PurchaseAddEditComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'inventory.editpurchase' }
  },
  {
    path: 'inventory/purchases/return/:id',
    loadComponent:  () => import('./inventory/purchases/purchasereturn/purchasereturn.component').then(m => m.PurchaseReturnComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'inventory.purchasereturn' }
  },
  {
    path: 'inventory/stocks',
    loadComponent: () => import('./inventory/stocks/stocks.component').then(m => m.StocksComponent),
    canActivate: [AuthGuard],
    data: { permission: 'inventory.stocks' }
  },
  {
    path: 'inventory/stockmovements',
    loadComponent: () => import('./inventory/stockmovements/stockmovements.component').then(m => m.StockMovementsComponent),
    canActivate: [AuthGuard],
    data: { permission:  'inventory.stockmovements' }
  },
  {
    path: 'inventory/stockadjustments',
    loadComponent: () => import('./inventory/stockadjustments/stockadjustments.component').then(m => m.StockAdjustmentsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'inventory.stockadjustments' }
  },

  // Customer Routes
  {
    path:  'customers/list',
    loadComponent: () => import('./customers/customerlist/customerlist.component').then(m => m.CustomerListComponent),
    canActivate: [AuthGuard],
    data: { permission: 'customers.list' }
  },
  {
    path: 'customers/add',
    loadComponent: () => import('./customers/customeraddedit/customeraddedit.component').then(m => m.CustomerAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission: 'customers.add' }
  },
  {
    path: 'customers/edit/:id',
    loadComponent: () => import('./customers/customeraddedit/customeraddedit.component').then(m => m.CustomerAddEditComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'customers.edit' }
  },
  {
    path: 'customers/view/:id',
    loadComponent: () => import('./customers/customerview/customerview.component').then(m => m.CustomerViewComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'customers.view' }
  },
  {
    path: 'customers/feedbacks',
    loadComponent: () => import('./customers/feedbacks/feedbacks.component').then(m => m.FeedbacksComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'customers.feedbacks' }
  },
  {
    path: 'customers/giftcards',
    loadComponent: () => import('./customers/giftcards/giftcards.component').then(m => m.GiftCardsComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'customers.giftcards' }
  },
  {
    path: 'customers/coupons',
    loadComponent: () => import('./customers/coupons/coupons.component').then(m => m.CouponsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'customers.coupons' }
  },

  // Marketing Routes
  {
    path: 'marketing/campaigns',
    loadComponent: () => import('./marketing/campaigns/campaigns.component').then(m => m.CampaignsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'marketing.campaigns' }
  },
  {
    path:  'marketing/campaigns/:id/messages',
    loadComponent: () => import('./marketing/campaignlogs/campaignelogs.component').then(m => m.CampaignLogsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'marketing.campaigns' }
  },

  // Accounting Routes
  {
    path: 'accounting/chartofaccounts',
    loadComponent: () => import('./accounting/chartofaccounts/chartofaccounts.component').then(m => m.ChartOfAccountsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'accounting.chartofaccounts' }
  },
  {
    path: 'accounting/journalentries',
    loadComponent: () => import('./accounting/journalentries/journalentries.component').then(m => m.JournalEntriesComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'accounting.journalentries' }
  },
  {
    path: 'accounting/bankaccounts',
    loadComponent: () => import('./accounting/bankaccounts/bankaccounts.component').then(m => m.BankAccountsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'accounting.bankaccounts' }
  },
  {
    path: 'accounting/deposits',
    loadComponent: () => import('./accounting/deposits/deposits.component').then(m => m.DepositsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'accounting.deposits' }
  },
  {
    path:  'accounting/withdrawals',
    loadComponent: () => import('./accounting/withdrawals/withdrawals.component').then(m => m.WithdrawalsComponent),
    canActivate: [AuthGuard],
    data: { permission:  'accounting.withdrawals' }
  },
  {
    path: 'accounting/transfers',
    loadComponent: () => import('./accounting/transfers/transfers.component').then(m => m.TransfersComponent),
    canActivate: [AuthGuard],
    data: { permission: 'accounting.transfers' }
  },
  {
    path: 'accounting/reconciliations',
    loadComponent: () => import('./accounting/reconciliations/reconciliations.component').then(m => m.ReconciliationsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'accounting.reconciliations' }
  },
  {
    path: 'accounting/expenses',
    loadComponent: () => import('./accounting/expenses/expenses.component').then(m => m.ExpensesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'accounting.expenses' }
  },
  {
    path:  'accounting/expensecategories',
    loadComponent: () => import('./accounting/expensecategories/expensecategories.component').then(m => m.ExpenseCategoriesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'accounting.expensecategories' }
  },
  {
    path: 'accounting/reports',
    loadComponent: () => import('./accounting/accountingreports/accountingreports.component').then(m => m.AccountingReportsComponent),
    canActivate: [AuthGuard],
    data: { permission:  'accounting.reports' }
  },

  // HRM Routes
  {
    path: 'hrm/departments',
    loadComponent: () => import('./hrm/departments/departments.component').then(m => m.DepartmentsComponent),
    canActivate: [AuthGuard],
    data: { permission:  'hrm.departments' }
  },
  {
    path: 'hrm/designations',
    loadComponent: () => import('./hrm/designations/designations.component').then(m => m.DesignationsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.designations' }
  },
  {
    path: 'hrm/shifts',
    loadComponent: () => import('./hrm/shifts/shifts.component').then(m => m.ShiftsComponent),
    canActivate: [AuthGuard],
    data: { permission:  'hrm.shifts' }
  },
  {
    path: 'hrm/employees/list',
    loadComponent: () => import('./hrm/employees/employeelist/employeelist.component').then(m => m.EmployeeListComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.employeelist' }
  },
  {
    path: 'hrm/employees/add',
    loadComponent: () => import('./hrm/employees/employeeaddedit/employeeaddedit.component').then(m => m.EmployeeAddEditComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'hrm.addemployee' }
  },
  {
    path: 'hrm/employees/edit/:id',
    loadComponent: () => import('./hrm/employees/employeeaddedit/employeeaddedit.component').then(m => m.EmployeeAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.editemployee' }
  },
  {
    path:  'hrm/employees/view/:id',
    loadComponent:  () => import('./hrm/employees/employeeview/employeeview.component').then(m => m.EmployeeViewComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.viewemployee' }
  },
  {
    path: 'hrm/attendance/list',
    loadComponent: () => import('./hrm/attendance/attendancelist/attendancelist.component').then(m => m.AttendanceListComponent),
    canActivate: [AuthGuard],
    data: { permission:  'hrm.attendance' }
  },
  {
    path: 'hrm/attendance/add',
    loadComponent: () => import('./hrm/attendance/addattendance/addattendance.component').then(m => m.AddAttendanceComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.attendance' }
  },
  {
    path: 'hrm/payroll',
    loadComponent: () => import('./hrm/payroll/payroll.component').then(m => m.PayrollComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.payroll' }
  },
  {
    path: 'hrm/holidays',
    loadComponent: () => import('./hrm/holidays/holidays.component').then(m => m.HolidaysComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.holidays' }
  },
  {
    path: 'hrm/leaverequests',
    loadComponent: () => import('./hrm/leaverequests/leaverequests.component').then(m => m.LeaveRequestsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.leaverequests' }
  },
  {
    path: 'hrm/reports/attendance',
    loadComponent: () => import('./hrm/reports/attendancereport/attendancereport.component').then(m => m.AttendanceReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'hrm.reports' }
  },

  // Reports Routes
  {
    path:  'reports/salereport',
    loadComponent: () => import('./reports/salesreport/salesreport.component').then(m => m.SalesReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path: 'reports/zxreport',
    loadComponent: () => import('./reports/zxreport/zxreport.component').then(m => m.ZXReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path: 'reports/itemsalesreport',
    loadComponent: () => import('./reports/itemsalesreport/itemsalesreport.component').then(m => m.ItemSalesReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path: 'reports/salesbycategoryreport',
    loadComponent:  () => import('./reports/salesbycategoryreport/salesbycategoryreport.component').then(m => m.SalesByCategoryReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path:  'reports/salesbyordertypereport',
    loadComponent:  () => import('./reports/salesbyordertypereport/salesbyordertypereport.component').then(m => m.SalesByOrderTypereportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path: 'reports/paymentmethodreport',
    loadComponent: () => import('./reports/paymentmethodreport/paymentmethodreport.component').then(m => m.PaymentMethodReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path: 'reports/taxreport',
    loadComponent:  () => import('./reports/taxreport/taxreport.component').then(m => m.TaxReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path: 'reports/salesreturnreport',
    loadComponent: () => import('./reports/salesreturnreport/salesreturnreport.component').then(m => m.SalesReturnReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path: 'reports/purchasereport',
    loadComponent:  () => import('./reports/purchasereport/purchasereport.component').then(m => m.PurchaseReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path:  'reports/purchasereturnreport',
    loadComponent: () => import('./reports/purchasereturnreport/purchasereturnreport.component').then(m => m.PurchaseReturnReportComponent),
    canActivate: [AuthGuard],
    data: { permission:  'reports' }
  },
  {
    path: 'reports/customerreport',
    loadComponent:  () => import('./reports/customerreport/customerreport.component').then(m => m.CustomerReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },
  {
    path: 'reports/supplierreport',
    loadComponent: () => import('./reports/supplierreport/supplierreport.component').then(m => m.SupplierReportComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'reports' }
  },
  {
    path: 'reports/staffreport',
    loadComponent:  () => import('./reports/staffreport/staffreport.component').then(m => m.StaffReportComponent),
    canActivate: [AuthGuard],
    data: { permission: 'reports' }
  },

  // Tools Routes
  {
    path:  'tools/auditlogs',
    loadComponent: () => import('./tools/auditlogs/auditlogs.component').then(m => m.AuditLogsComponent),
    canActivate: [AuthGuard],
    data: { permission:  'tools.auditlogs' }
  },
  {
    path: 'tools/database',
    loadComponent: () => import('./tools/database/database.component').then(m => m.DatabaseComponent),
    canActivate: [AuthGuard],
    data: { permission: 'tools.database' }
  },

  // Settings Routes
  {
    path:  'settings/systemconfig',
    loadComponent: () => import('./settings/systemconfig/systemconfig.component').then(m => m.SystemConfigComponent),
    canActivate: [AuthGuard],
    data: { permission:  'settings.systemconfig' }
  },
  {
    path: 'settings/locations',
    loadComponent: () => import('./settings/locations/locations.component').then(m => m.LocationsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'settings.locations' }
  },
  {
    path: 'settings/paymentmethods',
    loadComponent: () => import('./settings/paymentmethods/paymentmethods.component').then(m => m.PaymentMethodsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'settings.paymentmethods' }
  },
  {
    path: 'settings/templates',
    loadComponent: () => import('./settings/templates/templates.component').then(m => m.TemplatesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'settings.templates' }
  },
  {
    path:  'settings/taxrates',
    loadComponent: () => import('./settings/taxrates/taxrates.component').then(m => m.TaxRatesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'settings.taxrates' }
  },
  {
    path: 'settings/discounts',
    loadComponent: () => import('./settings/discounts/discounts.component').then(m => m.DiscountsComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'settings.discounts' }
  },
  {
    path: 'settings/charges',
    loadComponent: () => import('./settings/charges/charges.component').then(m => m.ChargesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'settings.charges' }
  },
  {
    path: 'settings/languages',
    loadComponent: () => import('./settings/languages/languages.component').then(m => m.LanguagesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'settings.languages' }
  },
  {
    path:  'settings/currencies',
    loadComponent: () => import('./settings/currencies/currencies.component').then(m => m.CurrenciesComponent),
    canActivate: [AuthGuard],
    data: { permission:  'settings.currencies' }
  },
  {
    path: 'settings/cashregisters',
    loadComponent: () => import('./settings/cashregisters/cashregisters.component').then(m => m.CashRegistersComponent),
    canActivate: [AuthGuard],
    data: { permission: 'settings.cashregisters' }
  },

  // Users Routes
  {
    path:  'users/list',
    loadComponent: () => import('./users/userlist/userlist.component').then(m => m.UserListComponent),
    canActivate: [AuthGuard],
    data: { permission: 'users.list' }
  },
  {
    path: 'users/add',
    loadComponent: () => import('./users/useraddoredit/useraddedit.component').then(m => m.UserAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission: 'users.add' }
  },
  {
    path: 'users/edit/:id',
    loadComponent: () => import('./users/useraddoredit/useraddedit.component').then(m => m.UserAddEditComponent),
    canActivate: [AuthGuard],
    data: { permission: 'users.edit' }
  },
  {
    path: 'users/view/:id',
    loadComponent: () => import('./users/userview/userview.component').then(m => m.UserViewComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'users.view' }
  },
  {
    path: 'users/roles',
    loadComponent: () => import('./users/roles/roles.component').then(m => m.RolesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'users.roles' }
  },
  {
    path: 'users/useractivities',
    loadComponent: () => import('./users/useractivities/useractivities.component').then(m => m.UserActivitiesComponent),
    canActivate: [AuthGuard],
    data: { permission: 'users.useractivities' }
  },

  // Profile Routes
  {
    path:  'profile/myprofile',
    loadComponent: () => import('./profile/myprofile/myprofile.component').then(m => m.MyProfileComponent),
    canActivate: [AuthGuard],
    data:  { permission: 'profile' }
  },
  {
    path: 'profile/activitylogs',
    loadComponent: () => import('./profile/activitylogs/activitylogs.component').then(m => m.ActivityLogsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'profile' }
  },
  {
    path: 'profile/notifications',
    loadComponent: () => import('./profile/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [AuthGuard],
    data: { permission: 'profile' }
  },

  // Waiter Route
  {
    path: 'waiter',
    loadComponent: () => import('./waiter/waiter.component').then(m => m.WaiterComponent),
    canActivate: [AuthGuard],
    data: { permission: 'waiter' }
  },

  // Wildcard route
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];