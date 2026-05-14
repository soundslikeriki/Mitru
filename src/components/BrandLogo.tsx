import { motion } from "framer-motion";
import mitruMark from "@/assets/brand/mitru-mark.png";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  subtitle?: string;
  animated?: boolean;
};

export function BrandLogo({
  className = "",
  markClassName = "size-11",
  textClassName = "text-white",
  subtitle,
  animated = false,
}: BrandLogoProps) {
  const mark = (
    <div className={`overflow-hidden rounded-xl bg-white shadow-lg shadow-blue-950/20 ${markClassName}`}>
      <img src={mitruMark} alt="Mitru" className="size-full object-cover" />
    </div>
  );

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {animated ? (
        <motion.div
          initial={{ rotate: -8, scale: 0.94 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          {mark}
        </motion.div>
      ) : (
        mark
      )}
      <div className="min-w-0">
        <p className={`truncate text-xl font-semibold tracking-normal ${textClassName}`}>Mitru</p>
        {subtitle && <p className="truncate text-xs font-medium text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}
