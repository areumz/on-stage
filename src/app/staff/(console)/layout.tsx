import TabToggle from "@/components/common/TabToggle";
import Sidebar from "@/components/staff/Sidebar";
import { getStaffRoleLabel } from "@/lib/data";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const roleLabel = await getStaffRoleLabel();
  return (
    <div className="flex min-h-screen bg-surface-1 text-gray-900">
      <Sidebar roleLabel={roleLabel} />
      <div className="flex flex-1 flex-col px-10 py-8">
        {/* 설계 3장: A/B 토글은 전 화면 상시 노출 — Coming soon 화면도 포함하려 layout에 둔다 */}
        <div className="flex justify-end">
          <TabToggle />
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
