import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Cloud, Copy, ExternalLink, Eye, EyeOff, FileText, Loader2, LogOut, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cloudSyncFeatureEnabled } from "@/lib/feature-flags";
import { testSupabaseConnection } from "@/lib/supabase";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useProjectStore, type CloudSyncSettings } from "@/stores/project-store";
import { ToastMessage, type ToastState } from "@/features/shared/ToastMessage";
import supabaseSchemaSql from "../../../../docs/supabase-schema.sql?raw";

type ConnectionStatus = "idle" | "testing" | "success" | "partial" | "error";

function hasAnyEntitySyncedAt(settings: CloudSyncSettings) {
  return Boolean(
    settings.lastProjectsSyncedAt ||
      settings.lastCustomersSyncedAt ||
      settings.lastEstimatesSyncedAt ||
      settings.lastInvoicesSyncedAt ||
      settings.lastPaymentsSyncedAt,
  );
}

export function CloudSyncSection() {
  const cloudSyncSettings = useProjectStore((state) => state.cloudSyncSettings);
  const updateCloudSyncSettings = useProjectStore((state) => state.updateCloudSyncSettings);
  const syncAll = useProjectStore((state) => state.syncAll);
  const resolveCloudSyncConflict = useProjectStore((state) => state.resolveCloudSyncConflict);
  const resolveAllCloudSyncConflicts = useProjectStore((state) => state.resolveAllCloudSyncConflicts);
  const [draft, setDraft] = useState<CloudSyncSettings>(cloudSyncSettings);
  const [status, setStatus] = useState<ConnectionStatus>(
    cloudSyncSettings.isConnected ? "success" : "idle",
  );
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [initialSyncDialogOpen, setInitialSyncDialogOpen] = useState(false);
  const [initialSyncPromptDismissed, setInitialSyncPromptDismissed] = useState(false);
  const [schemaSqlOpen, setSchemaSqlOpen] = useState(false);
  const {
    isLoading: isAuthLoading,
    signIn,
    createAccount,
    signOut,
  } = useSupabaseAuth();

  useEffect(() => {
    setDraft(cloudSyncSettings);
    setStatus(cloudSyncSettings.isConnected ? "success" : "idle");
  }, [cloudSyncSettings]);

  useEffect(() => {
    if (
      cloudSyncSettings.isEnabled &&
      cloudSyncSettings.authState === "authenticated" &&
      !hasAnyEntitySyncedAt(cloudSyncSettings) &&
      !initialSyncPromptDismissed
    ) {
      setInitialSyncDialogOpen(true);
    }
  }, [
    cloudSyncSettings.authState,
    cloudSyncSettings.isEnabled,
    cloudSyncSettings.lastProjectsSyncedAt,
    cloudSyncSettings.lastCustomersSyncedAt,
    cloudSyncSettings.lastEstimatesSyncedAt,
    cloudSyncSettings.lastInvoicesSyncedAt,
    cloudSyncSettings.lastPaymentsSyncedAt,
    initialSyncPromptDismissed,
  ]);

  const updateDraft = <TField extends keyof CloudSyncSettings>(
    field: TField,
    value: CloudSyncSettings[TField],
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "supabaseUrl" || field === "supabaseAnonKey"
        ? { isConnected: false }
        : {}),
    }));
    if (field === "supabaseUrl" || field === "supabaseAnonKey") {
      setStatus("idle");
      setMessage("");
    }
  };

  const saveSettings = (input: Partial<CloudSyncSettings> = {}) => {
    updateCloudSyncSettings({
      ...draft,
      ...input,
      supabaseUrl: (input.supabaseUrl ?? draft.supabaseUrl).trim(),
      supabaseAnonKey: (input.supabaseAnonKey ?? draft.supabaseAnonKey).trim(),
    });
  };

  const handleToggle = () => {
    const nextEnabled = !draft.isEnabled;
    const nextDraft = {
      ...draft,
      isEnabled: nextEnabled,
      isConnected: nextEnabled ? draft.isConnected : false,
      authState: nextEnabled ? draft.authState : "idle",
      user: nextEnabled ? draft.user : null,
    };
    setDraft(nextDraft);
    updateCloudSyncSettings(nextDraft);
    setStatus(nextDraft.isConnected ? "success" : "idle");
    if (nextEnabled && nextDraft.authState !== "authenticated") {
      setAuthModalOpen(true);
    } else if (nextEnabled && nextDraft.authState === "authenticated" && !hasAnyEntitySyncedAt(nextDraft)) {
      setInitialSyncDialogOpen(true);
    }
  };

  const handleTestModeToggle = () => {
    const nextDraft = {
      ...draft,
      isTestMode: !draft.isTestMode,
    };
    setDraft(nextDraft);
    updateCloudSyncSettings(nextDraft);
  };

  const handleConnectionTest = async () => {
    setStatus("testing");
    setMessage("");
    try {
      const result = await testSupabaseConnection({
        supabaseUrl: draft.supabaseUrl,
        supabaseAnonKey: draft.supabaseAnonKey,
      });
      setStatus("success");
      setMessage(result.message);
      saveSettings({
        isConnected: true,
      });
      setToast({
        title: "Supabaseに接続できました",
        description: "案件・顧客・見積書・請求書・入金記録を同期できます。ローカルデータは常に端末内にも保持されます。",
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : "接続テストに失敗しました。";
      setStatus("error");
      setMessage(description);
      saveSettings({ isConnected: false });
      setToast({
        title: "接続テストに失敗しました",
        description,
        tone: "error",
      });
    } finally {
      window.setTimeout(() => setToast(null), 4200);
    }
  };

  const handleCopySchemaSql = async () => {
    try {
      await navigator.clipboard.writeText(supabaseSchemaSql);
      setToast({
        title: "SQLをコピーしました",
        description: "SupabaseのSQL Editorに貼り付けて実行してください。",
      });
    } catch {
      setToast({
        title: "SQLを自動コピーできませんでした",
        description: "コピーできない場合はSQL本文を選択してコピーしてください。",
        tone: "error",
      });
    } finally {
      window.setTimeout(() => setToast(null), 4200);
    }
  };

  const handleOpenSupabaseGuide = async () => {
    const url = "https://supabase.com/docs/guides/getting-started";
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        setToast({
          title: "Supabaseの始め方を開けませんでした",
          description: "ブラウザで https://supabase.com/docs/guides/getting-started を開いてください。",
          tone: "error",
        });
        window.setTimeout(() => setToast(null), 5200);
      }
    }
  };

  const runSync = async (label: "全データ同期" | "手動同期") => {
    if (draft.isEnabled && draft.authState !== "authenticated") {
      setAuthModalOpen(true);
      setMessage("同期するにはSupabaseアカウントでログインしてください。");
      return;
    }
    saveSettings();
    setIsSyncing(true);
    setMessage("");
    try {
      const results = await syncAll();
      const hasError =
        results.projects.status === "error" ||
        results.customers.status === "error" ||
        results.estimates.status === "error" ||
        results.invoices.status === "error" ||
        results.payments.status === "error";
      const summary = summarizeSyncResults(results);
      const historyEntry = createSyncHistoryEntry(results, label);
      setStatus(hasError ? (summary.success > 0 ? "partial" : "error") : "success");
      setMessage(createSyncScreenMessage(results, label));
      updateCloudSyncSettings({
        syncHistory: [historyEntry, ...safeSyncHistory(cloudSyncSettings.syncHistory)].slice(0, 3),
      });
      setToast({
        title: hasError ? "一部の同期に失敗しました" : "全データ同期が完了しました",
        description: hasError
          ? `成功した部分は保持されています。${results.projects.message} / ${results.customers.message} / ${results.estimates.message} / ${results.invoices.message} / ${results.payments.message}`
          : `案件 取得${results.projects.pulled}件 / 保存${results.projects.pushed}件、顧客 取得${results.customers.pulled}件 / 保存${results.customers.pushed}件、見積書 取得${results.estimates.pulled}件 / 保存${results.estimates.pushed}件、請求書 取得${results.invoices.pulled}件 / 保存${results.invoices.pushed}件、入金記録 取得${results.payments.pulled}件 / 保存${results.payments.pushed}件。`,
        tone: hasError ? "error" : undefined,
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : "全データ同期に失敗しました。";
      const historyEntry: CloudSyncSettings["syncHistory"][number] = {
        id: `sync-history-${Date.now()}`,
        ranAt: new Date().toISOString(),
        status: "error",
        succeeded: 0,
        failed: 5,
        message: `${label}: ${description}`,
      };
      setStatus("error");
      setMessage(
        `${label}に失敗しましたが、ローカルデータは一切変更されていません。ネットワーク接続、SupabaseのURL・Anon Key、同期用テーブルの設定を確認してください。詳細: ${description}`,
      );
      updateCloudSyncSettings({
        syncHistory: [historyEntry, ...safeSyncHistory(cloudSyncSettings.syncHistory)].slice(0, 3),
      });
      setToast({
        title: `${label}に失敗しました`,
        description: `${description} ローカルデータは変更されていません。`,
        tone: "error",
      });
    } finally {
      setIsSyncing(false);
      window.setTimeout(() => setToast(null), 4200);
    }
  };

  const handleAllSync = () => runSync("全データ同期");

  const handleManualSync = () => runSync("手動同期");

  const handleAuthSubmit = async (mode: "signin" | "signup") => {
    setAuthMessage("");
    try {
      if (mode === "signin") {
        await signIn(authEmail, authPassword);
        setToast({ title: "ログインしました", description: "クラウド同期を実行できるようになりました。" });
      } else {
        await createAccount(authEmail, authPassword);
        setToast({ title: "アカウントを作成しました", description: "メール確認が必要な場合はSupabaseからのメールをご確認ください。" });
      }
      setAuthModalOpen(false);
      setAuthPassword("");
      setStatus("success");
      if (!hasAnyEntitySyncedAt(draft)) {
        setInitialSyncDialogOpen(true);
      }
      window.setTimeout(() => setToast(null), 3600);
    } catch (error) {
      const description = error instanceof Error ? error.message : "認証に失敗しました。";
      setAuthMessage(description);
      setToast({ title: "Supabase認証に失敗しました", description, tone: "error" });
      window.setTimeout(() => setToast(null), 4200);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setToast({ title: "ログアウトしました", description: "クラウド同期は未認証状態になりました。" });
    window.setTimeout(() => setToast(null), 3200);
  };

  const syncHistory = Array.isArray(draft.syncHistory) ? draft.syncHistory : [];
  const statusSummary = createStatusSummary(
    draft.lastSyncResults,
    status,
    message,
    Boolean(draft.lastSyncAt) || syncHistory.length > 0,
    draft.isEnabled,
  );
  const pendingConflicts = Array.isArray(draft.pendingConflicts) ? draft.pendingConflicts : [];
  const activeConflict = pendingConflicts[0] ?? null;
  const syncProgress = draft.syncProgress ?? {
    isSyncing: false,
    currentStep: 0,
    totalSteps: 5,
    label: "待機中",
    startedAt: null,
  };
  const syncProgressPercent = Math.min(
    100,
    Math.max(0, Math.round((syncProgress.currentStep / Math.max(syncProgress.totalSteps, 1)) * 100)),
  );

  if (!cloudSyncFeatureEnabled) {
    return (
      <motion.section
        className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/55"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bring Your Own Supabase</p>
        <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">クラウド同期</h3>
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/[0.08] dark:text-amber-200">
          クラウド同期は実験的機能です。データ消失の可能性があります。必ずバックアップを取ってからONにしてください。このビルドでは無効化されています。
          Mitruはこれまで通り、端末内のローカルデータだけで完全に利用できます。
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Bring Your Own Supabase</p>
            <h3 className="mt-2 text-lg font-semibold text-white">クラウド同期</h3>
            <div className="mt-2 grid max-w-3xl gap-1.5 text-sm leading-6 text-slate-400">
              <p>Mitruはオフラインでもそのまま利用できます。</p>
              <p>クラウド同期を有効にした場合のみ、案件・顧客・見積書・請求書・入金記録を確認・同期します。</p>
              <p>同期先は、ユーザー自身で用意したSupabase環境です。</p>
              <p>必要なときに手動で同期できます。同期OFFなら完全オフラインで動作します。</p>
              <p>積算明細、納品書、注文書などは、このベータ版のクラウド同期対象外です。</p>
            </div>
            <div className="mt-3 grid w-full gap-1.5 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm leading-5 text-red-950 shadow-sm shadow-red-950/10 dark:border-red-400/70 dark:bg-red-500/[0.14] dark:text-red-100">
              <p className="font-semibold">クラウド同期は実験的機能です。データ消失の可能性があります。</p>
              <p className="font-semibold">必ずバックアップを取ってからONにしてください。</p>
              <p className="font-semibold">
                この端末は家族・社内で共有しないでください。Anon Keyが漏れると他人のデータが見える可能性があります。
              </p>
              <p className="mt-0.5 text-xs leading-4 text-red-900 dark:text-red-100/85">
                ※積算明細（projectItems）、納品書、注文書などは現在クラウド同期対象外です。別端末では積算内容を再入力する必要があります。積算明細を含む完全な退避には「データ出力」を使用してください。
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.isEnabled}
            onClick={handleToggle}
            className={`relative h-8 w-14 shrink-0 rounded-full border transition ${
              draft.isEnabled
                ? "border-emerald-400 bg-emerald-500"
                : "border-white/10 bg-white/[0.10]"
            }`}
          >
            <span
              className={`absolute top-1 size-6 rounded-full bg-white shadow transition ${
                draft.isEnabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Supabase Project URL</span>
            <input
              value={draft.supabaseUrl}
              onChange={(event) => updateDraft("supabaseUrl", event.target.value)}
              onBlur={() => saveSettings({ isConnected: status === "success" })}
              placeholder="https://xxxx.supabase.co"
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/70 focus:ring-3 focus:ring-emerald-400/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Supabase Anon Key</span>
            <input
              value={draft.supabaseAnonKey}
              onChange={(event) => updateDraft("supabaseAnonKey", event.target.value)}
              onBlur={() => saveSettings({ isConnected: status === "success" })}
              type="password"
              placeholder="eyJhbGciOi..."
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/70 focus:ring-3 focus:ring-emerald-400/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            />
            <span className="text-xs leading-5 text-slate-500">
              Anon Keyはこの端末内のlocalStorageに保存されます。共有PCでは扱いに注意してください。
            </span>
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">同期テストモード</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                実Supabaseでの回帰テスト時だけONにします。ONの間は、同期対象件数、entity別cursor、push/pull結果をコンソールに詳細出力します。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.isTestMode}
              onClick={handleTestModeToggle}
              className={`relative h-8 w-14 shrink-0 rounded-full border transition ${
                draft.isTestMode
                  ? "border-amber-300 bg-amber-400"
                  : "border-white/10 bg-white/[0.10]"
              }`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-white shadow transition ${
                  draft.isTestMode ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-3 text-sm leading-6 text-emerald-50">
          ローカルデータは常に端末内に保持されます。同期に失敗しても、端末内のデータは消えず、成功した同期結果だけが反映されます。
        </div>

        {pendingConflicts.length > 0 ? (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <div className="font-semibold">同期競合が {pendingConflicts.length}件あります</div>
                <p className="mt-1 text-xs leading-5">
                  他端末とこの端末の両方で同じデータが編集されています。自動上書きは行っていません。競合解決ダイアログで、どちらを優先するか選択してください。
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={handleConnectionTest}
            disabled={status === "testing" || isSyncing}
            className="gap-2"
          >
            {status === "testing" ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
            接続テスト
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleAllSync}
            disabled={!draft.isEnabled || status === "testing" || isSyncing}
            className="gap-2"
          >
            {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            全データ同期
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleManualSync}
            disabled={!draft.isEnabled || status === "testing" || isSyncing}
            className="gap-2"
          >
            {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            手動同期
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              saveSettings();
              setToast({ title: "クラウド同期設定を保存しました", description: "保存のみを行いました。同期は「全データ同期」または「手動同期」から実行できます。" });
              window.setTimeout(() => setToast(null), 3200);
            }}
          >
            設定を保存
          </Button>
          {draft.isEnabled && draft.authState === "authenticated" ? (
            <Button type="button" variant="outline" onClick={handleSignOut} disabled={isAuthLoading} className="gap-2">
              <LogOut className="size-4" />
              ログアウト
            </Button>
          ) : draft.isEnabled ? (
            <Button type="button" variant="outline" onClick={() => setAuthModalOpen(true)}>
              Supabaseでログイン
            </Button>
          ) : null}
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-medium text-white">同期進捗</span>
            <span className="text-slate-400">
              {syncProgress.label}（{syncProgress.currentStep}/{syncProgress.totalSteps}）
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${syncProgressPercent}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <span>最終同期: {relativeSyncTime(draft.lastSyncAt)}</span>
            <span>同期方法: 必要に応じて手動同期</span>
          </div>
        </div>

        <div className="mt-5 flex min-h-[8.125rem] flex-col justify-center rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">
          <div className="font-semibold text-white">Supabaseプロジェクトの準備</div>
          <p className="mt-1 text-slate-400">
            ユーザー自身のSupabaseプロジェクトURLとAnon Keyを入力してください。クラウド同期を使わない場合、Mitruは完全にローカルアプリとして動作します。
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-2 border-emerald-400/25 bg-emerald-400/[0.08] px-3 text-sm text-emerald-200 hover:bg-emerald-400/[0.14]"
              onClick={() => setSchemaSqlOpen(true)}
            >
              <FileText className="size-4" />
              Supabaseテーブル作成SQLを表示
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-2 px-2 text-sm font-medium text-emerald-300 hover:bg-emerald-400/[0.08] hover:text-emerald-200"
              onClick={handleOpenSupabaseGuide}
            >
              Supabaseの始め方を見る
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>

        {syncProgress.isSyncing || isSyncing ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-5 text-center shadow-2xl">
              <Loader2 className="mx-auto size-8 animate-spin text-emerald-300" />
              <div className="mt-4 font-semibold text-white">同期中...</div>
              <div className="mt-2 text-sm text-slate-400">
                {syncProgress.label}（{syncProgress.currentStep}/{syncProgress.totalSteps} 完了）
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${syncProgressPercent}%` }} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="h-fit rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-300">
            <Cloud className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Status</p>
            <h3 className="text-base font-semibold text-white">{connectionStatusLabel(status, draft.isEnabled)}</h3>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">同期結果</p>
          {statusSummary.hasRun ? (
            <div className="mt-3 grid gap-2 text-sm">
              <StatusResultRow label="成功" value={statusSummary.success} tone="success" />
              {statusSummary.error > 0 ? (
                <>
                  <StatusResultRow label="失敗" value={statusSummary.error} tone="error" />
                  {statusSummary.errorMessage ? (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/[0.08] dark:text-rose-200">
                      {statusSummary.errorMessage}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
              まだ同期は実行されていません。接続テストまたは手動同期を行うと、ここに結果が表示されます。
            </p>
          )}
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <CloudSummaryRow label="同期" value={draft.isEnabled ? "有効" : "無効"} />
          <CloudSummaryRow label="接続" value={draft.isConnected ? "接続成功" : "未接続"} />
          <CloudSummaryRow label="認証" value={authStatusLabel(draft.authState, draft.user?.email)} />
          <CloudSummaryRow label="最終同期" value={draft.lastSyncAt ? new Date(draft.lastSyncAt).toLocaleString("ja-JP") : "未実行"} />
          <CloudSummaryRow label="案件" value={syncResultLabel(draft.lastSyncResults.projects)} />
          <CloudSummaryRow label="顧客" value={syncResultLabel(draft.lastSyncResults.customers)} />
          <CloudSummaryRow label="見積書" value={syncResultLabel(draft.lastSyncResults.estimates)} />
          <CloudSummaryRow label="請求書" value={syncResultLabel(draft.lastSyncResults.invoices)} />
          <CloudSummaryRow label="入金記録" value={syncResultLabel(draft.lastSyncResults.payments)} />
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-white">同期履歴</h4>
            <span className="text-xs text-slate-500">直近3回</span>
          </div>
          <div className="mt-3 space-y-2">
            {syncHistory.length > 0 ? (
              syncHistory.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-semibold ${syncHistoryToneClass(entry.status)}`}>
                      {syncHistoryStatusLabel(entry.status)}
                    </span>
                    <span className="text-slate-500">{new Date(entry.ranAt).toLocaleString("ja-JP")}</span>
                  </div>
                  <p className="mt-1 leading-5 text-slate-400">{entry.message}</p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs leading-5 text-slate-500">
                まだ同期履歴はありません。全データ同期または手動同期を実行するとここに表示されます。
              </p>
            )}
          </div>
        </div>

          <div className={`mt-5 rounded-xl border p-3 text-sm leading-6 shadow-sm ${
          status === "error"
            ? "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-400/30 dark:bg-rose-950/45 dark:text-rose-100"
            : status === "partial"
              ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-100"
            : status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-100"
              : "border-slate-300 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400"
        }`}>
          {message || "未接続です。URLとAnon Keyを入力して接続テストを行ってください。"}
        </div>

        <div className="mt-11 flex min-h-[8.125rem] flex-col justify-center rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/[0.08] dark:text-amber-200">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4" />
            オフライン優先の同期
          </div>
          全データ同期は、案件→顧客→見積書→請求書→入金記録の順に実行します。途中で失敗しても、成功した部分と端末内のローカルデータは保持されます。
        </div>
      </aside>

      {authModalOpen ? (
        <SupabaseAuthModal
          email={authEmail}
          password={authPassword}
          showPassword={showPassword}
          isLoading={isAuthLoading}
          message={authMessage}
          onEmailChange={setAuthEmail}
          onPasswordChange={setAuthPassword}
          onTogglePassword={() => setShowPassword((value) => !value)}
          onSignIn={() => handleAuthSubmit("signin")}
          onSignUp={() => handleAuthSubmit("signup")}
          onClose={() => setAuthModalOpen(false)}
        />
      ) : null}
      {initialSyncDialogOpen ? (
        <InitialSyncDialog
          isSyncing={isSyncing}
          onRunInitialSync={() => {
            setInitialSyncDialogOpen(false);
            setInitialSyncPromptDismissed(true);
            handleAllSync();
          }}
          onClose={() => {
            setInitialSyncDialogOpen(false);
            setInitialSyncPromptDismissed(true);
          }}
        />
      ) : null}
      {activeConflict ? (
        <CloudSyncConflictDialog
          conflict={activeConflict}
          pendingConflictCount={pendingConflicts.length}
          onPreferLocal={() => {
            resolveCloudSyncConflict(activeConflict.id, "local");
            setToast({
              title: "ローカルデータを優先しました",
              description: "次回同期時に、この端末の変更がクラウドへ反映されます。",
            });
            window.setTimeout(() => setToast(null), 3600);
          }}
          onPreferCloud={() => {
            resolveCloudSyncConflict(activeConflict.id, "cloud");
            setToast({
              title: "クラウドデータを反映しました",
              description: "この端末の該当データをクラウド側の内容で更新しました。",
            });
            window.setTimeout(() => setToast(null), 3600);
          }}
          onPreferAllLocal={() => {
            resolveAllCloudSyncConflicts("local");
            setToast({
              title: "すべてローカル優先にしました",
              description: "保留中の競合は、この端末の内容を優先して解決しました。",
            });
            window.setTimeout(() => setToast(null), 3600);
          }}
          onPreferAllCloud={() => {
            resolveAllCloudSyncConflicts("cloud");
            setToast({
              title: "すべてクラウド優先にしました",
              description: "保留中の競合は、クラウド側の内容を優先して解決しました。",
            });
            window.setTimeout(() => setToast(null), 3600);
          }}
        />
      ) : null}
      <Dialog open={schemaSqlOpen} onOpenChange={setSchemaSqlOpen}>
        <DialogContent
          overlayClassName="z-[2147483647]"
          className="z-[2147483647] max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[920px] overflow-hidden p-0 md:left-[calc(280px+((100vw-280px)/2))] md:w-[calc(100vw-312px)]"
        >
          <div className="flex max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-4 p-5 sm:p-6">
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle>Supabaseテーブル作成SQL</DialogTitle>
              <DialogDescription>
                SupabaseのSQL Editorに以下のSQLを貼り付けて実行してください。クラウド同期を使わない場合、この設定は不要です。
              </DialogDescription>
            </DialogHeader>
            <div className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-sm leading-6 text-amber-100">
              SQLの実行はユーザー自身のSupabaseプロジェクトで行ってください。Mitruにservice_role keyは入力しないでください。
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                `docs/supabase-schema.sql` と同じ内容をアプリ内で表示しています。
              </p>
              <Button type="button" className="gap-2" onClick={handleCopySchemaSql}>
                <Copy className="size-4" />
                SQLをコピー
              </Button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre rounded-xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-5 text-slate-200">
              <code className="block min-w-max whitespace-pre">{supabaseSchemaSql}</code>
            </pre>
          </div>
        </DialogContent>
      </Dialog>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </motion.section>
  );
}

function connectionStatusLabel(status: ConnectionStatus, enabled: boolean) {
  if (!enabled) return "未接続";
  if (status === "testing") return "接続中";
  if (status === "success") return "接続成功";
  if (status === "partial") return "一部同期済み";
  if (status === "error") return "エラー";
  return "未接続";
}

function authStatusLabel(authState: CloudSyncSettings["authState"], email?: string) {
  if (authState === "authenticated") return email ? `認証済み（${email}）` : "認証済み";
  if (authState === "authenticating") return "認証中";
  if (authState === "error") return "認証エラー";
  return "未認証";
}

function syncResultLabel(result: CloudSyncSettings["lastSyncResults"]["projects"]) {
  if (result.status === "idle") return "未実行";
  if (result.status === "skipped") return result.message || "未同期";
  if (result.status === "error") return `エラー: ${result.message}`;
  return `取得 ${result.pulled} / 保存 ${result.pushed} / 変更なし ${result.skipped}`;
}

function relativeSyncTime(value: string) {
  if (!value) return "未実行";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "未実行";
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) return "たった今";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function summarizeSyncResults(results: CloudSyncSettings["lastSyncResults"]) {
  const values = Object.values(results);
  return {
    success: values.filter((result) => result.status === "success").length,
    skipped: values.filter((result) => result.status === "idle" || result.status === "skipped").length,
    error: values.filter((result) => result.status === "error").length,
  };
}

function createStatusSummary(
  results: CloudSyncSettings["lastSyncResults"],
  status: ConnectionStatus,
  message: string,
  hasSyncExecution: boolean,
  enabled: boolean,
) {
  if (!enabled) {
    return {
      hasRun: false,
      success: 0,
      error: 0,
      errorMessage: "",
    };
  }

  const summary = summarizeSyncResults(results);
  const hasSyncResult = summary.success > 0 || summary.error > 0 || hasSyncExecution;
  const hasConnectionTestResult = Boolean(message) && (status === "success" || status === "error");
  const success = hasSyncResult ? summary.success : status === "success" && hasConnectionTestResult ? 1 : 0;
  const error = hasSyncResult ? summary.error : status === "error" && hasConnectionTestResult ? 1 : 0;

  return {
    hasRun: hasSyncResult || hasConnectionTestResult,
    success,
    error,
    errorMessage: createStatusErrorMessage(results, status, message),
  };
}

function createStatusErrorMessage(
  results: CloudSyncSettings["lastSyncResults"],
  status: ConnectionStatus,
  message: string,
) {
  const failedMessages = Object.entries(results)
    .filter(([, result]) => result.status === "error")
    .map(([key, result]) => `${syncEntityLabel(key)}: ${result.message}`)
    .join(" / ");

  if (failedMessages) return `原因: ${failedMessages}`;
  if (status === "error" && message) return `原因: ${message}`;
  return "";
}

function createSyncScreenMessage(
  results: CloudSyncSettings["lastSyncResults"],
  label: "全データ同期" | "手動同期",
) {
  const summary = summarizeSyncResults(results);
  const totalPull = Object.values(results).reduce((sum, result) => sum + result.pulled, 0);
  const totalPush = Object.values(results).reduce((sum, result) => sum + result.pushed, 0);
  const failedMessages = Object.entries(results)
    .filter(([, result]) => result.status === "error")
    .map(([key, result]) => `${syncEntityLabel(key)}: ${result.message}`)
    .join(" / ");

  if (summary.error === 0) {
    return `${label}が完了しました。取得 ${totalPull}件 / 保存 ${totalPush}件。クラウドへ反映した後も、ローカルデータは端末内に保持されています。`;
  }

  if (summary.success > 0) {
    return `${label}は一部のみ完了しました。成功したデータは反映済みです。失敗した対象のローカルデータは一切変更されていないため、ネットワークやSupabase設定を確認してから再実行してください。${failedMessages ? ` 詳細: ${failedMessages}` : ""}`;
  }

  return `${label}に失敗しましたが、ローカルデータは一切変更されていません。ネットワーク接続、SupabaseのURL・Anon Key、同期用テーブルの設定を確認してください。${failedMessages ? ` 詳細: ${failedMessages}` : ""}`;
}

function syncEntityLabel(key: string) {
  if (key === "projects") return "案件";
  if (key === "customers") return "顧客";
  if (key === "estimates") return "見積書";
  if (key === "invoices") return "請求書";
  if (key === "payments") return "入金記録";
  return key;
}

function createSyncHistoryEntry(
  results: CloudSyncSettings["lastSyncResults"],
  label: "全データ同期" | "手動同期",
): CloudSyncSettings["syncHistory"][number] {
  const summary = summarizeSyncResults(results);
  const status = summary.error > 0 ? (summary.success > 0 ? "partial" : "error") : "success";
  const totalPull = Object.values(results).reduce((sum, result) => sum + result.pulled, 0);
  const totalPush = Object.values(results).reduce((sum, result) => sum + result.pushed, 0);

  return {
    id: `sync-history-${Date.now()}`,
    ranAt: new Date().toISOString(),
    status,
    succeeded: summary.success,
    failed: summary.error,
    message:
      status === "success"
        ? `${label}: 取得 ${totalPull}件 / 保存 ${totalPush}件`
        : `${label}: ${summary.success}件種別成功、${summary.error}件種別失敗。成功した部分は保持されています。`,
  };
}

function syncHistoryStatusLabel(status: CloudSyncSettings["syncHistory"][number]["status"]) {
  if (status === "success") return "成功";
  if (status === "partial") return "一部成功";
  return "失敗";
}

function syncHistoryToneClass(status: CloudSyncSettings["syncHistory"][number]["status"]) {
  if (status === "success") return "text-emerald-200";
  if (status === "partial") return "text-amber-200";
  return "text-red-200";
}

function safeSyncHistory(value: CloudSyncSettings["syncHistory"] | undefined) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readNestedValue(record: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
}

function valuesDiffer(localRecord: Record<string, unknown>, cloudRecord: Record<string, unknown>, paths: string[]) {
  return paths.some((path) => {
    const localValue = readNestedValue(localRecord, path);
    const cloudValue = readNestedValue(cloudRecord, path);
    return localValue !== undefined && cloudValue !== undefined && JSON.stringify(localValue) !== JSON.stringify(cloudValue);
  });
}

function getConflictDiffHints(conflict: CloudSyncSettings["pendingConflicts"][number]) {
  const localRecord = asRecord(conflict.localRecord);
  const cloudRecord = asRecord(conflict.cloudRecord);
  const hints: string[] = [];

  if (valuesDiffer(localRecord, cloudRecord, ["deletedAt", "syncMetadata.deletedAt"])) {
    hints.push("削除状態が変更されています");
  }
  if (valuesDiffer(localRecord, cloudRecord, ["totalAmount", "currentAmount", "paidAmount", "amount", "totalsSnapshot.afterTax"])) {
    hints.push("金額が変更されています");
  }
  if (valuesDiffer(localRecord, cloudRecord, ["quantity"])) {
    hints.push("数量が変更されています");
  }
  if (valuesDiffer(localRecord, cloudRecord, ["unitPrice"])) {
    hints.push("単価が変更されています");
  }
  if (valuesDiffer(localRecord, cloudRecord, ["status", "paymentStatus"])) {
    hints.push("ステータスが変更されています");
  }
  if (valuesDiffer(localRecord, cloudRecord, ["title", "name", "clientName", "clientCompanyName", "documentNumber"])) {
    hints.push("名称・書類番号が変更されています");
  }
  if (valuesDiffer(localRecord, cloudRecord, ["lineSnapshot", "paymentRecords"])) {
    hints.push("明細・入金記録が変更されています");
  }

  return hints.length > 0 ? hints : ["主要項目以外が変更されています"];
}

function CloudSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function StatusResultRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-rose-700 dark:text-rose-300";
  const valueClass =
    tone === "success"
      ? "text-emerald-800 dark:text-emerald-200"
      : "text-rose-800 dark:text-rose-200";
  const formattedValue = value.toLocaleString("ja-JP");

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className={`text-xs font-semibold ${toneClass}`}>{label}</span>
      <span
        className={`min-w-0 max-w-[11rem] truncate text-right font-bold tabular-nums ${valueClass}`}
        title={formattedValue}
      >
        {formattedValue}
      </span>
    </div>
  );
}

function CloudSyncConflictDialog({
  conflict,
  pendingConflictCount,
  onPreferLocal,
  onPreferCloud,
  onPreferAllLocal,
  onPreferAllCloud,
}: {
  conflict: CloudSyncSettings["pendingConflicts"][number];
  pendingConflictCount: number;
  onPreferLocal: () => void;
  onPreferCloud: () => void;
  onPreferAllLocal: () => void;
  onPreferAllCloud: () => void;
}) {
  const diffHints = getConflictDiffHints(conflict);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <motion.div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/30"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-400/30 bg-amber-400/[0.12] text-amber-200">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Sync Conflict</p>
            <h3 className="mt-2 text-xl font-semibold text-white">他端末でも編集されています</h3>
            <p className="mt-1 text-xs text-slate-400">保留中の競合: {pendingConflictCount}件</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
          <div className="font-semibold text-white">{conflict.entityLabel}: {conflict.title}</div>
          <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <span>この端末の更新: {formatConflictDate(conflict.localUpdatedAt)}</span>
            <span>クラウドの更新: {formatConflictDate(conflict.cloudUpdatedAt)}</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            自動上書きは行っていません。どちらの内容を優先するか選択してください。ローカル優先を選ぶと、この端末の内容を次回同期でクラウドへ反映します。
          </p>
          <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2">
            <div className="text-xs font-semibold text-amber-200">差分ヒント</div>
            <ul className="mt-1 grid gap-1 text-xs text-amber-100">
              {diffHints.map((hint) => (
                <li key={hint}>・{hint}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onPreferLocal}
            className="rounded-xl border border-emerald-400/35 bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-600"
          >
            ローカル優先
          </button>
          <button
            type="button"
            onClick={onPreferCloud}
            className="rounded-xl border border-sky-400/35 bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/20 transition hover:bg-sky-600"
          >
            クラウド優先
          </button>
        </div>
        {pendingConflictCount > 1 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onPreferAllLocal}
              className="rounded-xl border border-emerald-300/30 bg-emerald-400/[0.10] px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/[0.16]"
            >
              ローカル全部優先
            </button>
            <button
              type="button"
              onClick={onPreferAllCloud}
              className="rounded-xl border border-sky-300/30 bg-sky-400/[0.10] px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/[0.16]"
            >
              クラウド全部優先
            </button>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

function formatConflictDate(value: string) {
  if (!value) return "不明";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "不明";
  return new Date(timestamp).toLocaleString("ja-JP");
}

function InitialSyncDialog({
  isSyncing,
  onRunInitialSync,
  onClose,
}: {
  isSyncing: boolean;
  onRunInitialSync: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <motion.div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/30"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">First Sync</p>
        <h3 className="mt-2 text-xl font-semibold text-white">初回同期を実行しますか？</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          いまこの端末にある案件・顧客・見積書・請求書・入金記録をSupabaseへ保存し、クラウド側にある変更も取り込みます。積算明細はこのベータ版のクラウド同期対象外です。
        </p>
        <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-400/[0.14] text-emerald-200">
              <RefreshCw className="size-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-emerald-100">同期されるデータ</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                案件、顧客、見積書、請求書、入金記録を対象に、端末とクラウドの差分を同期します。積算明細を含む完全な退避には、同期前に「アプリ設定 ＞ データ出力」でバックアップを作成してください。
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSyncing}>
            後でする
          </Button>
          <button
            type="button"
            onClick={onRunInitialSync}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            初回同期を実行する
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SupabaseAuthModal({
  email,
  password,
  showPassword,
  isLoading,
  message,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSignIn,
  onSignUp,
  onClose,
}: {
  email: string;
  password: string;
  showPassword: boolean;
  isLoading: boolean;
  message: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <motion.div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/30"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Supabase Account</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Supabaseアカウントでログイン</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              クラウド同期を使う場合だけログインします。後で設定しても、Mitruのオフライン機能はそのまま使えます。
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white">
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-300">メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@example.com"
              className="h-11 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/70 focus:ring-3 focus:ring-emerald-400/15"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-300">パスワード</span>
            <div className="flex h-11 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] focus-within:border-emerald-400/70 focus-within:ring-3 focus-within:ring-emerald-400/15">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="8文字以上のパスワード"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <button type="button" onClick={onTogglePassword} className="grid w-11 place-items-center text-slate-400 hover:text-white">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] p-3 text-sm leading-6 text-amber-100">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" onClick={onSignIn} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            ログイン
          </Button>
          <Button type="button" variant="outline" onClick={onSignUp} disabled={isLoading}>
            アカウントを新規作成
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="sm:col-span-2">
            後でする
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
