import { motion } from "framer-motion";

export type ToastState = { title: string; description: string; tone?: "success" | "error" } | null;

export function ToastMessage({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  if (!toast) return null;

  return (
    <motion.div
      className={`fixed bottom-5 right-5 z-[100] w-[340px] rounded-xl border p-4 shadow-2xl backdrop-blur-xl ${
        toast.tone === "error"
          ? "border-red-400/30 bg-red-950/80"
          : "border-emerald-400/30 bg-slate-950/90"
      }`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{toast.title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-400">{toast.description}</p>
        </div>
        <button className="text-slate-500 transition hover:text-white" onClick={onClose}>
          ×
        </button>
      </div>
    </motion.div>
  );
}
