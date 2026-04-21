"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  CreditCard,
  Repeat,
  Wallet,
  Users,
  Building2,
  LogOut
} from "lucide-react";
import { logoutSession } from "@/lib/auth";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logoutSession();
    router.replace("/login");
  };

  const menuItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/restaurants", label: "Restaurants", icon: Building2 },
    { href: "/dashboard/plans", label: "Plans & Billing", icon: CreditCard },
    { href: "/dashboard/subscriptions", label: "Subscriptions", icon: Repeat },
    { href: "/dashboard/payments", label: "Payments", icon: Wallet },
    { href: "/dashboard/settings", label: "Access & Settings", icon: Users },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-[200px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen fixed left-0 top-0 flex flex-col transition-colors">
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700">
        <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-xl font-bold">Y</span>
        </div>
        <span className="text-base font-bold text-orange-500">Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                active
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Support Section */}
      <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-4">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-3">
          SUPPORT
        </p>
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
            pathname === "/dashboard/settings"
              ? "bg-orange-500 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <span>Settings</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-red-600 transition-all hover:bg-red-50"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
