import {
  exportAllDocumentsPdf,
  exportDocumentPdf,
  openPrintPreviewWindow,
  openSealPlacementEditorWindow,
} from "@/features/documents/document-exporters";

export function useDocumentExport() {
  return {
    exportAllDocumentsPdf,
    exportDocumentPdf,
    openPrintPreviewWindow,
    openSealPlacementEditorWindow,
  };
}
