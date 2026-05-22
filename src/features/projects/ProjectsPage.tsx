import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { BarChart3, MapPin, PlusCircle, ShieldAlert, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerCreateDialog } from "@/features/customers/CustomersPage";
import { formatProfitRate } from "@/features/calculation/lib/profit";
import { projectStatusClass } from "@/features/projects/components/ProjectStatusBar";
import { ToastMessage } from "@/features/shared/ToastMessage";
import { getProjectUserLabel } from "@/features/projects/lib/project-utils";
import {
  buildProjectProfitMetrics,
  projectProfitTextClass,
  projectProfitToneClass,
  type ProjectProfitMetrics,
} from "@/features/projects/lib/profit-dashboard";
import { type Customer, type NewProjectInput, type Project, type ProjectStatus, useProjectStore } from "@/stores/project-store";

const statusOptions: Array<ProjectStatus | "すべて"> = [
  "すべて",
  "見積中",
  "契約済",
  "施工中",
  "完了",
  "請求済み",
  "請求締済",
  "失注",
  "破棄",
];
const requiredFieldsMessage = "未入力の情報があります。すべての必須項目を入力してください。";
const listDeleteButtonClass =
  "text-slate-500 hover:border-red-300/50 hover:bg-red-500/10 hover:text-red-500 dark:text-slate-400 dark:hover:border-red-400/30 dark:hover:bg-red-500/10 dark:hover:text-red-300";
type ProjectSortMode = "updated" | "project-number" | "margin-desc" | "risk";

type ProjectsPageProps = {
  createOpen?: boolean;
};

export function ProjectsPage({ createOpen = false }: ProjectsPageProps) {
  const navigate = useNavigate();
  const allProjects = useProjectStore((state) => state.projects);
  const projectItems = useProjectStore((state) => state.projectItems);
  const [status, setStatus] = useState<ProjectStatus | "すべて">("すべて");
  const [riskOnly, setRiskOnly] = useState(false);
  const [sortMode, setSortMode] = useState<ProjectSortMode>("updated");
  const projects = useMemo(() => allProjects.filter((project) => !project.deletedAt), [allProjects]);

  const filteredProjects = useMemo(() => {
    return buildProjectProfitMetrics(projects, projectItems)
      .filter((metric) => {
        const project = metric.project;
        const matchesStatus = status === "すべて" || project.status === status;
        const matchesRisk = !riskOnly || metric.actualGrossMarginRate < 0.3;

        return matchesStatus && matchesRisk;
      })
      .sort((a, b) => {
        if (sortMode === "project-number") return compareProjectNumbers(a.project.projectNumber, b.project.projectNumber);
        if (sortMode === "margin-desc") return b.actualGrossMarginRate - a.actualGrossMarginRate;
        if (sortMode === "risk") return riskRank(b) - riskRank(a);
        return Date.parse(b.project.updatedAt) - Date.parse(a.project.updatedAt);
      });
  }, [projectItems, projects, riskOnly, sortMode, status]);

  return (
    <div className="w-full max-w-none">
      <motion.div
        className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-500" htmlFor="status-filter">
            ステータス
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus | "すべて")}
            className="h-10 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option} className="bg-slate-950 text-white">
                {option}
              </option>
            ))}
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as ProjectSortMode)}
            className="h-10 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
            aria-label="並び替え"
          >
            <option value="updated" className="bg-slate-950 text-white">更新日順</option>
            <option value="project-number" className="bg-slate-950 text-white">案件No順</option>
            <option value="margin-desc" className="bg-slate-950 text-white">粗利率が高い順</option>
            <option value="risk" className="bg-slate-950 text-white">危険度順</option>
          </select>
          <button
            type="button"
            onClick={() => setRiskOnly((current) => !current)}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
              riskOnly
                ? "border-red-300 bg-red-100 text-red-800 shadow-sm shadow-red-950/5 ring-1 ring-red-300/40 hover:bg-red-200 dark:border-red-400/40 dark:bg-red-400/[0.16] dark:text-red-100 dark:ring-red-400/25 dark:hover:bg-red-400/[0.22]"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <ShieldAlert className="size-4" />
            粗利30%未満
          </button>
        </div>
        <Button asChild className="w-fit gap-2 lg:ml-auto">
          <Link to="/projects/new">
            <PlusCircle className="size-4" />
            新規作成
          </Link>
        </Button>
      </motion.div>

      <motion.div
        className="grid gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.34 }}
      >
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <ProjectsDataTable projects={filteredProjects} />
        </section>
      </motion.div>

      <ProjectCreateDialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) navigate("/projects");
        }}
      />
    </div>
  );
}

