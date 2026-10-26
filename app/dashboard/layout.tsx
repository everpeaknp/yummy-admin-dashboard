"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { canAccessAdminDashboard, clearAuthSession, type AuthSession } from "@/lib/auth";
import { Menu } from "lucide-react";

const AUTH_STORAGE_KEY = "yummy_auth_session";
const SSR_SNAPSHOT = "__SSR__";

function subscribeToAuthChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  // `storage` fires across tabs; this still helps.
  window.addEventListener("storage", onStoreChange);
  // Same-tab updates from our auth helpers.
  window.addEventListener("yummy-auth", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("yummy-auth", onStoreChange);
  };
}

function getAuthSnapshot(): string | null {
  // Return a stable primitive snapshot (string/null). Returning objects will
  // cause React to think the store changed every time and can infinite-loop.
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

function getAuthServerSnapshot(): string {
  // Keep server + first client render consistent; we resolve auth after hydration.
  return SSR_SNAPSHOT;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sessionRaw = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, getAuthServerSnapshot);
  const session = useMemo<AuthSession | null | undefined>(() => {
    if (sessionRaw === SSR_SNAPSHOT) {
      return undefined;
    }
    if (!sessionRaw) {
      return null;
    }
    try {
      return JSON.parse(sessionRaw) as AuthSession;
    } catch {
      return null;
    }
  }, [sessionRaw]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileNavOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    // Redirect is a side-effect; don't use state to gate it.
    if (session === null) {
      router.replace("/login");
      return;
    }

    // This app is the platform admin console. Restaurant-level admins must not
    // be able to access it even if they can authenticate against the backend.
    if (session) {
      if (!canAccessAdminDashboard(session)) {
        clearAuthSession();
        router.replace("/login?reason=unauthorized");
      }
    }
  }, [router, pathname, session]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileNavOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-w-0 bg-gray-50 dark:bg-gray-900">
      <a href="#dashboard-main" className="sr-only fixed left-3 top-3 z-[70] rounded-lg bg-white px-4 py-3 font-semibold text-slate-900 focus:not-sr-only focus:outline focus:outline-2 focus:outline-orange-600">Skip to content</a>
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={closeMobileNav} />
      <main id="dashboard-main" className="dashboard-content ml-0 flex min-w-0 flex-1 flex-col md:ml-[200px]">
        <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-controls="mobile-admin-navigation"
            aria-expanded={mobileNavOpen}
          >
            <Menu size={22} />
          </button>
          <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">Yummy Admin</span>
        </div>
        {children}
      </main>
    </div>
  );
}
