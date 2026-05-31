import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { ErrorBoundary } from "./ErrorBoundary";

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const ProjectsPage = lazy(() => import("@/features/projects/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const ProjectDetailPage = lazy(() => import("@/features/projects/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage })));
const CustomersPage = lazy(() => import("@/features/customers/CustomersPage").then((module) => ({ default: module.CustomersPage })));
const CustomerDetailPage = lazy(() => import("@/features/customers/components/CustomerDetail").then((module) => ({ default: module.CustomerDetailPage })));
const EstimatesPage = lazy(() => import("@/features/documents/DocumentListPages").then((module) => ({ default: module.EstimatesPage })));
const InvoicesPage = lazy(() => import("@/features/documents/DocumentListPages").then((module) => ({ default: module.InvoicesPage })));
const PaymentsPage = lazy(() => import("@/features/payments/PaymentsPage").then((module) => ({ default: module.PaymentsPage })));
const BillingClosePage = lazy(() => import("@/features/billing/BillingClosePage").then((module) => ({ default: module.BillingClosePage })));
const PurchasesPage = lazy(() => import("@/features/purchases/PurchasesPage").then((module) => ({ default: module.PurchasesPage })));
const DeliveriesPage = lazy(() => import("@/features/documents/DocumentListPages").then((module) => ({ default: module.DeliveriesPage })));
const OrdersPage = lazy(() => import("@/features/documents/DocumentListPages").then((module) => ({ default: module.OrdersPage })));
const MasterSettingsPage = lazy(() => import("@/features/settings/MasterSettingsPage").then((module) => ({ default: module.MasterSettingsPage })));
const WorkItemMasterSection = lazy(() => import("@/features/masters/sections/WorkItemMasterSection").then((module) => ({ default: module.WorkItemMasterSection })));
const MaterialMasterSection = lazy(() => import("@/features/masters/sections/MaterialMasterSection").then((module) => ({ default: module.MaterialMasterSection })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const CompanyInfoSection = lazy(() => import("@/features/settings/sections/CompanyInfoSection").then((module) => ({ default: module.CompanyInfoSection })));
const SealSettingsSection = lazy(() => import("@/features/settings/sections/SealSettingsSection").then((module) => ({ default: module.SealSettingsSection })));
const CloudSyncSection = lazy(() => import("@/features/settings/sections/CloudSyncSection").then((module) => ({ default: module.CloudSyncSection })));
const DataExportSection = lazy(() => import("@/features/settings/sections/DataExportSection").then((module) => ({ default: module.DataExportSection })));
const DisplaySettingsSection = lazy(() => import("@/features/settings/sections/DisplaySettingsSection").then((module) => ({ default: module.DisplaySettingsSection })));
const DocumentNumberSettingsSection = lazy(() => import("@/features/settings/sections/DocumentNumberSettingsSection").then((module) => ({ default: module.DocumentNumberSettingsSection })));
const TaxSettingsSection = lazy(() => import("@/features/settings/sections/TaxSettingsSection").then((module) => ({ default: module.TaxSettingsSection })));
const HelpPage = lazy(() => import("@/features/help/HelpPage").then((module) => ({ default: module.HelpPage })));

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<RouteBoundary><DashboardPage /></RouteBoundary>} />
      <Route path="/reports" element={<RouteBoundary><ReportsPage /></RouteBoundary>} />
      <Route path="/projects" element={<RouteBoundary><ProjectsPage /></RouteBoundary>} />
      <Route path="/projects/new" element={<RouteBoundary><ProjectsPage createOpen /></RouteBoundary>} />
      <Route path="/projects/:id/estimates" element={<RouteBoundary><ProjectDetailPage /></RouteBoundary>} />
      <Route path="/projects/:id/invoices" element={<RouteBoundary><ProjectDetailPage /></RouteBoundary>} />
      <Route path="/projects/:id" element={<RouteBoundary><ProjectDetailPage /></RouteBoundary>} />
      <Route path="/customers" element={<RouteBoundary><CustomersPage /></RouteBoundary>} />
      <Route path="/customers/:id" element={<RouteBoundary><CustomerDetailPage /></RouteBoundary>} />
      <Route path="/estimates" element={<RouteBoundary><EstimatesPage /></RouteBoundary>} />
      <Route path="/invoices" element={<RouteBoundary><InvoicesPage /></RouteBoundary>} />
      <Route path="/payments" element={<RouteBoundary><PaymentsPage /></RouteBoundary>} />
      <Route path="/billing" element={<RouteBoundary><BillingClosePage /></RouteBoundary>} />
      <Route path="/purchases" element={<RouteBoundary><PurchasesPage /></RouteBoundary>} />
      <Route path="/deliveries" element={<RouteBoundary><DeliveriesPage /></RouteBoundary>} />
      <Route path="/orders" element={<RouteBoundary><OrdersPage /></RouteBoundary>} />
      <Route path="/masters" element={<RouteBoundary><MastersRoute /></RouteBoundary>} />
      <Route path="/settings" element={<RouteBoundary><SettingsRoute /></RouteBoundary>} />
      <Route path="/help" element={<RouteBoundary><HelpPage /></RouteBoundary>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary compact>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function MastersRoute() {
  return (
    <MasterSettingsPage
      workItemSection={<WorkItemMasterSection />}
      materialSection={<MaterialMasterSection />}
    />
  );
}

function SettingsRoute() {
  return (
    <SettingsPage
      companySection={<CompanyInfoSection />}
      sealSection={<SealSettingsSection />}
      documentNumberSection={<DocumentNumberSettingsSection />}
      taxSection={<TaxSettingsSection />}
      cloudSection={<CloudSyncSection />}
      exportSection={<DataExportSection />}
      displaySection={<DisplaySettingsSection />}
    />
  );
}

function RouteLoading() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-2xl border border-white/10 bg-slate-950/55 text-sm font-medium text-slate-400 shadow-2xl shadow-black/20 backdrop-blur-xl">
      読み込み中...
    </div>
  );
}