function ProjectsDataTable({ projects }: { projects: ProjectProfitMetrics[] }) {
  const navigate = useNavigate();
  const updateProject = useProjectStore((state) => state.updateProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const cloudUser = useProjectStore((state) => state.cloudSyncSettings.user);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const handleDeleteProject = () => {
    if (!deleteTarget) return;

    deleteProject(deleteTarget.id);
    setToast({
      title: "案件を削除しました",
      description: `${deleteTarget.name} を削除しました。`,
    });
    setDeleteTarget(null);
    window.setTimeout(() => setToast(null), 3600);
  };

  const columns = useMemo<ColumnDef<ProjectProfitMetrics>[]>(
    () => [
      {
        accessorKey: "project.projectNumber",
        header: "案件No.",
        cell: ({ row }) => (
          <span className="inline-flex min-w-[104px] rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-emerald-800 shadow-sm shadow-emerald-950/5 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
            {row.original.project.projectNumber || "未採番"}
          </span>
        ),
      },
      {
        accessorKey: "project.name",
        header: "案件名",
        cell: ({ row }) => (
          <div className="min-w-[260px] max-w-[320px] whitespace-normal break-keep">
            <p className="font-medium leading-relaxed text-white">{row.original.project.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{row.original.project.constructionName}</p>
          </div>
        ),
      },
      {
        accessorKey: "project.clientName",
        header: "顧客名",
        cell: ({ row }) => <span className="inline-block min-w-[120px]">{getProjectClientLabel(row.original.project)}</span>,
      },
      {
        accessorKey: "location",
        header: "工事場所",
        cell: ({ row }) => (
          <span className="inline-flex min-w-[220px] items-center gap-2 text-slate-300">
            <MapPin className="size-3.5 text-emerald-400" />
            {row.original.project.location}
          </span>
        ),
      },
      {
        id: "period",
        header: "工事期間",
        cell: ({ row }) => `${formatDate(row.original.project.startDate)} - ${formatDate(row.original.project.endDate)}`,
      },
      {
        accessorKey: "project.totalAmount",
        header: "契約金額",
        cell: ({ row }) => formatCurrency(row.original.project.totalAmount),
      },
      {
        id: "profit",
        header: "利益",
        cell: ({ row }) => (
          <div className="min-w-[170px]">
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <span className="text-slate-500">予定</span>
              <span className="text-right font-semibold tabular-nums text-slate-300">{formatCurrency(row.original.estimatedGrossProfit)}</span>
              <span className="text-slate-500">実行</span>
              <span className={`text-right font-bold tabular-nums ${projectProfitTextClass(row.original.riskLevel)}`}>
                {formatCurrency(row.original.actualGrossProfit)}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "margin",
        header: "粗利率",
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums ${projectProfitToneClass(row.original.riskLevel)}`}>
              {formatProfitRate(row.original.actualGrossMarginRate)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "project.status",
        header: "進捗状況",
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <ProjectStatusSelect
              status={row.original.project.status}
              onChange={(nextStatus) => updateProject(row.original.project.id, { status: nextStatus })}
            />
          </div>
        ),
      },
      {
        id: "assignedTo",
        header: "担当",
        cell: ({ row }) => (
          <span className="inline-flex min-w-[96px] rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-300">
            {getProjectUserLabel(row.original.project.assignedTo, cloudUser)}
          </span>
        ),
      },
      {
        id: "next-action",
        header: "次回対応",
        cell: ({ row }) => {
          const date = row.original.project.nextActionDate;
          const tone = getNextActionTone(date);
          return (
            <div className="min-w-[120px]">
              <p className={`text-sm font-semibold ${tone.className}`}>{date ? formatDate(date) : "未設定"}</p>
              <p className="mt-1 text-xs text-slate-500">{tone.label}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "project.updatedAt",
        header: "更新日",
        cell: ({ row }) => formatDate(row.original.project.updatedAt),
      },
      {
        id: "profit-action",
        header: "予実",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-emerald-300 hover:bg-emerald-400/[0.10] hover:text-emerald-200"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/projects/${row.original.project.id}?tab=calculation`);
            }}
          >
            <BarChart3 className="size-4" />
            入力
          </Button>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">操作</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`${listDeleteButtonClass} size-9 rounded-lg`}
              aria-label={`${row.original.project.name}を削除`}
              title="削除"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget(row.original.project);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [cloudUser, deleteProject, navigate, updateProject],
  );

  const table = useReactTable({
    data: projects,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <Table className="min-w-[1900px]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row, index) => (
              <motion.tr
                key={row.id}
                data-project-id={row.original.project.id}
                className="cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.04]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.025, duration: 0.22 }}
                onClick={() => navigate(`/projects/${row.original.project.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-slate-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </motion.tr>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-slate-500">
                条件に一致する案件がありません。
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DeleteDocumentDialog
        open={Boolean(deleteTarget)}
        title="この案件を削除しますか？"
        description="削除すると復元できません。"
        targetName={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteProject}
      />
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

function ProjectCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createProject = useProjectStore((state) => state.createProject);
  const allCustomers = useProjectStore((state) => state.customers);
  const customers = useMemo(() => allCustomers.filter((customer) => !customer.deletedAt), [allCustomers]);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [form, setForm] = useState<NewProjectInput>({
    customerId: "",
    name: "",
    clientName: "",
    clientCompanyName: "",
    constructionName: "",
    location: "",
    startDate: "",
    endDate: "",
    expectedPaymentDate: "",
    note: "",
  });

  const updateField = (field: keyof NewProjectInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedCustomer = customers.find((customer) => customer.id === form.customerId);
    const effectiveClientName = form.clientName.trim() || selectedCustomer?.name.trim() || "";
    const effectiveClientCompanyName = form.clientCompanyName?.trim() || selectedCustomer?.companyName.trim() || "";
    if (!form.name.trim() || (!effectiveClientName && !effectiveClientCompanyName) || !form.constructionName.trim() || !form.location.trim() || !form.startDate.trim() || !form.endDate.trim()) {
      window.alert(requiredFieldsMessage);
      return;
    }
    const project = createProject({
      ...form,
      clientName: effectiveClientName,
      clientCompanyName: effectiveClientCompanyName,
    });
    setForm({
      customerId: "",
      name: "",
      clientName: "",
      clientCompanyName: "",
      constructionName: "",
      location: "",
      startDate: "",
      endDate: "",
      expectedPaymentDate: "",
      note: "",
    });
    navigate(`/projects`);
    window.setTimeout(() => {
      const row = document.querySelector(`[data-project-id="${project.id}"]`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新規案件作成</DialogTitle>
          <DialogDescription>
            案件の基本情報を入力してください。作成後、一覧にすぐ反映されます。
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="顧客を選択">
              <div className="flex min-w-0 gap-2">
                <select
                  value={form.customerId ?? ""}
                  onChange={(event) => {
                    const customer = customers.find((item) => item.id === event.target.value);
                    updateField("customerId", event.target.value);
                    if (customer) {
                      updateField("clientName", customer.name);
                      updateField("clientCompanyName", customer.companyName);
                      updateField("location", customer.address);
                    } else {
                      updateField("clientName", "");
                      updateField("clientCompanyName", "");
                    }
                  }}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
                >
                  <option value="" className="bg-slate-950 text-white">顧客未選択</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id} className="bg-slate-950 text-white">
                      {formatCustomerOptionLabel(customer)}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" className="h-10 shrink-0 px-3" onClick={() => setCustomerCreateOpen(true)}>
                  新規
                </Button>
              </div>
            </Field>
            <Field label="案件名">
              <Input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="例: 青葉台 戸建リノベーション"
              />
            </Field>
            <Field label="顧客名">
              <Input
                value={form.clientName}
                onChange={(event) => updateField("clientName", event.target.value)}
                placeholder="顧客選択時は自動入力されます"
              />
            </Field>
            <Field label="会社名">
              <Input
                value={form.clientCompanyName ?? ""}
                onChange={(event) => updateField("clientCompanyName", event.target.value)}
                placeholder="会社名がある場合に入力"
              />
            </Field>
            <Field label="工事名">
              <Input
                value={form.constructionName}
                onChange={(event) => updateField("constructionName", event.target.value)}
                placeholder="例: 全面改修工事"
              />
            </Field>
            <Field label="住所">
              <Input
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="例: 東京都世田谷区"
              />
            </Field>
            <Field label="開始予定日">
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) => updateField("startDate", event.target.value)}
                placeholder="2026-07-01"
              />
            </Field>
            <Field label="終了予定日">
              <Input
                type="date"
                value={form.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
                placeholder="2026-09-20"
              />
            </Field>
            <Field label="入金予定日">
              <Input
                type="date"
                value={form.expectedPaymentDate ?? ""}
                onChange={(event) => updateField("expectedPaymentDate", event.target.value)}
                placeholder="2026-10-20"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="備考">
                <textarea
                  value={form.note}
                  onChange={(event) => updateField("note", event.target.value)}
                  className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
                  placeholder="現地条件、見積メモ、施主要望など"
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" className="gap-2">
              <PlusCircle className="size-4" />
              作成する
            </Button>
          </div>
        </form>
        <CustomerCreateDialog
          open={customerCreateOpen}
          onOpenChange={setCustomerCreateOpen}
          onCreated={(customer) => {
            updateField("customerId", customer.id);
            updateField("clientName", customer.name);
            updateField("clientCompanyName", customer.companyName);
            updateField("location", customer.address);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeleteDocumentDialog({
  open,
  title,
  description,
  targetName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  targetName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            {targetName ? <span className="mt-2 block text-slate-300">対象: {targetName}</span> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>キャンセル</Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirm}>削除する</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function ProjectStatusSelect({
  status,
  onChange,
}: {
  status: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
}) {
  const displayStatus = status;

  return (
    <select
      value={displayStatus}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        onChange(event.target.value as ProjectStatus);
      }}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition ${projectStatusClass(displayStatus as ProjectStatus)}`}
      aria-label="案件ステータス"
    >
      {statusOptions.filter((option): option is ProjectStatus => option !== "すべて").map((option) => (
        <option key={option} value={option} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
          {option}
        </option>
      ))}
    </select>
  );
}

function getNextActionTone(value?: string) {
  if (!value) return { label: "対応日なし", className: "text-slate-400" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: "期限超過", className: "text-red-300" };
  if (days <= 3) return { label: "要確認", className: "text-amber-300" };
  return { label: "予定済み", className: "text-emerald-300" };
}

function compareProjectNumbers(a?: string, b?: string) {
  const parsedA = parseProjectNumber(a);
  const parsedB = parseProjectNumber(b);
  if (parsedA.year !== parsedB.year) return parsedB.year - parsedA.year;
  if (parsedA.sequence !== parsedB.sequence) return parsedA.sequence - parsedB.sequence;
  return String(a ?? "").localeCompare(String(b ?? ""), "ja");
}

function parseProjectNumber(value?: string) {
  const match = String(value ?? "").match(/^(\d{4})-(\d+)$/);
  return {
    year: match ? Number(match[1]) : 0,
    sequence: match ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
  };
}

function getProjectClientLabel(project: Pick<Project, "clientName" | "clientCompanyName">) {
  return project.clientName?.trim() || project.clientCompanyName?.trim() || "-";
}

function formatCustomerOptionLabel(customer: Pick<Customer, "name" | "companyName">) {
  const name = customer.name.trim();
  const companyName = customer.companyName.trim();
  if (name && companyName) return `${name}（${companyName}）`;
  return name || companyName || "名称未設定";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function riskRank(metric: ProjectProfitMetrics) {
  if (metric.riskLevel === "danger") return 3;
  if (metric.riskLevel === "watch") return 2;
  return 1;
}

function formatDate(value: string) {
  if (!value) return "-";
  return value.replaceAll("-", "/");
}
