import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { PlusCircle, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerFormFields, Field } from "@/features/customers/components/CustomerForm";
import { persistImageAssetReferences } from "@/lib/image-storage";
import {
  blankCustomerInput,
  extractBusinessCardText,
  formatOcrStatus,
  hasCustomerIdentity,
  normalizeCustomerInput,
  normalizeCustomerInputField,
  readFileAsDataUrl,
  requiredFieldsMessage,
} from "@/features/customers/lib/customer-utils";
import { type CustomerInput, useProjectStore } from "@/stores/project-store";

export function BusinessCardDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply?: (data: Partial<CustomerInput>) => void;
}) {
  const createCustomer = useProjectStore((state) => state.createCustomer);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cards, setCards] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [form, setForm] = useState<CustomerInput>(blankCustomerInput());
  const [dragging, setDragging] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("画像をアップロードするとOCRを開始します。");
  const [ocrError, setOcrError] = useState("");

  const runOcr = async (images = cards) => {
    if (images.length === 0 || ocrRunning) return;

    setOcrRunning(true);
    setOcrProgress(0);
    setOcrError("");
    setOcrStatus("日本語OCRエンジンを準備しています...");

    let worker: Awaited<ReturnType<typeof createWorker>> | undefined;

    try {
      worker = await createWorker("jpn+eng", 1, {
        langPath: new URL("/tessdata", window.location.href).toString(),
        gzip: true,
        cacheMethod: "write",
        logger: (message) => {
          if (typeof message.progress === "number") {
            setOcrProgress(Math.round(message.progress * 100));
          }
          setOcrStatus(formatOcrStatus(message.status));
        },
      });
      await worker.setParameters({
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const results: string[] = [];
      for (const [index, image] of images.entries()) {
        setOcrStatus(`名刺画像 ${index + 1}/${images.length} を読み取っています...`);
        const result = await worker.recognize(image);
        results.push(result.data.text.trim());
      }

      const joinedText = results.filter(Boolean).join("\n\n---\n\n");
      setText(joinedText);
      setOcrProgress(100);
      setOcrStatus(joinedText ? "OCRが完了しました。右側の候補を確認・修正できます。" : "文字を検出できませんでした。画像を変えるか手入力してください。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOcrError("OCRに失敗しました。画像の明るさ・ピントを確認するか、手入力で補正してください。");
      setOcrStatus(`OCRを完了できませんでした。${message ? `(${message})` : ""}`);
    } finally {
      await worker?.terminate();
      setOcrRunning(false);
    }
  };

  const readFiles = async (files: FileList | File[]) => {
    const images = await Promise.all(Array.from(files).filter((file) => file.type.startsWith("image/")).map(readFileAsDataUrl));
    if (images.length === 0) return;

    setCards((current) => {
      setSelectedCardIndex(current.length);
      return [...current, ...images];
    });
    await runOcr(images);
  };

  useEffect(() => {
    const extracted = extractBusinessCardText(text);
    setForm((current) => normalizeCustomerInput({
      ...current,
      ...extracted,
      businessCards: cards,
      note: current.note || "名刺画像から登録",
    }));
  }, [text, cards]);

  const update = (field: keyof CustomerInput, value: string) =>
    setForm((current) => ({ ...current, [field]: normalizeCustomerInputField(field, value) }));

  const apply = async () => {
    if (!hasCustomerIdentity(form)) {
      window.alert(requiredFieldsMessage);
      return;
    }
    const normalizedForm = normalizeCustomerInput({
      ...form,
      businessCards: await persistImageAssetReferences(form.businessCards, "business-card"),
    });
    if (onApply) {
      onApply(normalizedForm);
      onOpenChange(false);
      return;
    }
    createCustomer(normalizedForm);
    setCards([]);
    setText("");
    setForm(blankCustomerInput());
    setSelectedCardIndex(0);
    setOcrProgress(0);
    setOcrStatus("画像をアップロードするとOCRを開始します。");
    setOcrError("");
    onOpenChange(false);
  };

  const clearCards = () => {
    setCards([]);
    setText("");
    setSelectedCardIndex(0);
    setOcrProgress(0);
    setOcrStatus("画像をアップロードするとOCRを開始します。");
    setOcrError("");
    setForm(blankCustomerInput());
    fileInputRef.current?.click();
  };

  const selectedCard = cards[selectedCardIndex] ?? cards[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>名刺から登録</DialogTitle>
          <DialogDescription>
            Tesseract.jsで日本語・英語の名刺を読み取り、候補を自動入力します。OCR精度が低い場合も右側で手動修正できます。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <section className="grid gap-4">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                readFiles(event.dataTransfer.files);
              }}
              className={`grid min-h-40 cursor-pointer place-items-center rounded-2xl border border-dashed p-5 text-center transition ${
                dragging ? "border-emerald-400 bg-emerald-400/[0.10]" : "border-white/15 bg-white/[0.04] hover:border-emerald-400/40"
              }`}
            >
              <div>
                <ScanText className="mx-auto mb-3 size-8 text-emerald-300" />
                <p className="text-sm font-semibold text-white">名刺画像をアップロード</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">ドラッグ&ドロップ、またはクリックして複数枚選択できます。</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  if (event.target.files) readFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
                className="sr-only"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              {selectedCard ? (
                <a href={selectedCard} target="_blank" rel="noreferrer" title="クリックして拡大表示">
                  <img src={selectedCard} alt="名刺プレビュー" className="max-h-72 w-full rounded-xl border border-white/10 bg-slate-950/70 object-contain" />
                </a>
              ) : (
                <div className="grid min-h-48 place-items-center rounded-xl border border-white/10 bg-slate-950/45 text-sm text-slate-500">
                  画像プレビュー
                </div>
              )}
              {cards.length > 1 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {cards.map((image, index) => (
                    <button
                      key={`${image.slice(0, 24)}-${index}`}
                      type="button"
                      onClick={() => setSelectedCardIndex(index)}
                      className={`rounded-lg border p-1 transition ${selectedCardIndex === index ? "border-emerald-400 bg-emerald-400/[0.10]" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
                    >
                      <img src={image} alt={`名刺 ${index + 1}`} className="h-16 w-full rounded-md object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">OCRステータス</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{ocrStatus}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-emerald-300">{ocrProgress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${ocrProgress}%` }} />
              </div>
              {ocrError && <p className="mt-3 text-xs leading-5 text-red-300">{ocrError}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-2" disabled={cards.length === 0 || ocrRunning} onClick={() => runOcr(cards)}>
                  <ScanText className="size-3.5" />
                  {ocrRunning ? "読み取り中..." : "再読み取り"}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={ocrRunning} onClick={clearCards}>
                  画像を再選択
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4">
            <Field label="OCR読み取り結果（手動修正可）">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="min-h-28 w-full resize-none rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
                placeholder={"画像をアップロードするとOCR結果が入ります。\n氏名・会社名・電話・メールなどをここで補正できます。"}
              />
            </Field>
            <CustomerFormFields form={form} update={update} />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>キャンセル</Button>
              <Button type="button" className="gap-2" onClick={apply}>
                <PlusCircle className="size-4" />
                {onApply ? "この情報を反映" : "この情報で顧客登録"}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomerBadge({ value, muted = false }: { value: string; muted?: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      muted
        ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400"
        : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/[0.10] dark:text-emerald-300"
    }`}>
      {value}
    </span>
  );
}
