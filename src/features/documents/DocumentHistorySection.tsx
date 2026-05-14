import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function DocumentHistorySection({
  title,
  description,
  columns,
  counter,
  actions,
  children,
}: {
  title: string;
  description: string;
  columns: string[];
  counter?: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/10 p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {counter}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40">
        <table className="w-full min-w-[620px] table-auto text-sm xl:min-w-0">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
              {columns.map((column) => (
                <th key={column} className={`px-4 py-3 ${column === "操作" ? "text-right" : ""}`}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

export function DocumentCountBadge({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/[0.12] dark:text-emerald-300">
      {label} {count}件
    </span>
  );
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const className =
    status === "発行済"
      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/[0.12] dark:text-emerald-300"
      : status === "失効"
        ? "border-red-300 bg-red-100 text-red-800 dark:border-red-400/25 dark:bg-red-400/[0.10] dark:text-red-200"
        : "border-gray-300 bg-gray-100 text-gray-700 dark:border-amber-300/25 dark:bg-amber-400/[0.12] dark:text-amber-200";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>{status}</span>;
}

export const DocumentHistoryRow = motion.tr;
