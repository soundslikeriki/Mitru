import {
  AlertTriangle,
  Activity,
  BookOpen,
  Building2,
  ChevronDown,
  Cloud,
  DatabaseBackup,
  ExternalLink,
  HelpCircle,
  Printer,
  ReceiptText,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router";
import {
  getWorkMasterCategory,
  needsDefaultWorkItemMasterRepair,
} from "@/features/masters/lib/work-item-master-seed";
import { useProjectStore } from "@/stores/project-store";

type GuideSection = {
  id: string;
  title: string;
  icon: typeof BookOpen;
  lead: string;
  items?: string[];
  steps?: string[];
  note?: string;
  warning?: string;
};

const guideSections: GuideSection[] = [
  {
    id: "basic",
    title: "1. Mitruの基本",
    icon: Building2,
    lead:
      "Mitruは、建築・内装工事向けの見積・請求・納品・注文管理アプリです。基本データは端末内に保存され、クラウド同期を使わなくても利用できます。",
    items: [
      "見積書、請求書、納品書、注文書を案件ごとに作成できます。",
      "クラウド同期は任意機能です。オフラインでも基本機能を利用できます。",
      "PDF保存は「印刷用HTMLを書き出す」からブラウザ印刷で保存する流れが正式ルートです。",
    ],
  },
  {
    id: "first-setup",
    title: "2. 初回設定",
    icon: ShieldCheck,
    lead: "最初に会社情報とマスタを整えると、帳票作成までスムーズに進められます。",
    steps: [
      "設定 > 会社情報 を入力する",
      "必要に応じて 設定 > 印影設定 でロゴ・社判を登録する",
      "工事項目マスタ / 材料マスタを確認する",
      "案件を作成する",
      "案件内で見積書を作成する",
    ],
    note: "会社情報は帳票に表示されます。振込先口座は主に請求書で使われます。ロゴ・社判は後からでも設定できます。",
  },
  {
    id: "seal",
    title: "3. ロゴ・社判 / 印影設定",
    icon: Stamp,
    lead:
      "ロゴ・社判は、設定 > 印影設定 から登録できます。細かい配置は、各書類のプレビュー画面で確認しながら調整できます。",
    items: [
      "ロゴ・社判は通常プレビューと印刷用HTMLに反映されます。",
      "設定画面内では実帳票プレビューを表示しません。最終確認は各書類の通常プレビューで行います。",
      "プレビューの印影配置調整モードで配置値を表示し、設定 > 印影設定 に貼り付けて保存してください。",
      "配置値は0〜1000の相対座標で管理されます。端末や表示倍率が変わっても扱いやすい形式です。",
    ],
    note: "ロゴ・社判画像は、背景を透過したPNG形式を推奨します。未登録、または表示OFFの場合は帳票に表示されません。",
  },
  {
    id: "documents",
    title: "4. 各種書類の使い方",
    icon: ReceiptText,
    lead: "見積書・請求書・納品書・注文書は、案件ごとの作業画面から作成・確認できます。",
    items: [
      "見積書は案件金額と明細の確認に使います。",
      "請求書は請求・入金管理に使います。会社情報の口座情報も反映されます。",
      "納品書は納品内容の確認に使います。",
      "注文書は外注、仕入れ、支払管理に使います。",
      "書き出し前に通常プレビューでロゴ・社判や金額欄を確認できます。",
    ],
  },
  {
    id: "print-html",
    title: "5. 印刷用HTMLを書き出してPDF保存する方法",
    icon: Printer,
    lead:
      "Mitruでは、印刷用HTMLを書き出してブラウザの印刷画面からPDF保存できます。直接PDF出力ではなく、ブラウザ印刷を使うことで、日本語・表・ロゴ・社判の表示を安定させています。",
    steps: [
      "書類画面で「印刷用HTMLを書き出す」を押す",
      "必要なら「プレビューで確認」する",
      "「このまま書き出す」を押す",
      "書き出したHTMLをブラウザで開く",
      "ブラウザの印刷画面を開く",
      "「PDFとして保存」またはプリンター印刷を選ぶ",
    ],
    warning: "v0.9.7-beta.5では、直接PDF出力は正式導線ではありません。Macでは印刷画面のPDFメニューから保存してください。",
  },
  {
    id: "cloud",
    title: "6. クラウド同期 / Supabase接続",
    icon: Cloud,
    lead:
      "クラウド同期は任意の実験的機能です。使わない場合でも、Mitruは完全オフラインで利用できます。",
    items: [
      "接続する場合は、ご自身のSupabase Project URLとAnon Keyを入力してください。",
      "service_role keyは絶対に入力しないでください。",
      "同期に失敗しても、端末内のローカルデータは削除されません。",
      "積算明細、納品書、注文書など一部のデータは同期対象外です。",
    ],
    warning: "複数端末で完全に同じ状態を保ちたい場合は、クラウド同期だけでなくデータ出力によるバックアップも併用してください。",
  },
  {
    id: "backup",
    title: "7. バックアップ / データ出力 / リセット",
    icon: DatabaseBackup,
    lead: "重要な作業前やリセット前には、設定 > データ出力 からJSONバックアップを作成してください。",
    items: [
      "業務データリセットでは、案件・顧客・帳票・入金記録などが削除されます。",
      "会社情報、ロゴ、社判、工事項目マスタ、材料マスタ、アプリ設定は保持されます。",
      "別端末へ移行する場合も、JSONバックアップを活用してください。",
    ],
  },
];

const faqs = [
  {
    question: "PDF出力ボタンが見つかりません",
    answer: "Mitruでは「印刷用HTMLを書き出す」からブラウザ印刷を使ってPDF保存します。",
  },
  {
    question: "ロゴ・社判が表示されません",
    answer: "設定 > 印影設定で画像が登録されているか、ロゴ表示・社判表示がONになっているか確認してください。",
  },
  {
    question: "ロゴ・社判の位置を細かく調整したい",
    answer: "各書類のプレビュー画面で印影配置調整モードを使い、表示された配置値を設定 > 印影設定に貼り付けて保存してください。",
  },
  {
    question: "Supabaseを使わないと利用できませんか？",
    answer: "使わなくても利用できます。クラウド同期は任意機能です。",
  },
  {
    question: "service_role keyを入力してもいいですか？",
    answer: "入力しないでください。MitruにはAnon Keyのみを入力してください。",
  },
  {
    question: "リセットすると全部消えますか？",
    answer: "業務データは削除されますが、会社情報・ロゴ・社判・マスタ・設定は保持されます。実行前のバックアップをおすすめします。",
  },
];

export function HelpPage() {
  const [openSections, setOpenSections] = useState(() => new Set<string>(["basic"]));
  const diagnostics = useHelpDiagnostics();

  const toggleSection = (sectionId: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <div className="w-full max-w-none">
      <section className="mb-5 rounded-2xl border border-emerald-500/25 bg-white/90 p-5 shadow-xl shadow-slate-900/5 dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] dark:shadow-2xl dark:shadow-black/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              <BookOpen className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                Help guide
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Mitru 使い方ガイド</h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-700 dark:text-slate-300">
                操作中に迷いやすい初回設定、印影設定、帳票書き出し、クラウド同期、バックアップを短くまとめました。
                詳しい確認は各画面のプレビューや設定画面で行ってください。
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-xs text-slate-700 dark:text-slate-300 sm:grid-cols-3 lg:w-[360px]">
            <QuickLink to="/settings?tab=company" label="会社情報" />
            <QuickLink to="/settings?tab=seal" label="印影設定" />
            <QuickLink to="/settings?tab=export" label="データ出力" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3.5">
          {guideSections.map((section) => (
            <GuideCard
              key={section.id}
              section={section}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}

          <AccordionSection
            title="8. よくある困りごと"
            lead="PDF保存、印影表示、Supabase、リセットで迷いやすい点をまとめています。"
            icon={HelpCircle}
            isOpen={openSections.has("faq")}
            onToggle={() => toggleSection("faq")}
          >
            <div className="mt-4 grid auto-rows-fr gap-3 md:grid-cols-2">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="min-h-[88px] rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <summary className="cursor-pointer text-sm font-semibold leading-6 text-slate-950 dark:text-white">
                    {faq.question}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-400">{faq.answer}</p>
                </details>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title="9. 外部マニュアル・特設サイトリンク"
            lead="画像付き手順や詳しいオンラインマニュアルは今後公開予定です。"
            icon={ExternalLink}
            isOpen={openSections.has("manual")}
            onToggle={() => toggleSection("manual")}
          >
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-400">
              詳しい画像付き手順は、今後公開予定のオンラインマニュアルで確認できます。公開までは、このヘルプページと各画面の案内を参照してください。
            </p>
          </AccordionSection>

          <AccordionSection
            title="診断情報"
            lead="betaサポート用に、環境とデータ状態を読み取り専用で確認できます。"
            icon={Activity}
            isOpen={openSections.has("diagnostics")}
            onToggle={() => toggleSection("diagnostics")}
          >
            <DiagnosticsPanel diagnostics={diagnostics} />
          </AccordionSection>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] dark:shadow-2xl dark:shadow-black/20">
          <h2 className="text-base font-semibold leading-6 text-slate-950 dark:text-white">最初に見るべき画面</h2>
          <div className="mt-4 grid gap-3">
            <HelpLink to="/dashboard" label="ダッシュボード" description="売上・粗利・キャッシュフローを確認" />
            <HelpLink to="/projects" label="案件一覧" description="案件を作成し、各種書類へ進む" />
            <HelpLink to="/masters" label="マスタ設定" description="工事項目・材料を整える" />
            <HelpLink to="/settings" label="設定" description="会社情報・印影・同期・出力を設定" />
          </div>
        </aside>
      </section>
    </div>
  );
}

function useHelpDiagnostics() {
  const customers = useProjectStore((state) => state.customers);
  const projects = useProjectStore((state) => state.projects);
  const estimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const invoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const deliveryDocuments = useProjectStore((state) => state.deliveryDocuments);
  const orderDocuments = useProjectStore((state) => state.orderDocuments);
  const workItemMasters = useProjectStore((state) => state.workItemMasters);
  const materialMasters = useProjectStore((state) => state.materialMasters);
  const cloudSyncSettings = useProjectStore((state) => state.cloudSyncSettings);

  const workMasterCategories = new Set(workItemMasters.map(getWorkMasterCategory));
  const nonInteriorCategoryCount = Array.from(workMasterCategories).filter((category) => category !== "内装工事").length;
  const getStorageFlag = (key: string) => {
    try {
      return localStorage.getItem(key) ?? "未設定";
    } catch {
      return "取得不可";
    }
  };

  return {
    appVersion: import.meta.env.VITE_MITRU_APP_VERSION || "unknown",
    buildCommit: import.meta.env.VITE_MITRU_BUILD_COMMIT || "unknown",
    platform: navigator.platform || "unknown",
    userAgent: navigator.userAgent || "unknown",
    devicePixelRatio: window.devicePixelRatio,
    windowSize: `${window.innerWidth} x ${window.innerHeight}`,
    workItemMasterCount: workItemMasters.length,
    workItemCategoryCount: workMasterCategories.size,
    nonInteriorCategoryCount,
    seedRepairNeeded: needsDefaultWorkItemMasterRepair(workItemMasters),
    seedFlags: [
      {
        label: "mitru-work-item-masters-initialized-v1",
        value: getStorageFlag("mitru-work-item-masters-initialized-v1"),
      },
      {
        label: "mitru-work-item-masters-user-managed-v1",
        value: getStorageFlag("mitru-work-item-masters-user-managed-v1"),
      },
      {
        label: "mitru-work-master-cost-zero-v1",
        value: getStorageFlag("mitru-work-master-cost-zero-v1"),
      },
    ],
    cloudSyncEnabled: cloudSyncSettings.isEnabled,
    cloudSyncConnected: cloudSyncSettings.isConnected,
    cloudAuthState: cloudSyncSettings.authState,
    dataCounts: [
      { label: "顧客", value: customers.length },
      { label: "案件", value: projects.length },
      { label: "見積", value: estimateDocuments.length },
      { label: "請求", value: invoiceDocuments.length },
      { label: "納品", value: deliveryDocuments.length },
      { label: "注文", value: orderDocuments.length },
      { label: "工事項目", value: workItemMasters.length },
      { label: "材料", value: materialMasters.length },
    ],
  };
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: ReturnType<typeof useHelpDiagnostics> }) {
  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-sm font-semibold leading-6 text-slate-950 dark:text-white">環境</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <DiagnosticRow label="アプリバージョン" value={diagnostics.appVersion} />
          <DiagnosticRow label="build commit hash" value={diagnostics.buildCommit} />
          <DiagnosticRow label="platform" value={diagnostics.platform} />
          <DiagnosticRow label="devicePixelRatio" value={String(diagnostics.devicePixelRatio)} />
          <DiagnosticRow label="window innerWidth / innerHeight" value={diagnostics.windowSize} />
          <DiagnosticRow label="Supabase同期" value={diagnostics.cloudSyncEnabled ? "ON" : "OFF"} />
          <DiagnosticRow label="Supabase接続" value={diagnostics.cloudSyncConnected ? "connected" : "not connected"} />
          <DiagnosticRow label="Supabase authState" value={diagnostics.cloudAuthState} />
        </div>
        <div className="mt-3">
          <DiagnosticRow label="userAgent" value={diagnostics.userAgent} wide />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-sm font-semibold leading-6 text-slate-950 dark:text-white">工事項目マスタ</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <DiagnosticRow label="工事項目マスタ件数" value={diagnostics.workItemMasterCount.toLocaleString("ja-JP")} />
          <DiagnosticRow label="工事項目カテゴリ数" value={diagnostics.workItemCategoryCount.toLocaleString("ja-JP")} />
          <DiagnosticRow label="内装工事以外のカテゴリ件数" value={diagnostics.nonInteriorCategoryCount.toLocaleString("ja-JP")} />
          <DiagnosticRow label="seed修復が必要そうか" value={diagnostics.seedRepairNeeded ? "はい" : "いいえ"} tone={diagnostics.seedRepairNeeded ? "warning" : "normal"} />
        </div>
        <div className="mt-4 grid gap-2">
          {diagnostics.seedFlags.map((flag) => (
            <DiagnosticRow key={flag.label} label={flag.label} value={flag.value} wide />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-sm font-semibold leading-6 text-slate-950 dark:text-white">データ件数</p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {diagnostics.dataCounts.map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/45">
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="text-base font-semibold tabular-nums text-slate-950 dark:text-white">
                {item.value.toLocaleString("ja-JP")}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/[0.1] dark:text-amber-100">
        この診断情報は読み取り専用です。ここからデータ修正、seed修復、リセット、同期は実行しません。
      </p>
    </div>
  );
}

function DiagnosticRow({
  label,
  value,
  wide = false,
  tone = "normal",
}: {
  label: string;
  value: string;
  wide?: boolean;
  tone?: "normal" | "warning";
}) {
  return (
    <div className={`min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/45 ${wide ? "md:col-span-2" : ""}`}>
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-0.5 break-words text-sm font-semibold leading-6 ${
          tone === "warning"
            ? "text-amber-700 dark:text-amber-200"
            : "text-slate-950 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function GuideCard({
  section,
  isOpen,
  onToggle,
}: {
  section: GuideSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = section.icon;

  return (
    <AccordionSection title={section.title} lead={section.lead} icon={Icon} isOpen={isOpen} onToggle={onToggle}>
      {section.steps ? (
        <ol className="mt-4 grid auto-rows-fr gap-3 md:grid-cols-2">
          {section.steps.map((step, index) => (
            <li
              key={step}
              className="flex min-h-[76px] gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className="leading-6">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {section.items ? (
        <ul className="mt-4 grid auto-rows-fr gap-3 md:grid-cols-2">
          {section.items.map((item) => (
            <li
              key={item}
              className="min-h-[68px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {section.note ? <InfoNote>{section.note}</InfoNote> : null}
      {section.warning ? <WarningNote>{section.warning}</WarningNote> : null}
    </AccordionSection>
  );
}

function AccordionSection({
  title,
  lead,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  lead: string;
  icon: typeof BookOpen;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-slate-950/55 dark:shadow-2xl dark:shadow-black/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
        aria-expanded={isOpen}
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-[#1E3A8A]/55 dark:text-emerald-300">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-6 text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{lead}</p>
        </div>
        <ChevronDown
          className={`mt-2 size-5 shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen ? <div className="border-t border-slate-200 px-5 pb-5 pt-1 dark:border-white/10">{children}</div> : null}
    </article>
  );
}

function InfoNote({ children }: { children: string }) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] dark:text-emerald-100">
      {children}
    </div>
  );
}

function WarningNote({ children }: { children: string }) {
  return (
    <div className="mt-4 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/[0.1] dark:text-amber-100">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center font-semibold leading-5 text-slate-700 transition hover:border-emerald-500/50 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:border-emerald-400/35 dark:hover:text-white"
    >
      {label}
    </Link>
  );
}

function HelpLink({ to, label, description }: { to: string; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="min-h-[88px] rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-500/50 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-emerald-400/35 dark:hover:bg-white/[0.08]"
    >
      <p className="text-sm font-semibold leading-6 text-slate-950 dark:text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</p>
    </Link>
  );
}
