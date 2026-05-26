import { useMemo, useState } from "react";
import { ClipboardList, FileText, PackageCheck, ReceiptText, Search, ShoppingCart } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSidebar } from "@/features/layout/Sidebar";
import { getHeaderMeta } from "@/features/layout/navigation";
import { useProjectStore } from "@/stores/project-store";

type GlobalSearchResult = {
  id: string;
  kind: "project" | "estimate" | "invoice" | "delivery" | "order";
  title: string;
  description: string;
  date: string;
  path: string;
  badge: string;
};

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const allProjects = useProjectStore((state) => state.projects);
  const allEstimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const allInvoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const deliveryDocuments = useProjectStore((state) => state.deliveryDocuments);
  const orderDocuments = useProjectStore((state) => state.orderDocuments);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const headerMeta = getHeaderMeta(location.pathname);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const projects = useMemo(() => allProjects.filter((project) => !project.deletedAt), [allProjects]);
  const estimateDocuments = useMemo(
    () => allEstimateDocuments.filter((document) => !document.deletedAt),
    [allEstimateDocuments],
  );
  const invoiceDocuments = useMemo(
    () => allInvoiceDocuments.filter((document) => !document.deletedAt),
    [allInvoiceDocuments],
  );
  const searchResults = useMemo<GlobalSearchResult[]>(() => {
    if (!normalizedSearchQuery) return [];

    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const results: GlobalSearchResult[] = [];

    projects.forEach((project) => {
      const fields = [
        project.projectNumber,
        project.name,
        project.clientName,
        project.clientCompanyName,
        project.constructionName,
        project.location,
        project.status,
      ];
      if (!matchesSearch(fields, normalizedSearchQuery)) return;
      results.push({
        id: `project-${project.id}`,
        kind: "project",
        title: `${project.projectNumber || "未採番"} / ${project.name}`,
        description: project.clientName || project.clientCompanyName || "顧客未設定",
        date: project.startDate || project.updatedAt,
        path: `/projects/${project.id}`,
        badge: "案件",
      });
    });

    estimateDocuments.forEach((document) => {
      const project = projectMap.get(document.projectId);
      const fields = [
        document.documentNumber,
        document.title,
        document.status,
        project?.projectNumber,
        project?.name,
        project?.clientName,
        project?.clientCompanyName,
        project?.constructionName,
      ];
      if (!matchesSearch(fields, normalizedSearchQuery)) return;
      results.push({
        id: `estimate-${document.id}`,
        kind: "estimate",
        title: document.documentNumber,
        description: `${project?.name ?? "不明な案件"} / ${project?.clientName || project?.clientCompanyName || "顧客未設定"}`,
        date: document.issuedAt || document.updatedAt,
        path: `/projects/${document.projectId}/estimates?document=${document.id}`,
        badge: "見積書",
      });
    });

    invoiceDocuments.forEach((document) => {
      const project = projectMap.get(document.projectId);
      const fields = [
        document.documentNumber,
        document.status,
        project?.projectNumber,
        project?.name,
        project?.clientName,
        project?.clientCompanyName,
        project?.constructionName,
      ];
      if (!matchesSearch(fields, normalizedSearchQuery)) return;
      results.push({
        id: `invoice-${document.id}`,
        kind: "invoice",
        title: document.documentNumber,
        description: `${project?.name ?? "不明な案件"} / ${project?.clientName || project?.clientCompanyName || "顧客未設定"}`,
        date: document.invoiceDate || document.updatedAt,
        path: `/projects/${document.projectId}/invoices?document=${document.id}`,
        badge: "請求書",
      });
    });

    deliveryDocuments.forEach((document) => {
      const project = projectMap.get(document.projectId);
      const fields = [
        document.documentNumber,
        document.title,
        project?.projectNumber,
        project?.name,
        project?.clientName,
        project?.clientCompanyName,
        project?.constructionName,
      ];
      if (!matchesSearch(fields, normalizedSearchQuery)) return;
      results.push({
        id: `delivery-${document.id}`,
        kind: "delivery",
        title: document.documentNumber,
        description: `${project?.name ?? "不明な案件"} / ${project?.clientName || project?.clientCompanyName || "顧客未設定"}`,
        date: document.deliveryDate || document.issuedAt,
        path: "/deliveries",
        badge: "納品書",
      });
    });

    orderDocuments.forEach((document) => {
      const project = projectMap.get(document.projectId);
      const fields = [
        document.documentNumber,
        document.title,
        document.supplierName,
        project?.projectNumber,
        project?.name,
        project?.clientName,
        project?.clientCompanyName,
        project?.constructionName,
      ];
      if (!matchesSearch(fields, normalizedSearchQuery)) return;
      results.push({
        id: `order-${document.id}`,
        kind: "order",
        title: document.documentNumber,
        description: `${project?.name ?? "不明な案件"} / ${document.supplierName || "発注先未設定"}`,
        date: document.orderedAt || document.updatedAt,
        path: "/orders",
        badge: "注文書",
      });
    });

    return results
      .sort((a, b) => getTime(b.date) - getTime(a.date))
      .slice(0, 8);
  }, [deliveryDocuments, estimateDocuments, invoiceDocuments, normalizedSearchQuery, orderDocuments, projects]);
  const showSuggestions = searchFocused && normalizedSearchQuery.length > 0;

  const openSearchResult = (result: GlobalSearchResult) => {
    setSearchQuery("");
    setSearchFocused(false);
    setSearchDialogOpen(false);
    navigate(result.path);
  };

  return (
    <header className="sticky top-0 z-20 flex h-[72px] min-w-0 items-center justify-between overflow-visible border-b border-white/10 bg-slate-950/55 px-4 backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="flex shrink-0 items-center gap-3">
        <MobileSidebar />
        <BrandLogo className="sm:hidden" markClassName="size-10" textClassName="text-white" />
      </div>

      <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-between gap-3 pl-4 md:pl-0 lg:gap-5">
        <div className="min-w-[140px] flex-none shrink-0 overflow-hidden leading-tight sm:min-w-[190px] lg:min-w-[220px] xl:min-w-[250px]">
          <p className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap break-keep text-[0.72rem] font-medium uppercase tracking-[0.08em] text-slate-400 [text-orientation:mixed] [writing-mode:horizontal-tb] dark:text-slate-500 sm:text-[0.78rem]">
            {headerMeta.englishSection}
          </p>
          <h1 className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap break-keep text-lg font-semibold tracking-normal text-slate-900 [text-orientation:mixed] [writing-mode:horizontal-tb] dark:text-white sm:text-xl xl:text-2xl">
            {headerMeta.section}
          </h1>
        </div>
        <div className="relative hidden lg:block">
          <label className="flex h-10 w-[240px] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-400 transition focus-within:border-emerald-400/55 focus-within:bg-white/[0.09] xl:w-[min(30vw,360px)] xl:min-w-[300px]">
            <Search className="size-4 shrink-0" />
            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchFocused(true);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 140)}
              placeholder="案件No.・案件名・顧客名・書類番号で検索"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
          {showSuggestions && (
            <SearchResultsPanel results={searchResults} onSelect={openSearchResult} className="absolute right-0 top-12 z-50 w-[360px]" />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setSearchDialogOpen(true);
            setSearchFocused(false);
          }}
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-300 transition hover:border-emerald-400/40 hover:bg-white/[0.09] hover:text-white lg:hidden"
          aria-label="検索を開く"
        >
          <Search className="size-4" />
        </button>
      </div>
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl gap-4 p-5 md:left-[calc(280px+((100vw-280px)/2))] md:w-[calc(100vw-312px)]">
          <DialogHeader>
            <DialogTitle>案件・書類を検索</DialogTitle>
          </DialogHeader>
          <label className="flex h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-400 transition focus-within:border-emerald-400/55 focus-within:bg-white/[0.09]">
            <Search className="size-4 shrink-0" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              autoFocus
              placeholder="案件No.・案件名・顧客名・書類番号で検索"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
          {normalizedSearchQuery ? (
            <SearchResultsPanel results={searchResults} onSelect={openSearchResult} className="max-h-[55vh] w-full" />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
              検索キーワードを入力してください。
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}

function matchesSearch(values: Array<string | undefined>, query: string) {
  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function getTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function SearchResultIcon({ kind }: { kind: GlobalSearchResult["kind"] }) {
  if (kind === "estimate") return <FileText className="size-4" />;
  if (kind === "invoice") return <ReceiptText className="size-4" />;
  if (kind === "delivery") return <PackageCheck className="size-4" />;
  if (kind === "order") return <ShoppingCart className="size-4" />;
  return <ClipboardList className="size-4" />;
}

function SearchResultsPanel({
  results,
  onSelect,
  className = "",
}: {
  results: GlobalSearchResult[];
  onSelect: (result: GlobalSearchResult) => void;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/35 backdrop-blur-xl ${className}`}>
      {results.length > 0 ? (
        <div className="max-h-[320px] overflow-auto py-1">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(result)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.07]"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300">
                <SearchResultIcon kind={result.kind} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{result.title}</span>
                <span className="mt-1 block truncate text-xs text-slate-400">{result.description}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">{result.badge}</span>
                <span className="text-[11px] text-slate-500">{formatDate(result.date)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4 text-sm text-slate-400">一致する案件・書類がありません</div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}
