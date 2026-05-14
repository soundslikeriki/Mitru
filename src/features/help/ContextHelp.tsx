import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ContextHelpProps = {
  title: string;
  description: string;
  items: string[];
};

export function ContextHelp({ title, description, items }: ContextHelpProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 rounded-full px-3 text-xs"
          aria-label={`${title}のヘルプを開く`}
        >
          <HelpCircle className="size-4" />
          ヘルプ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-7">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {items.map((item, index) => (
            <div
              key={item}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-400/[0.14] dark:text-emerald-200">
                {index + 1}
              </span>
              <span className="leading-6">{item}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
