import { useCallback, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mainAreaDialogClass } from "@/components/ui/dialog-layout";

const defaultRequiredFieldsMessage = "少なくとも1項目は入力してください。";

type ValidationNotice = {
  title: string;
  description: string;
  items?: string[];
};

export function useValidationNoticeDialog() {
  const [notice, setNotice] = useState<ValidationNotice | null>(null);

  const showRequiredFields = useCallback((items?: string[]) => {
    setNotice({
      title: "未入力の項目があります",
      description: items?.length ? "以下の項目を入力してください。" : defaultRequiredFieldsMessage,
      items,
    });
  }, []);

  const showNotice = useCallback((title: string, description: string) => {
    setNotice({ title, description });
  }, []);

  const dialog = (
    <Dialog open={Boolean(notice)} onOpenChange={(open) => !open && setNotice(null)}>
      <DialogContent
        className={`${mainAreaDialogClass} z-[10001] max-w-md border-red-200 bg-white text-slate-900 shadow-2xl dark:border-red-400/20 dark:bg-slate-950 dark:text-white`}
        overlayClassName="z-[10000]"
      >
        <DialogHeader>
          <div className="flex items-start gap-3 pr-7">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-slate-950 dark:text-white">
                {notice?.title ?? "未入力の項目があります"}
              </DialogTitle>
              <DialogDescription className="mt-1 leading-6 text-slate-600 dark:text-slate-300">
                {notice?.description ?? defaultRequiredFieldsMessage}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {notice?.items?.length ? (
          <ul className="ml-12 grid gap-1 rounded-xl border border-red-100 bg-red-50/70 px-4 py-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
            {notice.items.map((item) => (
              <li key={item}>・{item}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end pt-1">
          <Button type="button" onClick={() => setNotice(null)}>
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { dialog, showNotice, showRequiredFields };
}
