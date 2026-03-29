"use client";
import AdminListPage from "@/components/admin/AdminListPage";

const RISK_LABELS = { critical: "重大", high: "高", medium: "中", low: "低" };
const RISK_COLORS = { critical: "text-red-700 bg-red-50", high: "text-orange-700 bg-orange-50", medium: "text-yellow-700 bg-yellow-50", low: "text-green-700 bg-green-50" };

const COLUMNS = [
  { key: "company_name", label: "事業者名" },
  { key: "prefecture", label: "都道府県" },
  { key: "license_type", label: "許可種別" },
  {
    key: "risk_level",
    label: "リスク",
    render: (item) => {
      const l = item.risk_level;
      return l ? (
        <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${RISK_COLORS[l] || ""}`}>
          {RISK_LABELS[l] || l}
        </span>
      ) : "—";
    },
  },
  { key: "penalty_count", label: "処分回数" },
  { key: "status", label: "状態" },
  { key: "updated_at", label: "更新日", render: (item) => item.updated_at?.substring(0, 10) || "—" },
];

export default function SanpaiAdminListPage() {
  return (
    <AdminListPage
      title="産廃処分ウォッチ 管理"
      apiPath="/api/admin/sanpai"
      basePath="/admin/sanpai"
      publicPath="/sanpai"
      columns={COLUMNS}
    />
  );
}
