"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, LockKeyhole, Mail, Eye, EyeOff } from "lucide-react";
import Card from "@/components/Card";
import { getStoredAuthSession, loginWithPassword, saveAuthSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getStoredAuthSession()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await loginWithPassword(email.trim(), password);
      saveAuthSession(response.data);
      router.replace("/dashboard");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.22),_transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 lg:px-10">
        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-orange-200">
              <ShieldCheck size={14} />
              JWT Protected Admin
            </div>

            <h1 className="mt-6 max-w-2xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
              Sign in to the superadmin console.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
              Access the platform dashboard, restaurant controls, billing status, and owner-level settings with a JWT-backed login.
            </p>

            <div className="mt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
              <FeaturePill title="Access Token" text="Short-lived JWT for dashboard sessions" />
              <FeaturePill title="Refresh Token" text="Keeps the session alive securely" />
              <FeaturePill title="Role-aware" text="Superadmin and owner workflows" />
            </div>
          </section>

          <section className="flex items-center justify-center lg:justify-end">
            <Card className="w-full max-w-md border border-white/10 bg-white/95 p-8 shadow-2xl shadow-black/30 backdrop-blur-sm">
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">Yummy Admin</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">Welcome back</h2>
                <p className="mt-2 text-sm text-slate-500">Use your backend credentials to access the dashboard.</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Username / email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="admin"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                      autoComplete="username"
                      required
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Use the exact backend login value for the `superadmin` user. In your database that value is `admin`.
                  </p>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>JWT auth via backend `/auth/login`</span>
                  <a href="/forgot-password" className="font-semibold text-orange-600 hover:text-orange-700">
                    Forgot password?
                  </a>
                </div>
              </form>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300">{text}</p>
    </div>
  );
}