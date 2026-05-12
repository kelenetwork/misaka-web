import { redirect } from "next/navigation";

export default function DashboardRedirect() {
  // /dashboard 历史路由，统一跳 /inventory（监控页就是 dashboard）
  redirect("/inventory");
}
