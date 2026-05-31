import {
  exportAllDocumentsPdf,
  exportDocumentPdf,
  exportPrintHtml,
  openPrintPreviewWindow,
  openSealPlacementEditorWindow,
} from "@/features/documents/document-exporters";

export function useDocumentExport() {
  return {
    exportAllDocumentsPdf,
    exportDocumentPdf,
    exportPrintHtml,
    openPrintPreviewWindow,
    openSealPlacementEditorWindow,
  };
}
