import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
  compact?: boolean;
};

type ErrorBoundaryState = {
  error: Error | null;
};

const projectStoreKey = "mitru-local-store";

function backupProjectStoreBeforeReset() {
  try {
    const raw = localStorage.getItem(projectStoreKey);
    if (!raw) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    localStorage.setItem(`${projectStoreKey}-error-backup-${timestamp}`, raw);
    localStorage.setItem("mitru-local-store-recovered-at", new Date().toISOString());
  } catch (error) {
    console.warn("[Mitru] ローカル保存データの退避に失敗しました。", error);
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Mitru] 画面描画エラーを検知しました。", error, errorInfo);
  }

  private reload = () => {
    window.location.reload();
  };

  private recoverLocalStore = () => {
    backupProjectStoreBeforeReset();
    try {
      localStorage.removeItem(projectStoreKey);
    } catch (error) {
      console.warn("[Mitru] ローカル保存データの初期化に失敗しました。", error);
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const wrapperClassName = this.props.compact
      ? "grid min-h-[360px] place-items-center rounded-2xl border border-slate-200 bg-white px-4 py-8 text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-950/60 dark:text-white"
      : "grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-white";

    return (
      <div className={wrapperClassName}>
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/30">
          <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-normal">画面の読み込みで問題が発生しました</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            一時的な描画エラー、または端末内の保存データが壊れている可能性があります。まずは画面の再読み込みを試してください。
            復旧を実行すると現在の保存データを退避してから初期状態で再起動します。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={this.reload} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <RefreshCw className="size-4" />
              画面を再読み込み
            </Button>
            <Button variant="outline" onClick={this.recoverLocalStore} className="gap-2">
              <RotateCcw className="size-4" />
              ローカル保存を退避して再起動
            </Button>
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-500">
            退避データはブラウザのlocalStorage内にバックアップキーとして残ります。
          </p>
        </div>
      </div>
    );
  }
}
