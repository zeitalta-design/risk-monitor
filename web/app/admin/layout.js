import AdminGuard from "@/components/AdminGuard";
import OpsSidebar from "@/components/admin/OpsSidebar";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-gray-50 -mt-[1px]">
        <OpsSidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
