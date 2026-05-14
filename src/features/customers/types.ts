export type ToastState = {
  title: string;
  description: string;
  tone?: "success" | "error";
} | null;
