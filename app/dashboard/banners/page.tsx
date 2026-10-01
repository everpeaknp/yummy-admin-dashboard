"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createDashboardPromoBanner,
  deleteDashboardPromoBanner,
  getDashboardPromoBanners,
  reorderDashboardPromoBanners,
  replaceDashboardPromoBannerImage,
  updateDashboardPromoBanner,
  type DashboardPromoBanner,
} from "@/lib/backend-api";
import { canManageRestaurants, getStoredAuthSession } from "@/lib/auth";

type UploadDraft = {
  mobileFile: File | null;
  desktopFile: File | null;
  altText: string;
  actionType: BannerActionType;
  actionValue: string;
  openInNewTab: boolean;
};

type BannerActionType = "none" | "external_url" | "internal_path";

type ActionDraft = {
  actionType: BannerActionType;
  actionValue: string;
  openInNewTab: boolean;
};

const emptyDraft: UploadDraft = {
  mobileFile: null,
  desktopFile: null,
  altText: "",
  actionType: "none",
  actionValue: "",
  openInNewTab: false,
};

function actionDraftFor(banner: DashboardPromoBanner): ActionDraft {
  return {
    actionType: banner.action_type || "none",
    actionValue: banner.action_value || "",
    openInNewTab: Boolean(banner.open_in_new_tab),
  };
}

function actionValidation(action: ActionDraft): string | null {
  if (action.actionType === "none") return null;
  const value = action.actionValue.trim();
  if (!value) return "Choose where this banner should open.";
  if (action.actionType === "external_url") {
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") return null;
    } catch {
      // The message below tells the user how to correct an incomplete URL.
    }
    return "Use a full website address beginning with https://.";
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "Use a Yummy path beginning with one slash, for example /finance/reports.";
  }
  return null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function imageInputLabel(file: File | null, label: string) {
  return file ? file.name : label;
}

