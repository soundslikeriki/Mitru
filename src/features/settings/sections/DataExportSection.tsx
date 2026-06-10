import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DatabaseBackup, FileDown, RotateCcw, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  downloadTextFile,
  projectsToCsv,
} from "@/features/settings/lib/settings-utils";
import { ToastMessage } from "@/features/shared/ToastMessage";
import { useProjectStore } from "@/stores/project-store";
import { projectStoreVersion } from "@/stores/slices/persist";

const sampleDataRemovedKey = "mitru-sample-data-removed-v1";

export function DataExportSection() {
  const navigate = useNavigate();
  const allProjects = useProjectStore((state) => state.projects);
  const workItemMasters = useProjectStore((state) => state.workItemMasters);
  const materialMasters = useProjectStore((state) => state.materialMasters);
  const cloudSyncSettings = useProjectStore((state) => state.cloudSyncSettings);
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const pdfTemplateSettings = useProjectStore((state) => state.pdfTemplateSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const documentNumberSettings = useProjectStore((state) => state.documentNumberSettings);
  const exportBackupDataWithImageAssets = useProjectStore((state) => state.exportBackupDataWithImageAssets);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const projects = useMemo(() => allProjects.filter((project) => !project.deletedAt), [allProjects]);
  const notify = (title: string, description: string, tone: "success" | "error" = "success") => {
    setToast({ title, description, tone });
    window.setTimeout(() => setToast(null), 3600);
  };

  const exportProjectsCsv = async () => {
    setBusy(true);
    try {
      const csv = projectsToCsv(projects);
      const saved = await downloadTextFile(`mitru_projects_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
      if (saved) notify("CSVを出力しました", "全案件一覧を書き出しました。");
    } catch (error) {
      notify("CSV出力に失敗しました", error instanceof Error ? error.message : "不明なエラー", "error");
    } finally {
      setBusy(false);
    }
  };

  const exportBackupJson = async () => {
    setBusy(true);
    try {
      const backup = await exportBackupDataWithImageAssets();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const saved = await downloadTextFile(
        `mitru_backup_${timestamp}.json`,
        JSON.stringify(backup, null, 2),
        "application/json;charset=utf-8",
      );
      if (saved) notify("バックアップを出力しました", "全データをJSONファイルとして保存しました。");
    } catch (error) {
      notify("バックアップ出力に失敗しました", error instanceof Error ? error.message : "不明なエラー", "error");
    } finally {
      setBusy(false);
    }
  };

  const resetBusinessData = async (withBackup: boolean) => {
    setBusy(true);
    try {
      const resetAt = new Date().toISOString();
      if (withBackup) {
        const backup = await exportBackupDataWithImageAssets();
        const timestamp = resetAt.replace(/[:.]/g, "-");
        await downloadTextFile(
          `mitru_reset_backup_${timestamp}.json`,
          JSON.stringify(backup, null, 2),
          "application/json;charset=utf-8",
        );
      }

      useProjectStore.setState({
        customers: [],
        projects: [],
        projectItems: [],
        calculationTemplates: [],
        costSettingsByProjectId: {},
        quoteSettingsByProjectId: {},
        invoiceSettingsByProjectId: {},
        invoiceItemsByItemId: {},
        sealSettingsByProjectId: {},
        estimateDocuments: [],
        invoiceDocuments: [],
        deliveryDocuments: [],
        orderDocuments: [],
        billingCloseRecords: [],
        lastBackupAt: resetAt,
      });
      localStorage.setItem(
        "mitru-local-store",
        JSON.stringify({
          state: {
            customers: [],
            projects: [],
            projectItems: [],
            calculationTemplates: [],
            workItemMasters,
            materialMasters,
            costSettingsByProjectId: {},
            quoteSettingsByProjectId: {},
            invoiceSettingsByProjectId: {},
            invoiceItemsByItemId: {},
            sealSettingsByProjectId: {},
            estimateDocuments: [],
            invoiceDocuments: [],
            deliveryDocuments: [],
            orderDocuments: [],
            billingCloseRecords: [],
            companyInfo,
            pdfTemplateSettings,
            taxSettings,
            cloudSyncSettings,
            documentNumberSettings,
            lastBackupAt: resetAt,
          },
          version: projectStoreVersion,
        }),
      );
      localStorage.setItem(sampleDataRemovedKey, "done");
      localStorage.removeItem("mitru-onboarding-completed");
      localStorage.setItem("mitru-business-data-reset-at", resetAt);
      window.dispatchEvent(new Event("mitru-onboarding-open"));
      navigate("/settings", { replace: true });
      setResetOpen(false);
      notify(
        withBackup ? "バックアップしてリセットしました" : "バックアップせずにリセットしました",
        "サンプルを含む案件・顧客・積算明細・書類データを削除しました。マスタ、会社情報、ロゴ、社判、設定は保持しています。",
      );
    } catch (error) {
      notify("リセットに失敗しました", error instanceof Error ? error.message : "不明なエラー", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.section
      className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">データ出力</h3>
        <p className="mt-1 text-sm text-slate-400">
          案件一覧と帳票PDFを書き出します。バックアップ/復元機能はここには表示しません。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">全案件をCSVで出力</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            案件名、顧客名、工事場所、契約金額、更新日などをCSVで書き出します。
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={exportProjectsCsv} disabled={busy}>
            <FileDown className="size-4" />
            全案件CSV出力
          </Button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">全データをJSONでバックアップ</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            案件、顧客、書類、マスタ、設定をまとめてJSON形式で保存します。
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={exportBackupJson} disabled={busy}>
            <DatabaseBackup className="size-4" />
            JSONバックアップ出力
          </Button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">帳票PDF一括出力（調整中）</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            v0.9.7-betaでは日本語表示の安定性を優先し、一括PDF出力を一時停止しています。各書類画面の「印刷用HTMLを書き出す」から保存してください。
          </p>
          <Button className="mt-4 gap-2" disabled>
            調整中
          </Button>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-rose-300/40 bg-rose-500/10 p-4 dark:border-rose-400/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">
                業務データをリセット（サンプル含む）
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                案件、顧客、積算明細、見積書、請求書、入金記録、納品書、注文書、請求締めなどの業務データを削除します。
                工事項目マスタ、材料マスタ、会社情報、ロゴ、社判、アプリ設定、クラウド同期設定は保持されます。
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-400/40 dark:text-rose-200 dark:hover:bg-rose-400/10"
            onClick={() => setResetOpen(true)}
            disabled={busy}
          >
            <RotateCcw className="size-4" />
            リセットを実行
          </Button>
        </div>
      </div>
      {busy && (
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-950/60">
          <motion.div
            className="h-full rounded-full bg-emerald-400"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
          />
        </div>
      )}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent
          overlayClassName="z-[2147483647]"
          className="z-[2147483647] left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-white/10 bg-white p-5 text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white sm:max-w-2xl sm:p-6"
        >
          <DialogHeader className="pr-7">
            <DialogTitle className="break-words">業務データをリセットしますか？</DialogTitle>
            <DialogDescription className="break-words leading-7 text-slate-600 dark:text-slate-400">
              サンプルを含む案件、顧客、積算明細、見積書、請求書、入金記録、納品書、注文書、請求締めデータを削除します。
              工事項目マスタ、材料マスタ、会社情報、ロゴ、社判、アプリ設定、クラウド同期設定は保持されます。
            </DialogDescription>
          </DialogHeader>
          <div className="break-words rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            バックアップせずにリセットすると、削除した業務データは元に戻せません。迷う場合はJSONバックアップを作成してから実行してください。
          </div>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              className="min-h-11 whitespace-normal px-5 text-center sm:min-w-[120px]"
              onClick={() => setResetOpen(false)}
            >
              キャンセル
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="min-h-11 whitespace-normal border-rose-300 px-5 text-center text-rose-700 hover:bg-rose-50 dark:border-rose-400/40 dark:text-rose-200 dark:hover:bg-rose-400/10 sm:min-w-[200px]"
                onClick={() => resetBusinessData(false)}
                disabled={busy}
              >
                バックアップせずにリセット
              </Button>
              <Button
                className="min-h-11 whitespace-normal bg-rose-600 px-6 text-center text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700 sm:min-w-[230px]"
                onClick={() => resetBusinessData(true)}
                disabled={busy}
              >
                JSONバックアップしてリセット
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </motion.section>
  );
}
