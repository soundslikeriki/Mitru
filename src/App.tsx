import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Calculator,
  ClipboardList,
  FileDown,
  Info,
  PlusCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { BrowserRouter, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppRouter } from "@/features/layout/AppRouter";
import { ErrorBoundary } from "@/features/layout/ErrorBoundary";
import { MainLayout } from "@/features/layout/MainLayout";
import { ToastMessage, type ToastState } from "@/features/shared/ToastMessage";
import { isInlineImageDataUrl, persistImageAssetReference, persistImageAssetReferences } from "@/lib/image-storage";
import { getCurrentUser } from "@/lib/supabase-auth";
import {
  defaultInteriorWorkItemMasterInputs,
  samplePortfolioCustomers,
  samplePortfolioEstimateDocuments,
  samplePortfolioInvoiceDocuments,
  samplePortfolioProjectItems,
  samplePortfolioProjects,
} from "@/stores/defaults";
import { useThemeStore } from "@/stores/theme-store";
import {
  type CompanyInfo,
  useProjectStore,
} from "@/stores/project-store";

const appVersion = "v0.9.7-beta (限定ベータ)";
const localStorageWarningBytes = 4.5 * 1024 * 1024;
const interiorMastersSeedKey = "mitru-interior-masters-seeded-v1";
const essentialInteriorMasterNames = new Set([
  "クッションフロア張り",
  "長尺シート張り",
  "塩ビタイル張り",
  "クロス張り（標準）",
  "ボード下地＋クロス",
  "内部清掃・ハウスクリーニング",
]);

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [globalToast, setGlobalToast] = useState<ToastState>(null);
  const [pendingUpdate, setPendingUpdate] = useState<MitruPendingUpdate | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateProgress, setUpdateProgress] = useState("");
  const theme = useThemeStore((state) => state.theme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );
  const resolvedTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  useEffect(() => {
    if (localStorage.getItem("mitru-onboarding-completed") !== "true") {
      const timer = window.setTimeout(() => setOnboardingOpen(true), 420);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshSupabaseUserOnStartup = async () => {
      const state = useProjectStore.getState();
      const settings = state.cloudSyncSettings;
      console.info("[mitru:cloud-sync] refreshCurrentUser startup sync checked", {
        enabled: settings.isEnabled,
        hasSupabaseUrl: Boolean(settings.supabaseUrl.trim()),
        hasSupabaseAnonKey: Boolean(settings.supabaseAnonKey.trim()),
      });
      if (!settings.isEnabled || !settings.supabaseUrl.trim() || !settings.supabaseAnonKey.trim()) return;

      console.info("[mitru:cloud-sync] refreshCurrentUser startup sync started");
      try {
        const user = await getCurrentUser({
          supabaseUrl: settings.supabaseUrl,
          supabaseAnonKey: settings.supabaseAnonKey,
        });
        if (cancelled) return;
        useProjectStore.getState().updateCloudSyncSettings({
          authState: user ? "authenticated" : "idle",
          user,
          isConnected: user ? settings.isConnected : false,
        });
        console.info("[mitru:cloud-sync] refreshCurrentUser startup sync completed", {
          authenticated: Boolean(user),
          email: user?.email ?? null,
        });
      } catch (error) {
        if (cancelled) return;
        useProjectStore.getState().updateCloudSyncSettings({
          authState: "error",
          user: null,
          isConnected: false,
        });
        console.error("[mitru:cloud-sync] refreshCurrentUser startup sync failed", error);
      }
    };

    void refreshSupabaseUserOnStartup();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkForUpdates = async () => {
      if (!isTauriRuntime()) return;

      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (cancelled || !update) return;

        setPendingUpdate({
          version: update.version,
          body: update.body ?? "",
          date: update.date,
          downloadAndInstall: update.downloadAndInstall.bind(update),
        });
        setUpdateStatus("available");
      } catch (error) {
        console.info("[Mitru] 更新チェックをスキップしました。", error);
      }
    };

    const timer = window.setTimeout(() => void checkForUpdates(), 1800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const openAbout = () => setAboutOpen(true);
    window.addEventListener("mitru-about-open", openAbout);
    return () => window.removeEventListener("mitru-about-open", openAbout);
  }, []);

  useEffect(() => {
    const openOnboarding = () => setOnboardingOpen(true);
    window.addEventListener("mitru-onboarding-open", openOnboarding);
    return () => window.removeEventListener("mitru-onboarding-open", openOnboarding);
  }, []);

  useEffect(() => {
    const showStorageWarning = (event: Event) => {
      const detail = (event as CustomEvent<NonNullable<ToastState>>).detail;
      if (!detail) return;
      setGlobalToast(detail);
      window.setTimeout(() => setGlobalToast(null), 5200);
    };
    window.addEventListener("mitru-storage-warning", showStorageWarning);
    return () => window.removeEventListener("mitru-storage-warning", showStorageWarning);
  }, []);

  useEffect(() => {
    const warningKey = "mitru-local-storage-size-warning-shown";
    const checkStorageSize = () => {
      try {
        const size = estimateLocalStorageBytes();
        if (size < localStorageWarningBytes || sessionStorage.getItem(warningKey) === "true") return;
        sessionStorage.setItem(warningKey, "true");
        setGlobalToast({
          title: "保存データが大きくなっています",
          description: "端末内データが5MBに近づいています。アプリ設定のデータ出力でバックアップを作成してください。",
          tone: "error",
        });
        window.setTimeout(() => setGlobalToast(null), 7200);
      } catch (error) {
        console.warn("[Mitru] localStorageサイズ確認に失敗しました。", error);
      }
    };

    checkStorageSize();
    const intervalId = window.setInterval(checkStorageSize, 60_000);
    window.addEventListener("storage", checkStorageSize);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", checkStorageSize);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemPrefersDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.classList.toggle("light", resolvedTheme === "light");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const state = useProjectStore.getState();
    const interiorMasters = state.workItemMasters.filter((item) => item.majorCategory === "内装工事");
    const hasSeeded = localStorage.getItem(interiorMastersSeedKey) === "done";
    const hasTooFewInteriorMasters = interiorMasters.length < defaultInteriorWorkItemMasterInputs.length;
    const hasMissingEssentialInteriorMaster = defaultInteriorWorkItemMasterInputs.some(
      (master) =>
        essentialInteriorMasterNames.has(master.name) &&
        !interiorMasters.some(
          (item) =>
            item.majorCategory === master.majorCategory &&
            item.name === master.name,
        ),
    );
    const mastersToEnsure =
      interiorMasters.length === 0 || hasTooFewInteriorMasters
        ? defaultInteriorWorkItemMasterInputs
        : defaultInteriorWorkItemMasterInputs.filter((master) => essentialInteriorMasterNames.has(master.name));

    if (!hasSeeded || interiorMasters.length === 0 || hasTooFewInteriorMasters || hasMissingEssentialInteriorMaster) {
      mastersToEnsure.forEach((master) => {
        const currentState = useProjectStore.getState();
        const exists = currentState.workItemMasters.some(
          (item) =>
            item.majorCategory === master.majorCategory &&
            item.name === master.name,
        );
        if (!exists) currentState.createWorkItemMaster(master);
      });
      localStorage.setItem(interiorMastersSeedKey, "done");
    }
    if (!localStorage.getItem("mitru-work-master-cost-zero-v1")) {
      useProjectStore.getState().resetWorkItemMasterCosts();
      localStorage.setItem("mitru-work-master-cost-zero-v1", "done");
    }
  }, []);

  useEffect(() => {
    void migrateExistingInlineImagesToIndexedDb();
  }, []);

  return (
    <ErrorBoundary>
      <MainLayout resolvedTheme={resolvedTheme} onAboutOpen={() => setAboutOpen(true)}>
        <AppRouter />
        <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
        <UpdateDialog
          update={pendingUpdate}
          status={updateStatus}
          progress={updateProgress}
          onClose={() => {
            if (updateStatus === "installing" || updateStatus === "relaunching") return;
            setPendingUpdate(null);
            setUpdateStatus("idle");
            setUpdateProgress("");
          }}
          onInstall={async () => {
            if (!pendingUpdate) return;
            setUpdateStatus("installing");
            setUpdateProgress("更新ファイルをダウンロードしています...");

            try {
              let downloaded = 0;
              let contentLength = 0;

              await pendingUpdate.downloadAndInstall((event) => {
                if (event.event === "Started") {
                  contentLength = event.data.contentLength ?? 0;
                  setUpdateProgress("更新ファイルをダウンロードしています...");
                }
                if (event.event === "Progress") {
                  downloaded += event.data.chunkLength;
                  if (contentLength > 0) {
                    const percent = Math.min(100, Math.round((downloaded / contentLength) * 100));
                    setUpdateProgress(`更新ファイルをダウンロードしています... ${percent}%`);
                  }
                }
                if (event.event === "Finished") {
                  setUpdateProgress("更新をインストールしています...");
                }
              });

              setUpdateStatus("relaunching");
              setUpdateProgress("更新が完了しました。Mitruを再起動します...");
              const { relaunch } = await import("@tauri-apps/plugin-process");
              await relaunch();
            } catch (error) {
              console.error("[Mitru] 更新に失敗しました。", error);
              setUpdateStatus("error");
              setUpdateProgress("更新に失敗しました。時間を置いてもう一度お試しください。");
            }
          }}
        />
        <ToastMessage toast={globalToast} onClose={() => setGlobalToast(null)} />
      </MainLayout>
    </ErrorBoundary>
  );
}