export default function DashboardBannersPage() {
  const [banners, setBanners] = useState<DashboardPromoBanner[]>([]);
  const [draft, setDraft] = useState<UploadDraft>(emptyDraft);
  const [altEdits, setAltEdits] = useState<Record<number, string>>({});
  const [actionEdits, setActionEdits] = useState<Record<number, ActionDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const token = () => window.localStorage.getItem("accessToken") || undefined;

  const loadBanners = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getDashboardPromoBanners({ token: token() });
      const next = [...(response.data || [])].sort(
        (left, right) => left.sort_order - right.sort_order || left.id - right.id,
      );
      setBanners(next);
      setAltEdits(Object.fromEntries(next.map((banner) => [banner.id, banner.alt_text])));
      setActionEdits(Object.fromEntries(next.map((banner) => [banner.id, actionDraftFor(banner)])));
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError, "Could not load dashboard banners."));
      setBanners([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setCanManage(canManageRestaurants(getStoredAuthSession()));
    void loadBanners();
  }, [loadBanners]);

  const chooseUpload = (
    field: "mobileFile" | "desktopFile",
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const [file] = Array.from(event.target.files || []);
    setDraft((current) => ({ ...current, [field]: file || null }));
  };

  const createBanner = async () => {
    if (!draft.mobileFile || !draft.desktopFile) {
      setError("Choose both a mobile and desktop image before publishing a banner.");
      return;
    }
    const invalidAction = actionValidation(draft);
    if (invalidAction) {
      setError(invalidAction);
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const response = await createDashboardPromoBanner(
        {
          mobileFile: draft.mobileFile,
          desktopFile: draft.desktopFile,
          altText: draft.altText.trim(),
          actionType: draft.actionType,
          actionValue: draft.actionValue.trim() || null,
          openInNewTab: draft.openInNewTab,
        },
        { token: token() },
      );
      setBanners((current) => [...current, response.data]);
      setAltEdits((current) => ({ ...current, [response.data.id]: response.data.alt_text }));
      setActionEdits((current) => ({ ...current, [response.data.id]: actionDraftFor(response.data) }));
      setDraft(emptyDraft);
      setNotice("Banner published to the dashboard.");
    } catch (createError) {
      setError(errorMessage(createError, "Could not publish this banner."));
    } finally {
      setIsCreating(false);
    }
  };

  const updateBanner = async (
    bannerId: number,
    patch: Partial<Pick<DashboardPromoBanner, "alt_text" | "is_active" | "action_type" | "action_value" | "open_in_new_tab">>,
    key: string,
  ) => {
    setBusyKey(key);
    setError(null);
    try {
      const response = await updateDashboardPromoBanner(bannerId, patch, { token: token() });
      setBanners((current) =>
        current.map((banner) => (banner.id === bannerId ? response.data : banner)),
      );
      setAltEdits((current) => ({ ...current, [bannerId]: response.data.alt_text }));
      setActionEdits((current) => ({ ...current, [bannerId]: actionDraftFor(response.data) }));
      setNotice("Banner saved.");
    } catch (updateError) {
      setError(errorMessage(updateError, "Could not save this banner."));
    } finally {
      setBusyKey(null);
    }
  };

  const replaceImage = async (
    bannerId: number,
    variant: "mobile" | "desktop",
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    if (!file) return;

    const key = `replace-${variant}-${bannerId}`;
    setBusyKey(key);
    setError(null);
    try {
      const response = await replaceDashboardPromoBannerImage(
        bannerId,
        variant,
        file,
        { token: token() },
      );
      setBanners((current) =>
        current.map((banner) => (banner.id === bannerId ? response.data : banner)),
      );
      setNotice(`${variant === "mobile" ? "Mobile" : "Desktop"} artwork replaced.`);
    } catch (replaceError) {
      setError(errorMessage(replaceError, "Could not replace this image."));
    } finally {
      setBusyKey(null);
    }
  };

  const moveBanner = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const reordered = [...banners];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setBusyKey(`move-${banners[index].id}`);
    setError(null);
    try {
      const response = await reorderDashboardPromoBanners(
        reordered.map((banner) => banner.id),
        { token: token() },
      );
      setBanners(
        [...response.data].sort(
          (left, right) => left.sort_order - right.sort_order || left.id - right.id,
        ),
      );
      setNotice("Banner order updated.");
    } catch (moveError) {
      setError(errorMessage(moveError, "Could not change banner order."));
    } finally {
      setBusyKey(null);
    }
  };

  const removeBanner = async (banner: DashboardPromoBanner) => {
    if (!window.confirm(`Remove this dashboard banner? This cannot be undone.`)) return;

    setBusyKey(`delete-${banner.id}`);
    setError(null);
    try {
      await deleteDashboardPromoBanner(banner.id, { token: token() });
      setBanners((current) => current.filter((item) => item.id !== banner.id));
      setNotice("Banner removed from the dashboard.");
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Could not remove this banner."));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
              <ImagePlus size={20} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard banners</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Manage the promotions shown in every restaurant workspace. Active banners appear in this order on both mobile and desktop dashboards.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadBanners()}
            disabled={isLoading || busyKey !== null}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        {!canManage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
            You can view banners, but only platform staff with restaurant-management access can change them.
          </div>
        )}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100">{error}</div>}
        {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">{notice}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-6">
            <h2 className="text-lg font-bold">Publish a banner</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Upload tailored artwork for each screen size. JPG, PNG, and WebP files up to 8 MB are supported.</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <label className="group flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-orange-400 hover:bg-orange-50/40 dark:border-slate-700 dark:bg-slate-950/30 dark:hover:border-orange-500/70 dark:hover:bg-orange-500/5">
              <span className="flex items-center gap-2 text-sm font-semibold"><Smartphone size={16} className="text-orange-500" />Mobile artwork</span>
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">{imageInputLabel(draft.mobileFile, "Choose a compact landscape image")}</span>
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canManage || isCreating} onChange={(event) => chooseUpload("mobileFile", event)} />
            </label>
            <label className="group flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-orange-400 hover:bg-orange-50/40 dark:border-slate-700 dark:bg-slate-950/30 dark:hover:border-orange-500/70 dark:hover:bg-orange-500/5">
              <span className="flex items-center gap-2 text-sm font-semibold"><Monitor size={16} className="text-orange-500" />Desktop artwork</span>
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">{imageInputLabel(draft.desktopFile, "Choose a wide landscape image")}</span>
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canManage || isCreating} onChange={(event) => chooseUpload("desktopFile", event)} />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Image description</span>
              <input value={draft.altText} maxLength={200} disabled={!canManage || isCreating} onChange={(event) => setDraft((current) => ({ ...current, altText: event.target.value }))} placeholder="Describe the promotion for screen readers" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800" />
            </label>
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-950/40">
              <label><span className="mb-2 block text-sm font-semibold">When the banner is clicked</span><select value={draft.actionType} disabled={!canManage || isCreating} onChange={(event) => setDraft((current) => ({ ...current, actionType: event.target.value as BannerActionType, actionValue: event.target.value === "none" ? "" : current.actionValue, openInNewTab: event.target.value === "external_url" ? current.openInNewTab : false }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"><option value="none">Do nothing</option><option value="external_url">Open an external website</option><option value="internal_path">Open a Yummy screen</option></select></label>
              {draft.actionType !== "none" && <label><span className="mb-2 block text-sm font-semibold">{draft.actionType === "external_url" ? "Website address" : "Yummy path"}</span><input value={draft.actionValue} disabled={!canManage || isCreating} onChange={(event) => setDraft((current) => ({ ...current, actionValue: event.target.value }))} placeholder={draft.actionType === "external_url" ? "https://example.com/promotion" : "/finance/reports"} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800" /></label>}
              {draft.actionType === "external_url" && <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={draft.openInNewTab} disabled={!canManage || isCreating} onChange={(event) => setDraft((current) => ({ ...current, openInNewTab: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />Open website in a new tab</label>}
              {draft.actionType !== "none" && <p className="text-xs leading-5 text-slate-500 sm:col-span-2">{draft.actionType === "external_url" ? "Use a complete address, such as https://example.com/offer." : "Use the path after your Yummy domain, such as /finance/reports."}</p>}
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="button" onClick={() => void createBanner()} disabled={!canManage || isCreating} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgba(249,115,22,0.9)] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                {isCreating ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} />} {isCreating ? "Publishing…" : "Publish banner"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between px-1">
            <div><h2 className="text-lg font-bold">Live banner queue</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Move a banner to choose its carousel position, or turn it off without deleting it.</p></div>
            <span className="text-sm font-semibold text-slate-500">{banners.length} total</span>
          </div>

          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"><LoaderCircle size={18} className="mr-2 animate-spin" /> Loading banners</div>
          ) : banners.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900"><ImagePlus className="mx-auto mb-3 text-slate-400" size={28} /><h3 className="font-bold">No banners are published</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">Upload the first campaign above. Until one is published, restaurant dashboards simply do not show a promotion slot.</p></div>
          ) : banners.map((banner, index) => {
            const busy = busyKey !== null;
            const editValue = altEdits[banner.id] ?? banner.alt_text;
            const altChanged = editValue !== banner.alt_text;
            const actionEdit = actionEdits[banner.id] ?? actionDraftFor(banner);
            const actionChanged = actionEdit.actionType !== banner.action_type || actionEdit.actionValue !== (banner.action_value || "") || actionEdit.openInNewTab !== Boolean(banner.open_in_new_tab);
            return (
              <article key={banner.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{index + 1}</span><div><h3 className="font-bold">Banner {banner.id}</h3><p className="text-sm text-slate-500">{banner.is_active ? "Shown on dashboards" : "Saved but hidden"}</p></div></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={!canManage || busy || index === 0} onClick={() => void moveBanner(index, -1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Move banner earlier"><ChevronUp size={17} /></button>
                    <button type="button" disabled={!canManage || busy || index === banners.length - 1} onClick={() => void moveBanner(index, 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Move banner later"><ChevronDown size={17} /></button>
                    <button type="button" disabled={!canManage || busy} onClick={() => void updateBanner(banner.id, { is_active: !banner.is_active }, `visibility-${banner.id}`)} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${banner.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}>{banner.is_active ? <Eye size={16} /> : <EyeOff size={16} />}{banner.is_active ? "Visible" : "Hidden"}</button>
                    <button type="button" disabled={!canManage || busy} onClick={() => void removeBanner(banner)} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-500/10"><Trash2 size={16} />Remove</button>
                  </div>
                </div>
                <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)] lg:p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(["mobile", "desktop"] as const).map((variant) => {
                      const source = variant === "mobile" ? banner.mobile_image_url : banner.desktop_image_url;
                      const replacing = busyKey === `replace-${variant}-${banner.id}`;
                      return <div key={variant} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40"><div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{variant === "mobile" ? <Smartphone size={14} /> : <Monitor size={14} />}{variant === "mobile" ? "Mobile" : "Desktop"}</div><div className="relative aspect-[2.6/1] bg-slate-100 dark:bg-slate-800"><img src={source} alt={banner.alt_text || "Dashboard promotion"} className="h-full w-full object-contain" /></div><label className="flex cursor-pointer items-center justify-center gap-2 px-3 py-3 text-sm font-semibold text-orange-600 transition hover:bg-orange-50 disabled:cursor-not-allowed dark:text-orange-300 dark:hover:bg-orange-500/10"><Upload size={15} />{replacing ? "Replacing…" : "Replace image"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canManage || busy} onChange={(event) => void replaceImage(banner.id, variant, event)} /></label></div>;
                    })}
                  </div>
                  <div className="flex flex-col justify-between gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/40">
                    <label><span className="mb-2 block text-sm font-semibold">Image description</span><textarea value={editValue} maxLength={200} disabled={!canManage || busy} onChange={(event) => setAltEdits((current) => ({ ...current, [banner.id]: event.target.value }))} className="min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800" placeholder="Describe this promotion" /></label>
                    <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{editValue.length}/200 characters</span><button type="button" disabled={!canManage || busy || !altChanged} onClick={() => void updateBanner(banner.id, { alt_text: editValue.trim() }, `alt-${banner.id}`)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"><Save size={15} />Save description</button></div>
                    <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ExternalLink size={15} className="text-orange-500" />Click action</div>
                      <select value={actionEdit.actionType} disabled={!canManage || busy} onChange={(event) => setActionEdits((current) => ({ ...current, [banner.id]: { ...actionEdit, actionType: event.target.value as BannerActionType, actionValue: event.target.value === "none" ? "" : actionEdit.actionValue, openInNewTab: event.target.value === "external_url" ? actionEdit.openInNewTab : false } }))} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"><option value="none">Do nothing</option><option value="external_url">Open an external website</option><option value="internal_path">Open a Yummy screen</option></select>
                      {actionEdit.actionType !== "none" && <input value={actionEdit.actionValue} disabled={!canManage || busy} onChange={(event) => setActionEdits((current) => ({ ...current, [banner.id]: { ...actionEdit, actionValue: event.target.value } }))} placeholder={actionEdit.actionType === "external_url" ? "https://example.com/promotion" : "/finance/reports"} className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800" />}
                      {actionEdit.actionType === "external_url" && <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"><input type="checkbox" checked={actionEdit.openInNewTab} disabled={!canManage || busy} onChange={(event) => setActionEdits((current) => ({ ...current, [banner.id]: { ...actionEdit, openInNewTab: event.target.checked } }))} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />Open in a new tab</label>}
                      {actionEdit.actionType !== "none" && <p className="mt-2 text-xs leading-5 text-slate-500">{actionEdit.actionType === "external_url" ? "Use a complete https:// address." : "Use a Yummy path such as /finance/reports."}</p>}
                      <div className="mt-3 flex justify-end"><button type="button" disabled={!canManage || busy || !actionChanged} onClick={() => { const invalidAction = actionValidation(actionEdit); if (invalidAction) { setError(invalidAction); return; } void updateBanner(banner.id, { action_type: actionEdit.actionType, action_value: actionEdit.actionValue.trim() || null, open_in_new_tab: actionEdit.openInNewTab }, `action-${banner.id}`); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"><Save size={15} />Save action</button></div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
