import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  getProjectCompanyName,
  getProjectDetailTabFromLocation,
  normalizeProjectDetailTab,
} from "@/features/projects/lib/project-utils";
import type { ProjectDetailTab } from "@/features/projects/types";
import type { Project, ProjectStatus } from "@/stores/project-store";
import { useProjectStore } from "@/stores/project-store";

export function useProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const project = useProjectStore((state) =>
    state.projects.find((candidate) => candidate.id === id && !candidate.deletedAt),
  );
  const updateProject = useProjectStore((state) => state.updateProject);
  const allCustomers = useProjectStore((state) => state.customers);
  const customers = useMemo(() => allCustomers.filter((customer) => !customer.deletedAt), [allCustomers]);
  const [form, setForm] = useState<Project | undefined>(project);
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>("overview");
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);
  const linkedCustomer = project
    ? customers.find(
        (customer) =>
          customer.id === project.customerId ||
          (customer.name && customer.name === project.clientName) ||
          (customer.companyName && customer.companyName === project.clientCompanyName),
      )
    : undefined;

  useEffect(() => {
    setForm(project);
  }, [project]);

  useEffect(() => {
    const tab = getProjectDetailTabFromLocation(location.pathname, location.search);
    const normalizedTab = normalizeProjectDetailTab(tab);
    setActiveTab(normalizedTab ?? "overview");
  }, [location.pathname, location.search]);

  const updateField = (field: keyof Project, value: string | number) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project || !form) return;
    updateProject(project.id, {
      name: form.name,
      clientName: form.clientName,
      clientCompanyName: form.clientCompanyName ?? getProjectCompanyName(project, customers),
      constructionName: form.constructionName,
      location: form.location,
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status as ProjectStatus,
      totalAmount: Number(form.totalAmount) || 0,
      customerId: form.customerId,
      expectedPaymentDate: form.expectedPaymentDate,
      nextActionDate: form.nextActionDate,
      processMemo: form.processMemo,
      ownerMemo: form.ownerMemo,
      note: form.note,
    });
    setToast({
      title: "基本情報を保存しました",
      description: "案件の基本情報を更新しました。",
    });
    window.setTimeout(() => setToast(null), 3600);
  };

  const handleProjectTabChange = (tab: string) => {
    if (!project) return;
    const normalizedTab = normalizeProjectDetailTab(tab) ?? "overview";
    setActiveTab(normalizedTab);

    if (normalizedTab === "estimate") {
      navigate(`/projects/${project.id}/estimates`);
      return;
    }
    if (normalizedTab === "invoice") {
      navigate(`/projects/${project.id}/invoices`);
      return;
    }
    if (normalizedTab === "calculation") {
      navigate(`/projects/${project.id}?tab=calculation`);
      return;
    }
    if (normalizedTab === "progress") {
      navigate(`/projects/${project.id}?tab=progress`);
      return;
    }
    navigate(`/projects/${project.id}`);
  };

  return {
    activeTab,
    customers,
    form,
    handleProjectTabChange,
    handleSave,
    linkedCustomer,
    project,
    setToast,
    toast,
    updateField,
  };
}
