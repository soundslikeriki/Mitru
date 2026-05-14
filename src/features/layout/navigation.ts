import {
  Calculator,
  BarChart3,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  PackageCheck,
  Landmark,
  CalendarCheck,
  ReceiptText,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Users,
} from "lucide-react";

export const menuItems = [
  { label: "ダッシュボード", englishLabel: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "レポート", englishLabel: "Reports", icon: BarChart3, to: "/reports" },
  { label: "案件管理", englishLabel: "Projects", icon: ClipboardList, to: "/projects" },
  { label: "見積書一覧", englishLabel: "Estimates", icon: FileText, to: "/estimates" },
  { label: "請求書一覧", englishLabel: "Invoices", icon: ReceiptText, to: "/invoices" },
  { label: "入金管理", englishLabel: "Payments", icon: Landmark, to: "/payments" },
  { label: "請求締め", englishLabel: "Billing Close", icon: CalendarCheck, to: "/billing" },
  { label: "購買・支払管理", englishLabel: "Purchases", icon: ShoppingCart, to: "/purchases" },
  { label: "納品書一覧", englishLabel: "Deliveries", icon: PackageCheck, to: "/deliveries" },
  { label: "注文書一覧", englishLabel: "Orders", icon: ShoppingCart, to: "/orders" },
  { label: "顧客管理", englishLabel: "Customers", icon: Users, to: "/customers" },
  { label: "マスタ設定", englishLabel: "Masters", icon: SlidersHorizontal, to: "/masters" },
  { label: "設定", englishLabel: "Settings", icon: Settings, to: "/settings" },
  { label: "ヘルプ", englishLabel: "Help", icon: HelpCircle, to: "/help" },
];

export function getHeaderMeta(pathname: string) {
  if (pathname.startsWith("/projects")) return { section: "案件管理", englishSection: "Projects", icon: ClipboardList };
  if (pathname.startsWith("/reports")) return { section: "レポート", englishSection: "Reports", icon: BarChart3 };
  if (pathname.startsWith("/customers")) return { section: "顧客管理", englishSection: "Customers", icon: Users };
  if (pathname.startsWith("/calculation")) return { section: "積算管理", englishSection: "Calculation", icon: Calculator };
  if (pathname.startsWith("/estimates")) return { section: "見積書一覧", englishSection: "Estimates", icon: FileText };
  if (pathname.startsWith("/invoices")) return { section: "請求書一覧", englishSection: "Invoices", icon: ReceiptText };
  if (pathname.startsWith("/payments")) return { section: "入金管理", englishSection: "Payments", icon: Landmark };
  if (pathname.startsWith("/billing")) return { section: "請求締め", englishSection: "Billing Close", icon: CalendarCheck };
  if (pathname.startsWith("/purchases")) return { section: "購買・支払管理", englishSection: "Purchases", icon: ShoppingCart };
  if (pathname.startsWith("/deliveries")) return { section: "納品書一覧", englishSection: "Deliveries", icon: PackageCheck };
  if (pathname.startsWith("/orders")) return { section: "注文書一覧", englishSection: "Orders", icon: ShoppingCart };
  if (pathname.startsWith("/masters")) return { section: "マスタ設定", englishSection: "Masters", icon: SlidersHorizontal };
  if (pathname.startsWith("/settings")) return { section: "設定", englishSection: "Settings", icon: Settings };
  if (pathname.startsWith("/help")) return { section: "ヘルプ", englishSection: "Help", icon: HelpCircle };
  return { section: "ダッシュボード", englishSection: "Dashboard", icon: LayoutDashboard };
}
