import type { Customer, Project } from "@/stores/project-store";
import type { ProjectDetailTab } from "@/features/projects/types";
import type { CloudSyncUser } from "@/stores/project-store";

export function getProjectClientLabel(project: Pick<Project, "clientName" | "clientCompanyName">) {
  return project.clientName?.trim() || project.clientCompanyName?.trim() || "-";
}

export function getProjectCompanyName(project: Pick<Project, "clientCompanyName" | "customerId">, customers: Customer[]) {
  return project.clientCompanyName?.trim() || customers.find((customer) => customer.id === project.customerId)?.companyName.trim() || "";
}

export function formatCustomerOptionLabel(customer: Pick<Customer, "name" | "companyName">) {
  const name = customer.name.trim();
  const companyName = customer.companyName.trim();
  if (name && companyName) return `${name}（${companyName}）`;
  return name || companyName || "名称未設定";
}

export function getProjectUserLabel(userId: string | null | undefined, currentUser?: CloudSyncUser | null) {
  if (!userId) return "未担当";
  if (userId === "local") return "ローカル";
  if (currentUser?.id === userId) return currentUser.name || currentUser.email || "自分";
  return userId;
}

export function detailTabClass(active: boolean) {
  return active
    ? "relative rounded-md border-2 border-emerald-600 bg-emerald-600 text-white shadow-md ring-1 ring-emerald-600/15 dark:border-emerald-400/70 dark:bg-[#172F73] dark:text-white dark:shadow-lg dark:shadow-blue-950/30 dark:ring-emerald-400/25"
    : "relative rounded-md border border-slate-300 bg-white/70 text-slate-600 shadow-sm ring-0 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-white";
}

export function normalizeProjectDetailTab(tab: string | null): ProjectDetailTab | null {
  const validTabs = new Set<ProjectDetailTab>(["overview", "progress", "calculation", "estimate", "invoice"]);
  return tab && validTabs.has(tab as ProjectDetailTab) ? (tab as ProjectDetailTab) : null;
}

export function getProjectDetailTabFromLocation(pathname: string, search: string) {
  if (pathname.endsWith("/estimates")) return "estimate";
  if (pathname.endsWith("/invoices")) return "invoice";
  return new URLSearchParams(search).get("tab");
}
