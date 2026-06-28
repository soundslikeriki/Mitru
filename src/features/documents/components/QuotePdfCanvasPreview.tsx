import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { generateQuotePdfBytes } from "@/features/documents/document-exporters";
import type { PrintPreviewInput } from "@/features/documents/types";
import { loadImageAsset } from "@/lib/image-storage";

type QuotePdfInput = Extract<PrintPreviewInput, { kind: "quote" }>;
type SealPlacementSaveInput = Partial<QuotePdfInput["sealSettings"]>;
type QuotePdfCanvasPreviewProps = {
  input: QuotePdfInput;
  onSavePlacement?: (settings: SealPlacementSaveInput) => void | Promise<void>;
};
type CanvasSize = {
  width: number;
  height: number;
  scale: number;
};
type Point = {
  x: number;
  y: number;
};
type ImageAsset = {
  src: string;
  width: number;
  height: number;
};
type OverlayBox = {
  key: OverlayKey;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
  normalizedCenter: Point;
};
type OverlayKey = "logo" | "seal";
type OverlayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type OverlayInteraction = {
  key: OverlayKey;
  mode: "drag" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startRect: OverlayRect;
  aspectRatio: number;
};

const pdfPreviewPageSize = { width: 595.28, height: 841.89 };
const pdfPreviewScale = 1.28;
const minOverlaySize = 16;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function QuotePdfCanvasPreview({ input, onSavePlacement }: QuotePdfCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const interactionRef = useRef<OverlayInteraction | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize | null>(null);
  const [overlayRects, setOverlayRects] = useState<Partial<Record<OverlayKey, OverlayRect>>>({});
  const [selectedOverlay, setSelectedOverlay] = useState<OverlayKey | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<Pick<OverlayInteraction, "key" | "mode"> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const logoImage = useResolvedImageAsset(input.companyInfo.logoImage);
  const sealImage = useResolvedImageAsset(input.sealSettings.sealImage || input.companyInfo.sealImage);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    async function renderPdf() {
      setStatus("loading");
      setErrorMessage("");
      setCanvasSize(null);
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const pdfBytes = await generateQuotePdfBytes(input, { suppressLogoAndSeal: true });
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({ data: Uint8Array.from(pdfBytes) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: pdfPreviewScale });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("PDFプレビュー用canvasを初期化できませんでした。");

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        await renderTask.promise;
        if (!cancelled) {
          setCanvasSize({ width: viewport.width, height: viewport.height, scale: viewport.width / pdfPreviewPageSize.width });
          setStatus("ready");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[Mitru] PDF.js見積書プレビューの描画に失敗しました。", error);
        setErrorMessage(error instanceof Error ? error.message : "PDF配置確認を表示できませんでした。");
        setStatus("error");
      }
    }

    void renderPdf();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
  }, [input]);

  const initialOverlays = useMemo(
    () => (canvasSize ? buildPreviewOverlays(input, canvasSize, logoImage, sealImage) : []),
    [canvasSize, input, logoImage, sealImage],
  );
  const overlays = useMemo(
    () =>
      initialOverlays.map((overlay) => ({
        ...overlay,
        rect: overlayRects[overlay.key] ?? overlayBoxToRect(overlay),
      })),
    [initialOverlays, overlayRects],
  );
  const hasSaveableOverlay = Boolean(overlayRects.logo || overlayRects.seal);

  useEffect(() => {
    const nextRects = Object.fromEntries(initialOverlays.map((overlay) => [overlay.key, overlayBoxToRect(overlay)])) as Partial<
      Record<OverlayKey, OverlayRect>
    >;
    setOverlayRects(nextRects);
    setSelectedOverlay((current) => {
      if (current && nextRects[current]) return current;
      return initialOverlays[0]?.key ?? null;
    });
  }, [initialOverlays]);

  const startOverlayInteraction = (event: ReactPointerEvent<HTMLElement>, key: OverlayKey, mode: OverlayInteraction["mode"]) => {
    if (!canvasSize) return;
    const rect = overlayRects[key];
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    setSaveMessage(null);
    interactionRef.current = {
      key,
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: rect,
      aspectRatio: rect.width / Math.max(1, rect.height),
    };
    setSelectedOverlay(key);
    setActiveInteraction({ key, mode });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateOverlayInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || !canvasSize) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaX = event.clientX - interaction.startClientX;
    const deltaY = event.clientY - interaction.startClientY;
    setOverlayRects((current) => {
      const nextRect =
        interaction.mode === "drag"
          ? clampOverlayRectToCanvas(
              {
                ...interaction.startRect,
                x: interaction.startRect.x + deltaX,
                y: interaction.startRect.y + deltaY,
              },
              canvasSize,
            )
          : resizeOverlayRect(interaction.startRect, deltaX, deltaY, interaction.aspectRatio, canvasSize);
      return { ...current, [interaction.key]: nextRect };
    });
  };

  const endOverlayInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(interaction.pointerId)) {
      event.currentTarget.releasePointerCapture(interaction.pointerId);
    }
    interactionRef.current = null;
    setActiveInteraction(null);
  };

  const savePlacement = async () => {
    if (!onSavePlacement || !canvasSize || status !== "ready" || !hasSaveableOverlay) return;
    try {
      const nextSettings = buildPlacementSaveInput(input, canvasSize, overlayRects, logoImage, sealImage);
      await onSavePlacement(nextSettings);
      setSaveMessage({ text: "この配置を保存しました。PDFで確認/PDF保存に反映されます。", tone: "success" });
    } catch (error) {
      console.error("[Mitru] PDF配置確認の保存に失敗しました。", error);
      setSaveMessage({
        text: error instanceof Error ? error.message : "この配置を保存できませんでした。",
        tone: "error",
      });
    }
  };

  return (
    <div className="grid gap-3">
      {status === "error" && (
        <div className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
          {errorMessage}
        </div>
      )}
      {status === "loading" && (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-300">
          PDFを読み込み中...
        </div>
      )}
      <div className="max-h-[72vh] overflow-auto rounded-lg border border-slate-200 bg-slate-200 p-4 dark:border-white/10 dark:bg-slate-950">
        <div
          className="relative mx-auto bg-white shadow-2xl shadow-slate-950/25"
          style={{
            width: canvasSize?.width ?? pdfPreviewPageSize.width * pdfPreviewScale,
            height: canvasSize?.height ?? pdfPreviewPageSize.height * pdfPreviewScale,
          }}
        >
          <canvas ref={canvasRef} className="block bg-white" />
          {overlays.map((overlay) => (
            <div
              key={overlay.key}
              data-normalized-x={Math.round(rectToNormalizedRect(overlay.rect, canvasSize ?? pdfPreviewPageSize).x)}
              data-normalized-y={Math.round(rectToNormalizedRect(overlay.rect, canvasSize ?? pdfPreviewPageSize).y)}
              className="absolute select-none"
              onPointerDown={(event) => startOverlayInteraction(event, overlay.key, "drag")}
              onPointerMove={updateOverlayInteraction}
              onPointerUp={endOverlayInteraction}
              onPointerCancel={endOverlayInteraction}
              style={{
                left: overlay.rect.x,
                top: overlay.rect.y,
                width: overlay.rect.width,
                height: overlay.rect.height,
                cursor: activeInteraction?.key === overlay.key && activeInteraction.mode === "drag" ? "grabbing" : "grab",
                outline: selectedOverlay === overlay.key ? "2px solid rgba(16, 185, 129, 0.9)" : "1px dashed rgba(16, 185, 129, 0.65)",
                outlineOffset: 2,
                touchAction: "none",
              }}
            >
              <img
                src={overlay.src}
                alt=""
                aria-hidden="true"
                className="pointer-events-none h-full w-full object-contain"
                style={{ opacity: overlay.opacity }}
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-1.5 -right-1.5 size-3 rounded-full border border-white bg-emerald-500 shadow"
                onPointerDown={(event) => startOverlayInteraction(event, overlay.key, "resize")}
                onPointerMove={updateOverlayInteraction}
                onPointerUp={endOverlayInteraction}
                onPointerCancel={endOverlayInteraction}
                style={{
                  cursor: "nwse-resize",
                  touchAction: "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      {canvasSize && (
        <div className="grid gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          <div>canvas: {Math.round(canvasSize.width)} x {Math.round(canvasSize.height)} px</div>
          <OverlayCoordinateText label="ロゴ" rect={overlayRects.logo} canvasSize={canvasSize} />
          <OverlayCoordinateText label="社判" rect={overlayRects.seal} canvasSize={canvasSize} />
        </div>
      )}
      {onSavePlacement && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
          <button
            type="button"
            onClick={() => void savePlacement()}
            disabled={!canvasSize || status !== "ready" || !hasSaveableOverlay}
            className="h-9 rounded-lg bg-emerald-500 px-4 text-sm font-semibold !text-white shadow-sm transition hover:bg-emerald-600 hover:!text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:!text-slate-500 dark:disabled:bg-white/10 dark:disabled:!text-slate-500"
          >
            この配置で保存
          </button>
          {saveMessage && (
            <span className={saveMessage.tone === "success" ? "text-sm font-medium text-emerald-700 dark:text-emerald-300" : "text-sm font-medium text-red-700 dark:text-red-300"}>
              {saveMessage.text}
            </span>
          )}
          {!hasSaveableOverlay && status === "ready" && (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">保存対象のロゴ/社判overlayがありません。</span>
          )}
        </div>
      )}
    </div>
  );
}

function OverlayCoordinateText({ label, rect, canvasSize }: { label: string; rect?: OverlayRect; canvasSize: CanvasSize }) {
  if (!rect) return <div>{label}: OFF</div>;
  const normalized = rectToNormalizedRect(rect, canvasSize);
  return (
    <div>
      {label}: x={normalized.x}, y={normalized.y}, w={normalized.w}, h={normalized.h}
    </div>
  );
}

function useResolvedImageAsset(referenceOrDataUrl: string) {
  const [asset, setAsset] = useState<ImageAsset | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAsset(null);
    if (!referenceOrDataUrl) return;

    async function load() {
      const src = await loadImageAsset(referenceOrDataUrl);
      if (!src || cancelled) return;
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setAsset({ src, width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
      };
      image.onerror = () => {
        if (!cancelled) setAsset(null);
      };
      image.src = src;
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [referenceOrDataUrl]);

  return asset;
}

function buildPreviewOverlays(
  input: QuotePdfInput,
  canvasSize: CanvasSize,
  logoImage: ImageAsset | null,
  sealImage: ImageAsset | null,
) {
  return [
    buildLogoOverlay(input, canvasSize, logoImage),
    buildSealOverlay(input, canvasSize, sealImage),
  ].filter((overlay): overlay is OverlayBox => Boolean(overlay));
}

function buildLogoOverlay(input: QuotePdfInput, canvasSize: CanvasSize, logoImage: ImageAsset | null): OverlayBox | null {
  if (input.sealSettings.logoEnabled === false || !logoImage) return null;
  const maxWidth = Math.max(40, 118 * (input.sealSettings.logoScale / 100));
  const maxHeight = Math.max(18, 44 * (input.sealSettings.logoScale / 100));
  const fit = fitWithinBox(logoImage, maxWidth, maxHeight);
  const center = normalizedToPdfPoint({ x: input.sealSettings.logoX, y: input.sealSettings.logoY });
  const x = clampNumber(center.x - fit.width / 2, 0, Math.max(0, pdfPreviewPageSize.width - fit.width));
  const y = clampNumber(center.y - fit.height / 2, 0, Math.max(0, pdfPreviewPageSize.height - fit.height));
  return pdfBoxToOverlayBox("logo", logoImage.src, { x, y, width: fit.width, height: fit.height }, canvasSize, input.sealSettings.logoOpacity);
}

function buildSealOverlay(input: QuotePdfInput, canvasSize: CanvasSize, sealImage: ImageAsset | null): OverlayBox | null {
  if (input.sealSettings.enabled === false || !sealImage) return null;
  const scale = input.sealSettings.scale / 100;
  const maxWidth = Math.max(32, input.templateSettings.sealSize * 0.75 * scale);
  const maxHeight = Math.max(24, input.templateSettings.sealSize * 0.58 * scale);
  const fit = fitWithinBox(sealImage, maxWidth, maxHeight);
  const center = normalizedToPdfPoint({ x: input.sealSettings.x, y: input.sealSettings.y });
  const x = clampNumber(center.x - fit.width / 2, 0, Math.max(0, pdfPreviewPageSize.width - fit.width));
  const y = clampNumber(center.y - fit.height / 2, 0, Math.max(0, pdfPreviewPageSize.height - fit.height));
  return pdfBoxToOverlayBox("seal", sealImage.src, { x, y, width: fit.width, height: fit.height }, canvasSize, input.sealSettings.opacity);
}

function normalizedToCanvasPoint(point: Point, canvasSize: Pick<CanvasSize, "width" | "height">): Point {
  return {
    x: (point.x / 1000) * canvasSize.width,
    y: (point.y / 1000) * canvasSize.height,
  };
}

function canvasPointToNormalized(point: Point, canvasSize: Pick<CanvasSize, "width" | "height">): Point {
  return {
    x: canvasSize.width > 0 ? (point.x / canvasSize.width) * 1000 : 0,
    y: canvasSize.height > 0 ? (point.y / canvasSize.height) * 1000 : 0,
  };
}

function normalizedToPdfPoint(point: Point): Point {
  const topLeftPoint = normalizedToCanvasPoint(point, pdfPreviewPageSize);
  return {
    x: topLeftPoint.x,
    y: pdfPreviewPageSize.height - topLeftPoint.y,
  };
}

function pdfBoxToOverlayBox(
  key: OverlayBox["key"],
  src: string,
  box: { x: number; y: number; width: number; height: number },
  canvasSize: CanvasSize,
  opacity: number,
): OverlayBox {
  const left = box.x * canvasSize.scale;
  const top = (pdfPreviewPageSize.height - box.y - box.height) * canvasSize.scale;
  const width = box.width * canvasSize.scale;
  const height = box.height * canvasSize.scale;
  return {
    key,
    src,
    left,
    top,
    width,
    height,
    opacity,
    normalizedCenter: canvasPointToNormalized({ x: left + width / 2, y: top + height / 2 }, canvasSize),
  };
}

function overlayBoxToRect(overlay: OverlayBox): OverlayRect {
  return {
    x: overlay.left,
    y: overlay.top,
    width: overlay.width,
    height: overlay.height,
  };
}

function buildPlacementSaveInput(
  input: QuotePdfInput,
  canvasSize: CanvasSize,
  overlayRects: Partial<Record<OverlayKey, OverlayRect>>,
  logoImage: ImageAsset | null,
  sealImage: ImageAsset | null,
): SealPlacementSaveInput {
  const nextSettings: SealPlacementSaveInput = {
    logoEnabled: input.sealSettings.logoEnabled,
    enabled: input.sealSettings.enabled,
    logoOpacity: input.sealSettings.logoOpacity,
    opacity: input.sealSettings.opacity,
  };
  const logoRect = overlayRects.logo;
  if (logoRect && logoImage) {
    const safeLogoRect = clampOverlayRectToCanvas(logoRect, canvasSize);
    const center = rectCenterToNormalizedPoint(safeLogoRect, canvasSize);
    nextSettings.logoX = center.x;
    nextSettings.logoY = center.y;
    nextSettings.logoScale = findClosestScaleForFit(
      logoImage,
      { width: safeLogoRect.width / canvasSize.scale, height: safeLogoRect.height / canvasSize.scale },
      (scale) => ({
        maxWidth: Math.max(40, 118 * (scale / 100)),
        maxHeight: Math.max(18, 44 * (scale / 100)),
      }),
    );
  }

  const sealRect = overlayRects.seal;
  if (sealRect && sealImage) {
    const safeSealRect = clampOverlayRectToCanvas(sealRect, canvasSize);
    const center = rectCenterToNormalizedPoint(safeSealRect, canvasSize);
    nextSettings.x = center.x;
    nextSettings.y = center.y;
    nextSettings.scale = findClosestScaleForFit(
      sealImage,
      { width: safeSealRect.width / canvasSize.scale, height: safeSealRect.height / canvasSize.scale },
      (scale) => ({
        maxWidth: Math.max(32, input.templateSettings.sealSize * 0.75 * (scale / 100)),
        maxHeight: Math.max(24, input.templateSettings.sealSize * 0.58 * (scale / 100)),
      }),
    );
  }

  return nextSettings;
}

function rectCenterToNormalizedPoint(rect: OverlayRect, canvasSize: Pick<CanvasSize, "width" | "height">): Point {
  const center = canvasPointToNormalized(
    {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    },
    canvasSize,
  );
  return {
    x: Math.round(clampNumber(center.x, 0, 1000)),
    y: Math.round(clampNumber(center.y, 0, 1000)),
  };
}

function findClosestScaleForFit(
  image: ImageAsset,
  desiredSize: Pick<OverlayRect, "width" | "height">,
  getBox: (scale: number) => { maxWidth: number; maxHeight: number },
) {
  const desiredWidth = Math.max(1, desiredSize.width);
  const desiredHeight = Math.max(1, desiredSize.height);
  let bestScale = 100;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let scale = 20; scale <= 240; scale += 1) {
    const box = getBox(scale);
    const fit = fitWithinBox(image, box.maxWidth, box.maxHeight);
    const widthScore = (fit.width - desiredWidth) / desiredWidth;
    const heightScore = (fit.height - desiredHeight) / desiredHeight;
    const score = widthScore * widthScore + heightScore * heightScore;
    if (score < bestScore) {
      bestScore = score;
      bestScale = scale;
    }
  }
  return bestScale;
}

function rectToNormalizedRect(rect: OverlayRect, canvasSize: Pick<CanvasSize, "width" | "height">) {
  return {
    x: Math.round((rect.x / Math.max(1, canvasSize.width)) * 1000),
    y: Math.round((rect.y / Math.max(1, canvasSize.height)) * 1000),
    w: Math.round((rect.width / Math.max(1, canvasSize.width)) * 1000),
    h: Math.round((rect.height / Math.max(1, canvasSize.height)) * 1000),
  };
}

// Canvas overlay rects and ProjectSealSettings both use a top-left origin.
// pdf-lib keeps its own final output safety clamp; the preview remains page-wide.
function clampOverlayRectToCanvas(rect: OverlayRect, canvasSize: Pick<CanvasSize, "width" | "height">): OverlayRect {
  const width = clampNumber(rect.width, minOverlaySize, Math.max(minOverlaySize, canvasSize.width));
  const height = clampNumber(rect.height, minOverlaySize, Math.max(minOverlaySize, canvasSize.height));
  return {
    x: clampNumber(rect.x, 0, Math.max(0, canvasSize.width - width)),
    y: clampNumber(rect.y, 0, Math.max(0, canvasSize.height - height)),
    width,
    height,
  };
}

function resizeOverlayRect(
  startRect: OverlayRect,
  deltaX: number,
  deltaY: number,
  aspectRatio: number,
  canvasSize: Pick<CanvasSize, "width" | "height">,
): OverlayRect {
  const widthFromHorizontalDrag = startRect.width + deltaX;
  const widthFromVerticalDrag = (startRect.height + deltaY) * aspectRatio;
  const preferredWidth = Math.abs(deltaX) >= Math.abs(deltaY) ? widthFromHorizontalDrag : widthFromVerticalDrag;
  const maxWidth = Math.max(minOverlaySize, Math.min(canvasSize.width - startRect.x, (canvasSize.height - startRect.y) * aspectRatio));
  const width = clampNumber(preferredWidth, Math.min(minOverlaySize, maxWidth), maxWidth);
  return clampOverlayRectToCanvas(
    {
      x: startRect.x,
      y: startRect.y,
      width,
      height: width / Math.max(0.01, aspectRatio),
    },
    canvasSize,
  );
}

function fitWithinBox(image: ImageAsset, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / Math.max(1, image.width), maxHeight / Math.max(1, image.height));
  return {
    width: Math.max(1, image.width * scale),
    height: Math.max(1, image.height * scale),
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
