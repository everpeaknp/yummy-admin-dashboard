"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { type AuthSession } from "@/lib/auth";
import { Menu, X } from "lucide-react";

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

  useEffect(() => {
    // Redirect is a side-effect; don't use state to gate it.
    if (session === null) {
      router.replace("/login");
      return;
    }
  }, [router, pathname, session]);

  useEffect(() => {
    // Avoid background scroll on mobile when the drawer is open.
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
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
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      {/* Mobile nav trigger (desktop unchanged) */}
      <button
        type="button"
        className="md:hidden fixed right-4 top-4 z-[60] inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
        onClick={() => setMobileNavOpen((open) => !open)}
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNavOpen}
      >
        {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      
      {/* Main Content */}
      <main className="ml-0 md:ml-[200px] flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
