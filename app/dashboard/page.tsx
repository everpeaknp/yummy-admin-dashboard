"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  // Work around a Next/React dev-time perf-measure crash when a Server Component
  // immediately throws `redirect()`.
  // The dashboard layout already enforces auth and will redirect to /login if needed.
  // After hydration, we navigate to the Overview page.
  //
  // (This keeps production behavior the same, but avoids the dev runtime crash:
  // "Performance.measure ... cannot have a negative time stamp".)
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/overview");
  }, [router]);

  return null;
}
