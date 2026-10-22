"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  BookOpenCheck,
  Film,
  Headphones,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  createHelpGuide,
  createTutorialVideo,
  deleteHelpGuide,
  deleteTutorialVideo,
  getHelpCenter,
  updateHelpCenterSettings,
  updateHelpGuide,
  updateTutorialVideo,
  type HelpCenter,
  type HelpGuide,
  type HelpGuidePayload,
  type TutorialVideo,
  type TutorialVideoPayload,
} from "@/lib/backend-api";
import { canManageRestaurants, getStoredAuthSession } from "@/lib/auth";
import { getTutorialVideoThumbnailUrl, getYouTubeThumbnailUrl } from "@/lib/tutorial-video-utils";

type Tab = "guides" | "videos" | "support";

const blankGuide: HelpGuidePayload = {
  slug: "",
  title: "",
  summary: "",
  category: "Getting started",
  icon: "book-open",
  sections: [{ title: "", body: "", bullets: [] }],
  estimated_minutes: 3,
  sort_order: 0,
  is_featured: false,
  is_published: true,
};

const blankVideo: TutorialVideoPayload = {
  title: "",
  description: "",
  youtube_url: "",
  thumbnail_url: "",
  is_main: false,
  category: "Getting started",
  duration_minutes: null,
  sort_order: 0,
  is_published: true,
};

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const field = "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800";
const area = `${field} min-h-24 py-3`;