type UpdateStatus = "idle" | "available" | "installing" | "relaunching" | "error";

type UpdaterDownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished"; data?: unknown };

type MitruPendingUpdate = {
  version: string;
  body: string;
  date?: string;
  downloadAndInstall: (onEvent: (event: UpdaterDownloadEvent) => void) => Promise<void>;
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function forceLoadLatestSamplePortfolio() {
  const sampleCustomerIds = new Set(samplePortfolioCustomers.map((customer) => customer.id));
  const sampleProjectIds = new Set(samplePortfolioProjects.map((project) => project.id));
  const sampleEstimateDocumentIds = new Set(samplePortfolioEstimateDocuments.map((document) => document.id));
  const sampleInvoiceDocumentIds = new Set(samplePortfolioInvoiceDocuments.map((document) => document.id));

  useProjectStore.setState((state) => ({
    customers: [
      ...state.customers.filter((customer) => !sampleCustomerIds.has(customer.id)),
      ...samplePortfolioCustomers,
    ],
    projects: [
      ...state.projects.filter((project) => !sampleProjectIds.has(project.id)),
      ...samplePortfolioProjects,
    ],
    projectItems: [
      ...state.projectItems.filter(
        (item) => !sampleProjectIds.has(item.projectId) && !item.id.startsWith("sample-"),
      ),
      ...samplePortfolioProjectItems,
    ],
    costSettingsByProjectId: omitSampleProjectKeys(state.costSettingsByProjectId, sampleProjectIds),
    quoteSettingsByProjectId: omitSampleProjectKeys(state.quoteSettingsByProjectId, sampleProjectIds),
    invoiceSettingsByProjectId: omitSampleProjectKeys(state.invoiceSettingsByProjectId, sampleProjectIds),
    invoiceItemsByItemId: Object.fromEntries(
      Object.entries(state.invoiceItemsByItemId).filter(([itemId]) => !itemId.startsWith("sample-")),
    ),
    sealSettingsByProjectId: omitSampleProjectKeys(state.sealSettingsByProjectId, sampleProjectIds),
    estimateDocuments: [
      ...state.estimateDocuments.filter(
        (document) => !sampleProjectIds.has(document.projectId) && !sampleEstimateDocumentIds.has(document.id),
      ),
      ...samplePortfolioEstimateDocuments,
    ],
    invoiceDocuments: [
      ...state.invoiceDocuments.filter(
        (document) => !sampleProjectIds.has(document.projectId) && !sampleInvoiceDocumentIds.has(document.id),
      ),
      ...samplePortfolioInvoiceDocuments,
    ],
    deliveryDocuments: state.deliveryDocuments.filter((document) => !sampleProjectIds.has(document.projectId)),
    orderDocuments: state.orderDocuments.filter((document) => !sampleProjectIds.has(document.projectId)),
  }));

  const currentState = useProjectStore.getState();
  defaultInteriorWorkItemMasterInputs.forEach((master) => {
    const exists = useProjectStore
      .getState()
      .workItemMasters.some(
        (item) =>
          item.majorCategory === master.majorCategory &&
          item.middleCategory === master.middleCategory &&
          item.name === master.name,
      );
    if (!exists) currentState.createWorkItemMaster(master);
  });
}

function omitSampleProjectKeys<T>(record: Record<string, T>, sampleProjectIds: Set<string>) {
  return Object.fromEntries(Object.entries(record).filter(([projectId]) => !sampleProjectIds.has(projectId)));
}

async function migrateExistingInlineImagesToIndexedDb() {
  const state = useProjectStore.getState();
  const companyInfoUpdates: Partial<CompanyInfo> = {};

  if (isInlineImageDataUrl(state.companyInfo.logoImage)) {
    companyInfoUpdates.logoImage = await persistImageAssetReference(state.companyInfo.logoImage, "company-logoImage");
  }
  if (isInlineImageDataUrl(state.companyInfo.sealImage)) {
    companyInfoUpdates.sealImage = await persistImageAssetReference(state.companyInfo.sealImage, "company-sealImage");
  }
  if (Object.keys(companyInfoUpdates).length > 0) {
    useProjectStore.getState().updateCompanyInfo(companyInfoUpdates);
  }

  for (const customer of state.customers) {
    if (!customer.businessCards.some(isInlineImageDataUrl)) continue;
    const businessCards = await persistImageAssetReferences(customer.businessCards, `customer-${customer.id}-business-card`);
    useProjectStore.getState().updateCustomer(customer.id, { businessCards });
  }
}

function estimateLocalStorageBytes() {
  let total = 0;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    total += key.length + (localStorage.getItem(key)?.length ?? 0);
  }
  return total * 2;
}

