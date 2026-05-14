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
import { defaultInteriorWorkItemMasterInputs } from "@/stores/defaults";
import { useThemeStore } from "@/stores/theme-store";
import {
  type CompanyInfo,
  useProjectStore,
} from "@/stores/project-store";

const appVersion = "0.9.6-beta";
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
        <ToastMessage toast={globalToast} onClose={() => setGlobalToast(null)} />
      </MainLayout>
    </ErrorBoundary>
  );
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

function OnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createProject = useProjectStore((state) => state.createProject);
  const updateProject = useProjectStore((state) => state.updateProject);
  const importSampleItems = useProjectStore((state) => state.importSampleItems);
  const [hideNextTime, setHideNextTime] = useState(true);

  const complete = () => {
    if (hideNextTime) localStorage.setItem("mitru-onboarding-completed", "true");
    onOpenChange(false);
  };

  const startWithSample = () => {
    const project = createProject({
      name: "初回サンプル リフォーム工事",
      clientName: "サンプル施主",
      constructionName: "水回り・内装リフォーム",
      location: "東京都サンプル区 Mitru 1-2-3",
      startDate: "2026-05-20",
      endDate: "2026-06-30",
      note: "オンボーディング用のサンプル案件です。積算、見積書、請求書の流れを試せます。",
    });
    importSampleItems(project.id);
    localStorage.setItem("mitru-onboarding-completed", "true");
    onOpenChange(false);
    navigate(`/projects/${project.id}`);
  };

  const loadSamplePortfolio = () => {
    const samples = [
      {
        name: "サンプル 高粗利 内装リフォーム",
        clientName: "高橋 彩",
        constructionName: "マンション内装更新工事",
        location: "東京都杉並区",
        startDate: "2026-05-22",
        endDate: "2026-06-28",
        expectedPaymentDate: "2026-07-31",
        status: "施工中" as const,
        totalAmount: 7200000,
        progress: 62,
        note: "粗利率が高いパターンの確認用サンプルです。",
      },
      {
        name: "サンプル 標準粗利 水回り改修",
        clientName: "小林 誠",
        constructionName: "浴室・洗面・給排水改修",
        location: "神奈川県川崎市",
        startDate: "2026-06-05",
        endDate: "2026-07-20",
        expectedPaymentDate: "2026-08-31",
        status: "契約済" as const,
        totalAmount: 9800000,
        progress: 35,
        note: "標準的な粗利率を想定したサンプルです。",
      },
      {
        name: "サンプル 要注意 原状回復",
        clientName: "",
        clientCompanyName: "株式会社サンプルプロパティ",
        constructionName: "オフィス原状回復工事",
        location: "東京都品川区",
        startDate: "2026-05-12",
        endDate: "2026-06-08",
        expectedPaymentDate: "2026-07-15",
        status: "施工中" as const,
        totalAmount: 4300000,
        progress: 82,
        note: "粗利率が低くなりやすい注意案件のサンプルです。",
      },
      {
        name: "サンプル 完了 請求確認",
        clientName: "森 由紀",
        constructionName: "戸建て部分改装",
        location: "埼玉県川越市",
        startDate: "2026-03-10",
        endDate: "2026-04-26",
        expectedPaymentDate: "2026-05-31",
        status: "完了" as const,
        totalAmount: 5600000,
        progress: 100,
        note: "完了案件として書類と入金予定を見るためのサンプルです。",
      },
    ];

    let firstProjectId = "";
    samples.forEach((sample) => {
      const project = createProject({
        name: sample.name,
        clientName: sample.clientName,
        clientCompanyName: sample.clientCompanyName ?? "",
        constructionName: sample.constructionName,
        location: sample.location,
        startDate: sample.startDate,
        endDate: sample.endDate,
        expectedPaymentDate: sample.expectedPaymentDate,
        nextActionDate: sample.status === "完了" ? "" : "2026-05-18",
        processMemo: sample.status === "完了" ? "引渡し済み。" : "次回打ち合わせで数量と単価を確認。",
        ownerMemo: "サンプルデータです。自由に編集・削除できます。",
        note: sample.note,
      });
      updateProject(project.id, {
        status: sample.status,
        totalAmount: sample.totalAmount,
        progress: sample.progress,
      });
      importSampleItems(project.id);
      if (!firstProjectId) firstProjectId = project.id;
    });

    localStorage.setItem("mitru-onboarding-completed", "true");
    onOpenChange(false);
    navigate(firstProjectId ? `/projects/${firstProjectId}?tab=calculation` : "/projects");
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
