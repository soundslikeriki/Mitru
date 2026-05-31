import { motion } from "framer-motion";
import { createPortal } from "react-dom";

export type ToastState = { title: string; description: string; tone?: "success" | "error" } | null;

export function ToastMessage({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  if (!toast) return null;

  const isError = toast.tone === "error";

  const toastElement = (
    <motion.div
      className={`fixed bottom-4 left-4 right-4 z-[900] mx-auto w-auto max-w-[380px] rounded-xl border p-4 shadow-2xl backdrop-blur-xl sm:left-auto sm:bottom-6 sm:right-6 sm:w-[360px] sm:max-w-[calc(100vw-2rem)] ${
        isError
          ? "border-rose-200 bg-rose-100 text-rose-950 shadow-rose-950/10 ring-1 ring-rose-200/70 dark:border-rose-300/35 dark:bg-rose-200 dark:text-rose-950 dark:shadow-rose-950/35 dark:ring-rose-300/25"
          : "border-emerald-400/30 bg-slate-950/90"
      }`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-sm font-semibold ${isError ? "text-rose-950" : "text-white"}`}>{toast.title}</p>
          <p className={`mt-1 text-sm leading-5 ${isError ? "text-slate-800" : "text-slate-400"}`}>
            {toast.description}
          </p>
        </div>
        <button className={`transition ${isError ? "text-rose-700 hover:text-rose-950" : "text-slate-500 hover:text-white"}`} onClick={onClose}>
          ×
        </button>
      </div>
    </motion.div>
  );

  return createPortal(toastElement, document.body);
}