export default function HelpCenterAdminPage() {
  const [tab, setTab] = useState<Tab>("guides");
  const [data, setData] = useState<HelpCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [guideDraft, setGuideDraft] = useState<HelpGuidePayload | null>(null);
  const [guideId, setGuideId] = useState<number | null>(null);
  const [videoDraft, setVideoDraft] = useState<TutorialVideoPayload | null>(null);
  const [videoId, setVideoId] = useState<number | null>(null);
  const canManage = canManageRestaurants(getStoredAuthSession());
  const auth = () => ({ token: window.localStorage.getItem("accessToken") || undefined });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getHelpCenter(auth());
      setData(response.data);
      setError(null);
    } catch (loadError) {
      setError(message(loadError, "Could not load help-center content."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (actionError) {
      setError(message(actionError, "The change could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const editGuide = (guide?: HelpGuide) => {
    setGuideId(guide?.id ?? null);
    setGuideDraft(guide ? { ...guide, sections: guide.sections.map((section) => ({ ...section, bullets: [...section.bullets] })) } : { ...blankGuide, sections: [{ title: "", body: "", bullets: [] }] });
  };

  const saveGuide = () => {
    if (!guideDraft || !guideDraft.title.trim() || !guideDraft.slug.trim()) {
      setError("A guide needs a title and URL slug.");
      return;
    }
    void run(async () => {
      if (guideId == null) await createHelpGuide(guideDraft, auth());
      else await updateHelpGuide(guideId, guideDraft, auth());
      setGuideDraft(null);
      setGuideId(null);
      await load();
    }, guideId == null ? "Guide published." : "Guide updated.");
  };

  const editVideo = (video?: TutorialVideo) => {
    setVideoId(video?.id ?? null);
    setVideoDraft(video ? { ...video } : { ...blankVideo });
  };

  const saveVideo = () => {
    if (!videoDraft || !videoDraft.title.trim() || !videoDraft.youtube_url.trim()) {
      setError("A tutorial needs a title and video URL.");
      return;
    }
    void run(async () => {
      if (videoId == null) await createTutorialVideo(videoDraft, auth());
      else await updateTutorialVideo(videoId, videoDraft, auth());
      setVideoDraft(null);
      setVideoId(null);
      await load();
    }, videoId == null ? "Video tutorial published." : "Video tutorial updated.");
  };

  const removeGuide = (guide: HelpGuide) => {
    if (!window.confirm(`Delete “${guide.title}”?`)) return;
    void run(async () => {
      await deleteHelpGuide(guide.id, auth());
      await load();
    }, "Guide deleted.");
  };

  const removeVideo = (video: TutorialVideo) => {
    if (!window.confirm(`Delete “${video.title}”?`)) return;
    void run(async () => {
      await deleteTutorialVideo(video.id, auth());
      await load();
    }, "Video tutorial deleted.");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"><BookOpenCheck size={20} /></div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Guides & tutorials</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">Publish the help content and support channels shown inside every Yummy workspace.</p>
          </div>
          <button onClick={() => void load()} disabled={loading || busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Refresh</button>
        </header>

        {!canManage && <Notice tone="warning">You can view this content, but restaurant-management access is required to change it.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}

        <nav className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" aria-label="Help center sections">
          <TabButton active={tab === "guides"} onClick={() => setTab("guides")} icon={<BookOpenCheck size={17} />} label={`Guides (${data?.guides.length ?? 0})`} />
          <TabButton active={tab === "videos"} onClick={() => setTab("videos")} icon={<Film size={17} />} label={`Videos (${data?.videos.length ?? 0})`} />
          <TabButton active={tab === "support"} onClick={() => setTab("support")} icon={<Headphones size={17} />} label="Support" />
        </nav>

        {loading ? <Loading /> : !data ? null : tab === "guides" ? (
          <ContentList title="Step-by-step guides" description="Use short sections and practical bullets. Published guides appear immediately in the app." onAdd={() => editGuide()} disabled={!canManage || busy}>
            {data.guides.map((guide) => <ContentRow key={guide.id} title={guide.title} subtitle={`${guide.category} · ${guide.estimated_minutes ?? "—"} min`} published={guide.is_published} featured={guide.is_featured} onEdit={() => editGuide(guide)} onDelete={() => removeGuide(guide)} />)}
          </ContentList>
        ) : tab === "videos" ? (
          <ContentList title="Video tutorials" description="Add a YouTube link or a direct video URL. YouTube thumbnails are generated automatically; other video links can use a custom thumbnail." onAdd={() => editVideo()} disabled={!canManage || busy}>
            {data.videos.map((video) => <ContentRow key={video.id} title={video.title} subtitle={`${video.category} · ${video.duration_minutes ?? "—"} min`} published={video.is_published} featured={video.is_main} onEdit={() => editVideo(video)} onDelete={() => removeVideo(video)} />)}
          </ContentList>
        ) : <SupportEditor data={data} disabled={!canManage || busy} onChange={setData} onSave={() => void run(async () => {
          const response = await updateHelpCenterSettings(data.settings, auth());
          setData({ ...data, settings: response.data });
        }, "Support settings updated.")} />}
      </div>

      {guideDraft && <Editor title={guideId == null ? "New guide" : "Edit guide"} onClose={() => setGuideDraft(null)} onSave={saveGuide} busy={busy} disabled={!canManage}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" value={guideDraft.title} onChange={(title) => setGuideDraft({ ...guideDraft, title })} />
          <Input label="URL slug" value={guideDraft.slug} onChange={(slug) => setGuideDraft({ ...guideDraft, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
          <Input label="Category" value={guideDraft.category} onChange={(category) => setGuideDraft({ ...guideDraft, category })} />
          <Input label="Reading time (minutes)" type="number" value={String(guideDraft.estimated_minutes ?? "")} onChange={(value) => setGuideDraft({ ...guideDraft, estimated_minutes: value ? Number(value) : null })} />
          <Input label="Icon key" value={guideDraft.icon} onChange={(icon) => setGuideDraft({ ...guideDraft, icon })} />
          <Input label="Display order" type="number" value={String(guideDraft.sort_order)} onChange={(value) => setGuideDraft({ ...guideDraft, sort_order: Number(value) || 0 })} />
        </div>
        <Input label="Short summary" multiline value={guideDraft.summary} onChange={(summary) => setGuideDraft({ ...guideDraft, summary })} />
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Guide sections</h3><button type="button" onClick={() => setGuideDraft({ ...guideDraft, sections: [...guideDraft.sections, { title: "", body: "", bullets: [] }] })} className="text-sm font-semibold text-orange-600">+ Add section</button></div>
          {guideDraft.sections.map((section, index) => <div key={index} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex gap-2"><input className={field} placeholder={`Section ${index + 1} title`} value={section.title} onChange={(event) => { const sections = [...guideDraft.sections]; sections[index] = { ...section, title: event.target.value }; setGuideDraft({ ...guideDraft, sections }); }} /><button type="button" aria-label="Remove section" onClick={() => setGuideDraft({ ...guideDraft, sections: guideDraft.sections.filter((_, itemIndex) => itemIndex !== index) })} className="h-11 w-11 shrink-0 rounded-xl text-red-500 hover:bg-red-50"><X size={18} className="mx-auto" /></button></div>
            <textarea className={area} placeholder="Explain this step in plain language" value={section.body} onChange={(event) => { const sections = [...guideDraft.sections]; sections[index] = { ...section, body: event.target.value }; setGuideDraft({ ...guideDraft, sections }); }} />
            <textarea className={area} placeholder="Tips or actions, one per line" value={section.bullets.join("\n")} onChange={(event) => { const sections = [...guideDraft.sections]; sections[index] = { ...section, bullets: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) }; setGuideDraft({ ...guideDraft, sections }); }} />
          </div>)}
        </div>
        <Options published={guideDraft.is_published} featured={guideDraft.is_featured} featuredLabel="Feature this guide" onPublished={(is_published) => setGuideDraft({ ...guideDraft, is_published })} onFeatured={(is_featured) => setGuideDraft({ ...guideDraft, is_featured })} />
      </Editor>}

      {videoDraft && <Editor title={videoId == null ? "New video tutorial" : "Edit video tutorial"} onClose={() => setVideoDraft(null)} onSave={saveVideo} busy={busy} disabled={!canManage}>
        <Input label="Title" value={videoDraft.title} onChange={(title) => setVideoDraft({ ...videoDraft, title })} />
        <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
          <Input label="Video URL" type="url" placeholder="https://…" value={videoDraft.youtube_url} onChange={(youtube_url) => setVideoDraft({ ...videoDraft, youtube_url })} />
          <VideoThumbnailEditor videoUrl={videoDraft.youtube_url} thumbnailUrl={videoDraft.thumbnail_url ?? ""} onThumbnailUrlChange={(thumbnail_url) => setVideoDraft({ ...videoDraft, thumbnail_url })} />
        </div>
        <Input label="Description" multiline value={videoDraft.description ?? ""} onChange={(description) => setVideoDraft({ ...videoDraft, description })} />
        <div className="grid gap-4 sm:grid-cols-3"><Input label="Category" value={videoDraft.category} onChange={(category) => setVideoDraft({ ...videoDraft, category })} /><Input label="Duration (minutes)" type="number" value={String(videoDraft.duration_minutes ?? "")} onChange={(value) => setVideoDraft({ ...videoDraft, duration_minutes: value ? Number(value) : null })} /><Input label="Display order" type="number" value={String(videoDraft.sort_order)} onChange={(value) => setVideoDraft({ ...videoDraft, sort_order: Number(value) || 0 })} /></div>
        <Options published={videoDraft.is_published} featured={videoDraft.is_main} featuredLabel="Main dashboard video" onPublished={(is_published) => setVideoDraft({ ...videoDraft, is_published })} onFeatured={(is_main) => setVideoDraft({ ...videoDraft, is_main })} />
      </Editor>}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${active ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{icon}<span className="hidden sm:inline">{label}</span></button>;
}

function Notice({ tone, children }: { tone: "warning" | "error" | "success"; children: React.ReactNode }) {
  const styles = { warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100", error: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100", success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100" };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

function Loading() { return <div className="flex min-h-44 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"><LoaderCircle size={18} className="mr-2 animate-spin" />Loading help center</div>; }

function ContentList({ title, description, onAdd, disabled, children }: { title: string; description: string; onAdd: () => void; disabled: boolean; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800"><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><button disabled={disabled} onClick={onAdd} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />Add</button></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div></section>;
}

function ContentRow({ title, subtitle, published, featured, onEdit, onDelete }: { title: string; subtitle: string; published: boolean; featured: boolean; onEdit: () => void; onDelete: () => void }) {
  return <div className="flex items-center gap-4 p-4 sm:px-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{title}</h3>{featured && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Featured</span>}<span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${published ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{published ? "Published" : "Hidden"}</span></div><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button onClick={onEdit} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">Edit</button><button onClick={onDelete} aria-label={`Delete ${title}`} className="h-10 w-10 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={17} className="mx-auto" /></button></div>;
}

function Input({ label, value, onChange, type = "text", multiline = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; multiline?: boolean; placeholder?: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span>{multiline ? <textarea className={area} value={value} onChange={(event) => onChange(event.target.value)} /> : <input className={field} type={type} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function VideoThumbnailEditor({ videoUrl, thumbnailUrl, onThumbnailUrlChange }: { videoUrl: string; thumbnailUrl: string; onThumbnailUrlChange: (value: string) => void }) {
  const previewUrl = getTutorialVideoThumbnailUrl(videoUrl, thumbnailUrl);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageAvailable = Boolean(previewUrl) && failedUrl !== previewUrl;
  const isAutomatic = Boolean(!thumbnailUrl.trim() && getYouTubeThumbnailUrl(videoUrl));

  return <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Video thumbnail">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold">Thumbnail</h3><p className="mt-1 text-xs leading-5 text-slate-500">{isAutomatic ? "Preview generated from the YouTube link." : "Add an image URL to show a thumbnail for this video."}</p></div>
      {previewUrl && imageAvailable && <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{isAutomatic ? "YouTube" : "Custom"}</span>}
    </div>
    <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
      {imageAvailable && previewUrl ? <Image src={previewUrl} alt="Video thumbnail preview" fill unoptimized sizes="(max-width: 640px) 100vw, 360px" className="object-cover" onError={() => setFailedUrl(previewUrl)} /> : <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-slate-500"><Film size={25} /><p className="text-xs">{videoUrl.trim() ? "Thumbnail preview unavailable" : "Add a video link to preview its thumbnail"}</p></div>}
    </div>
    <Input label="Custom thumbnail image URL (optional)" type="url" placeholder="https://…/thumbnail.jpg" value={thumbnailUrl} onChange={(value) => { setFailedUrl(null); onThumbnailUrlChange(value); }} />
  </section>;
}

function Options({ published, featured, featuredLabel, onPublished, onFeatured }: { published: boolean; featured: boolean; featuredLabel: string; onPublished: (value: boolean) => void; onFeatured: (value: boolean) => void }) {
  return <div className="flex flex-wrap gap-5 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950"><label className="flex items-center gap-2"><input type="checkbox" checked={published} onChange={(event) => onPublished(event.target.checked)} />Published</label><label className="flex items-center gap-2"><input type="checkbox" checked={featured} onChange={(event) => onFeatured(event.target.checked)} />{featuredLabel}</label></div>;
}

function Editor({ title, onClose, onSave, busy, disabled, children }: { title: string; onClose: () => void; onSave: () => void; busy: boolean; disabled: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true"><div className="mx-auto my-6 max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="Close editor" className="h-10 w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={19} className="mx-auto" /></button></div><div className="space-y-5 p-5">{children}</div><div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800"><button onClick={onClose} className="h-10 rounded-xl px-4 text-sm font-semibold">Cancel</button><button onClick={onSave} disabled={busy || disabled} className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}Save</button></div></div></div>;
}

function SupportEditor({ data, disabled, onChange, onSave }: { data: HelpCenter; disabled: boolean; onChange: (value: HelpCenter) => void; onSave: () => void }) {
  const settings = data.settings;
  const set = (patch: Partial<typeof settings>) => onChange({ ...data, settings: { ...settings, ...patch } });
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="mb-6"><h2 className="font-bold">Customer support</h2><p className="mt-1 text-sm text-slate-500">Only configured channels appear in the app. Leave a channel blank to hide it.</p></div><div className="space-y-5"><Input label="Help center heading" value={settings.heading} onChange={(heading) => set({ heading })} /><Input label="Introduction" multiline value={settings.subheading} onChange={(subheading) => set({ subheading })} /><Input label="Support message" value={settings.support_message} onChange={(support_message) => set({ support_message })} /><div className="grid gap-4 sm:grid-cols-2"><Input label="WhatsApp number" value={settings.whatsapp_number ?? ""} onChange={(whatsapp_number) => set({ whatsapp_number })} /><Input label="Phone number" value={settings.phone_number ?? ""} onChange={(phone_number) => set({ phone_number })} /><Input label="Support email" value={settings.email ?? ""} onChange={(email) => set({ email })} /><Input label="Support hours" value={settings.support_hours ?? ""} onChange={(support_hours) => set({ support_hours })} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.feedback_enabled} onChange={(event) => set({ feedback_enabled: event.target.checked })} />Show the in-app feedback option</label><div className="flex justify-end"><button disabled={disabled} onClick={onSave} className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />Save support settings</button></div></div></section>;
}
