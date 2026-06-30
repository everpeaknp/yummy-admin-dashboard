"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  LayoutDashboard, 
  CreditCard,
  Repeat,
  Wallet,
  Users,
  Building2,
  LogOut,
  X,
  Shield,
} from "lucide-react";
import {
  logoutSession,
  getStoredAuthSession,
  type AuthSession,
  canViewPlatformStaff,
  hasPermission,
  isSuperadminSession,
} from "@/lib/auth";

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [session] = useState<AuthSession | null>(() => getStoredAuthSession());

  const handleLogout = async () => {
    await logoutSession();
    router.replace("/login");
  };

  const isSuperadmin = session ? isSuperadminSession(session) : false;

  const allMenuItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/leads", label: "Leads", icon: Users, permission: "platform.leads.view" },
    { href: "/dashboard/restaurants", label: "Restaurants", icon: Building2, permission: "platform.restaurants.view" },
    { href: "/dashboard/plans", label: "Plans & Billing", icon: CreditCard, permission: "platform.billing.manage" },
    { href: "/dashboard/subscriptions", label: "Subscriptions", icon: Repeat, permission: "platform.billing.manage" },
    { href: "/dashboard/payments", label: "Payments", icon: Wallet, permission: "platform.billing.manage" },
    { href: "/dashboard/staff", label: "Platform Staff", icon: Shield, canAccess: canViewPlatformStaff },
    { href: "/dashboard/settings", label: "Access & Settings", icon: Users },
  ];
  
  const menuItems = allMenuItems.filter(item => {
    if (isSuperadmin) return true;
    if ("canAccess" in item && item.canAccess && !item.canAccess(session)) return false;
    if (item.permission && !hasPermission(session, item.permission)) return false;
    return true;
  });

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const closeMobile = () => onMobileClose?.();

  const content = (
    <>
      {/* Logo */}
      <div className="admin-sidebar__header px-5 py-6 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-orange-200/70 shadow-sm dark:bg-slate-800 dark:ring-orange-500/20">
            <Image
              src="/yummy_logo.png"
              alt="Yummy"
              fill
              priority
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="leading-tight">
            <span className="block text-base font-bold text-orange-500">Admin</span>
            <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Platform Console
            </span>
          </div>
        </div>

        {/* Mobile close */}
        <button
          type="button"
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={closeMobile}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="admin-sidebar__nav flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={`admin-sidebar__link flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-semibold transition-all ${
                active
                  ? "bg-orange-500 text-white shadow-[0_10px_24px_-14px_rgba(249,115,22,0.95)]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Support Section */}
      <div className="admin-sidebar__support border-t border-slate-200 dark:border-slate-700 px-3 py-4">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.22em] mb-3 px-3">
          SUPPORT
        </p>
        <Link
          href="/dashboard/settings"
          onClick={closeMobile}
          className={`admin-sidebar__link flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-semibold transition-all ${
            pathname === "/dashboard/settings"
              ? "bg-orange-500 text-white shadow-[0_10px_24px_-14px_rgba(249,115,22,0.95)]"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          }`}
        >
          <span>Settings</span>
        </Link>
        <button
          type="button"
          onClick={async () => {
            closeMobile();
            await handleLogout();
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold text-red-600 transition-all hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar (unchanged behavior) */}
      <aside className="admin-sidebar hidden md:flex w-[200px] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 min-h-screen fixed left-0 top-0 flex-col transition-colors">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation overlay"
            onClick={closeMobile}
          />
          <aside className="admin-sidebar absolute left-0 top-0 h-screen w-[200px] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
