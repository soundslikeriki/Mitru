import type { PrintPreviewInput } from "@/features/documents/types";

export async function exportDocumentPdf(input: PrintPreviewInput) {
  const module = await import("@/features/documents/PdfGenerator");
  return module.exportDocumentPdf(input);
}

export async function exportDeliveryPdf(input: Extract<PrintPreviewInput, { kind: "delivery" }>) {
  const module = await import("@/features/documents/PdfGenerator");
  return module.exportDeliveryPdf(input);
}

export async function exportOrderPdf(input: Extract<PrintPreviewInput, { kind: "order" }>) {
  const module = await import("@/features/documents/PdfGenerator");
  return module.exportOrderPdf(input);
}

export async function exportAllDocumentsPdf(input: Parameters<typeof import("@/features/documents/PdfGenerator").exportAllDocumentsPdf>[0]) {
  const module = await import("@/features/documents/PdfGenerator");
  return module.exportAllDocumentsPdf(input);
}

export async function exportPrintHtml(input: PrintPreviewInput) {
  const module = await import("@/features/documents/PdfGenerator");
  return module.exportPrintHtml(input);
}

export async function openPrintPreviewWindow(input: PrintPreviewInput) {
  const module = await import("@/features/documents/PdfGenerator");
  return module.openPrintPreviewWindow(input);
}

export async function openSealPlacementEditorWindow(
  input: PrintPreviewInput,
  onSave: Parameters<typeof import("@/features/documents/PdfGenerator").openSealPlacementEditorWindow>[1],
) {
  const module = await import("@/features/documents/PdfGenerator");
  return module.openSealPlacementEditorWindow(input, onSave);
}
