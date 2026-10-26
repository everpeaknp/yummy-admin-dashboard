"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { 
  LayoutDashboard, 
  CreditCard,
  Repeat,
  Users,
  Building2,
  Hotel,
  ReceiptText,
  PanelTop,
  BookOpenCheck,
  LogOut,
  X,
  Shield,
  MessageSquareText,
} from "lucide-react";
import {
  logoutSession,
  getStoredAuthSession,
  type AuthSession,
  canViewPlatformStaff,
  canViewBillingCatalog,
  canViewBillingSubscriptions,
  canViewBillingPayments,
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
  const mobileDrawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    mobileDrawerRef.current?.querySelector<HTMLElement>('button[aria-label="Close navigation"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileClose?.();
      if (event.key !== "Tab") return;
      const focusable = Array.from(mobileDrawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onMobileClose]);

  const handleLogout = async () => {
    await logoutSession();
    router.replace("/login");
  };

  const isSuperadmin = session ? isSuperadminSession(session) : false;

  const allMenuItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/leads", label: "Leads", icon: Users, permission: "platform.leads.view" },
    { href: "/dashboard/restaurants", label: "Restaurants", icon: Building2, permission: "platform.restaurants.view" },
    { href: "/dashboard/hotels", label: "Hotels", icon: Hotel, permission: "platform.restaurants.view" },
    { href: "/dashboard/banners", label: "Dashboard banners", icon: PanelTop, permission: "platform.restaurants.manage" },
    { href: "/dashboard/help-center", label: "Guides & tutorials", icon: BookOpenCheck, permission: "platform.restaurants.manage" },
    { href: "/dashboard/plans", label: "Plans", icon: CreditCard, canAccess: canViewBillingCatalog },
    { href: "/dashboard/sms-credits", label: "SMS credits", icon: MessageSquareText, canAccess: canViewBillingCatalog },
    { href: "/dashboard/subscriptions", label: "Subscriptions", icon: Repeat, canAccess: canViewBillingSubscriptions },
    { href: "/dashboard/payments", label: "Payments", icon: ReceiptText, canAccess: canViewBillingPayments },
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
      return pathname === "/dashboard" || pathname === "/dashboard/overview";
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
          className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:text-slate-300 dark:hover:bg-slate-800"
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
          ACCOUNT
        </p>
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
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation overlay"
            onClick={closeMobile}
          />
          <aside id="mobile-admin-navigation" ref={mobileDrawerRef} aria-label="Admin navigation" className="admin-sidebar absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