function UpdateDialog({
  update,
  status,
  progress,
  onInstall,
  onClose,
}: {
  update: MitruPendingUpdate | null;
  status: UpdateStatus;
  progress: string;
  onInstall: () => Promise<void>;
  onClose: () => void;
}) {
  const isBusy = status === "installing" || status === "relaunching";

  return (
    <Dialog open={Boolean(update)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-white text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white sm:max-w-lg">
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <FileDown className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-normal">
            Mitruの新しいバージョンがあります
          </DialogTitle>
          <DialogDescription className="leading-7 text-slate-600 dark:text-slate-400">
            現在のバージョンは {appVersion} です。最新版へ更新すると、機能改善と不具合修正が適用されます。
          </DialogDescription>
        </DialogHeader>

        {update ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm text-slate-500 dark:text-slate-400">更新バージョン</p>
              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{update.version}</p>
              {update.body ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {update.body}
                </p>
              ) : null}
            </div>

            {progress ? (
              <p className={status === "error" ? "text-sm font-medium text-red-600" : "text-sm text-slate-600 dark:text-slate-300"}>
                {progress}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose} disabled={isBusy}>
                あとで
              </Button>
              <Button
                onClick={() => void onInstall()}
                disabled={isBusy}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isBusy ? "更新中..." : "今すぐ更新"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function OnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [hideNextTime, setHideNextTime] = useState(true);

  const complete = () => {
    if (hideNextTime) localStorage.setItem("mitru-onboarding-completed", "true");
    onOpenChange(false);
  };

  const startWithSample = () => {
    forceLoadLatestSamplePortfolio();
    localStorage.setItem("mitru-onboarding-completed", "true");
    onOpenChange(false);
    navigate(`/projects/${samplePortfolioProjects[0]?.id ?? ""}?tab=calculation`);
  };

  const loadSamplePortfolio = () => {
    forceLoadLatestSamplePortfolio();
    localStorage.setItem("mitru-onboarding-completed", "true");
    onOpenChange(false);
    navigate(`/projects/${samplePortfolioProjects[0]?.id ?? ""}?tab=calculation`);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && hideNextTime) localStorage.setItem("mitru-onboarding-completed", "true");
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="fixed inset-0 left-0 top-0 z-50 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 items-center justify-center overflow-y-auto border-0 bg-transparent p-4 text-white shadow-none sm:max-w-none">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(16,185,129,0.22),transparent_28%),radial-gradient(circle_at_18%_8%,rgba(30,58,138,0.55),transparent_32%)]" />
          <div className="relative grid gap-7 p-6 sm:p-8">
            <DialogHeader>
              <BrandLogo markClassName="size-16" textClassName="text-white" subtitle="ローカルファースト見積・積算" />
              <DialogTitle className="text-3xl font-bold tracking-normal text-white sm:text-4xl">
                Mitruへようこそ
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-7 text-slate-400">
              案件作成から積算、利益確認、書類作成までをローカルで完結。まずは5つの流れだけ覚えれば、すぐ現場の見積業務に入れます。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 md:grid-cols-5">
              {[
                {
                  icon: PlusCircle,
                  title: "案件作成",
                  description: "施主名、工事場所、期間を入力して案件を立ち上げます。",
                },
                {
                  icon: Calculator,
                  title: "積算",
                  description: "工事項目マスタから歩掛と単価を呼び出し、数量で自動計算します。",
                },
                {
                  icon: TrendingUp,
                  title: "利益を見る",
                  description: "粗利率の緑・黄・赤で、儲かるかどうかをすぐ判断します。",
                },
                {
                  icon: FileDown,
                  title: "書類作成",
                  description: "積算から見積書、請求書、納品書へスムーズにつなげます。",
                },
                {
                  icon: ReceiptText,
                  title: "進行管理",
                  description: "次回対応日、書類進捗、入金予定をまとめて確認します。",
                },
              ].map((step, index) => (
                <motion.div
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.06, duration: 0.26 }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="grid size-10 place-items-center rounded-xl bg-emerald-400/[0.12] text-emerald-300">
                      <step.icon className="size-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">0{index + 1}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-slate-400">{step.description}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-emerald-300/40 bg-emerald-400/[0.12] p-4 shadow-[0_18px_60px_rgba(16,185,129,0.12)]">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200/20 bg-white/[0.06] p-3">
                <ClipboardList className="mt-0.5 size-4 shrink-0 text-emerald-200" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-50">まずはサンプル案件で試す（推奨）</p>
                  <p className="text-xs leading-6 text-slate-200">
                    ベータ版では、粗利率の違う実務向けサンプルを読み込むと、積算、見積、請求、入金、発注、レポートまで安全に確認できます。
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={hideNextTime}
                    onChange={(event) => setHideNextTime(event.target.checked)}
                    className="size-4 accent-emerald-500"
                  />
                  次回から表示しない
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="outline" onClick={complete}>
                    あとで始める
                  </Button>
                  <Button onClick={loadSamplePortfolio} className="gap-2 bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                    <ClipboardList className="size-4" />
                    サンプル一式を読み込む
                  </Button>
                  <Button variant="outline" onClick={startWithSample} className="gap-2">
                    <Sparkles className="size-4" />
                    1件だけ試す
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-white/10 bg-slate-950/95 p-0 text-white shadow-2xl shadow-black/45 backdrop-blur-2xl sm:max-w-xl">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(16,185,129,0.22),transparent_30%),radial-gradient(circle_at_12%_0%,rgba(30,58,138,0.48),transparent_36%)]" />
          <div className="relative grid gap-6 p-6 sm:p-7">
            <DialogHeader>
              <BrandLogo markClassName="size-14" textClassName="text-white" subtitle="ローカルファースト見積・積算" />
              <DialogTitle className="text-2xl font-bold tracking-normal text-white">Mitruについて</DialogTitle>
              <DialogDescription className="leading-7">
                建築業のためのローカルファースト見積もり・歩掛積算アプリ。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm">
              <AboutRow label="アプリ名" value="Mitru（ミトル）" />
              <AboutRow label="バージョン" value={appVersion} />
              <AboutRow label="開発者" value="Mitru Project" />
              <AboutRow label="ライセンス" value="Private Preview" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.045] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <Info className="size-4 text-emerald-300" />
                  GitHub
                </div>
                <p className="text-xs leading-5 text-slate-400">現在は未公開です。</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.045] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="size-4 text-emerald-300" />
                  ホームページ
                </div>
                <p className="text-xs leading-5 text-slate-400">現在は未公開です。</p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4 text-xs leading-6 text-slate-300">
              Mitruは完全ローカル動作を前提に設計されています。案件、積算、帳票、会社情報は端末内で扱われます。
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-white">{value}</span>
    </div>
  );
}

export default App;
