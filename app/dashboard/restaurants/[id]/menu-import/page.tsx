"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCopy, FileJson2, Loader2, Store, Upload } from "lucide-react";
import { getStoredAuthSession } from "@/lib/auth";
import { getRestaurant, importRestaurantMenu, type BackendRestaurant, type MenuImportPayload, type MenuImportResult } from "@/lib/backend-api";

const example = `{"version":1,"categories":[{"name":"Breakfast","type":"kitchen"}],"modifier_groups":[],"items":[{"name":"Aloo paratha","price":180,"category":"Breakfast","modifier_groups":[]}]}`;
const prompt = `Read the attached restaurant menu photos and return one valid JSON object only. Do not use Markdown, code fences, explanations, comments, or text before/after the JSON.

Use this exact top-level shape:
{
  "version": 1,
  "categories": [],
  "modifier_groups": [],
  "items": []
}

Categories
- Every category requires: "name" and "type".
- "type" must be exactly one of: "kitchen", "bar", "cafe".
- Use kitchen for food, cafe for tea/coffee and similar hot drinks, and bar for alcohol, cold drinks, tobacco, or hookah when appropriate.
- Keep category names as printed on the menu where practical. Do not duplicate a category.

Items
- Every item requires: "name", "price", "category", and "modifier_groups".
- "price" must be one non-negative number only, without Rs., commas, or text. Example: 395.
- "category" must exactly match a category name declared in "categories".
- "description" is optional; include it only when useful text is explicitly printed with the item.
- "modifier_groups" must always be an array. Use [] when the item has no choices.
- Do not invent dishes, prices, descriptions, options, or modifiers. Do not include images, IDs, stock, tax, or fields not listed here.
- When one printed line clearly contains separately priced variants, create separate items with clear names, for example "NHR Khaja Set (Veg)" and "NHR Khaja Set (Non-Veg)".

Modifier groups and modifier items
- A modifier group is an optional ordering choice attached to an item. It is not a category or separate dish.
- Create a modifier group only when the menu explicitly offers a choice: size, toppings, add-ons, spice level, flavour, with/without, cooking style, or a configurable base item.
- A group requires: "name", "required", "min_selections", "max_selections", and "options".
- Each option requires: "name", "price_adjustment", and "is_default".
- "price_adjustment" is the amount added/subtracted from the base item price; use 0 when an option does not change price.
- "required" is true only if the customer must choose. "min_selections" is the minimum allowed; "max_selections" is the maximum allowed or null when unlimited.
- An item can reference one or more modifier-group names in its "modifier_groups" array. Names must exactly match groups declared in "modifier_groups".
- Do not create modifiers for ordinary separately priced dishes, even if they are similar. If the menu shows no explicit choices, return "modifier_groups": [] and use [] for every item.

Example 1 — plain menu, no modifiers:
{"version":1,"categories":[{"name":"Breakfast","type":"kitchen"}],"modifier_groups":[],"items":[{"name":"Aloo paratha","price":180,"category":"Breakfast","modifier_groups":[]}]}

Example 2 — burger with explicit add-ons:
{"version":1,"categories":[{"name":"Burgers","type":"kitchen"}],"modifier_groups":[{"name":"Burger extras","required":false,"min_selections":0,"max_selections":2,"options":[{"name":"Add cheese","price_adjustment":50,"is_default":false},{"name":"Extra patty","price_adjustment":120,"is_default":false}]}],"items":[{"name":"Chicken Burger","price":395,"category":"Burgers","description":"Served with fries","modifier_groups":["Burger extras"]}]}

Example 3 — required drink size:
{"version":1,"categories":[{"name":"Coffee","type":"cafe"}],"modifier_groups":[{"name":"Coffee size","required":true,"min_selections":1,"max_selections":1,"options":[{"name":"Regular","price_adjustment":0,"is_default":true},{"name":"Large","price_adjustment":60,"is_default":false}]}],"items":[{"name":"Cappuccino","price":220,"category":"Coffee","modifier_groups":["Coffee size"]}]}`;

function ResultSummary({ result }: { result: MenuImportResult }) {
  const created = result.created;
  const preview = result.summary;
  const duplicates = result.skipped_duplicates || result.duplicates || [];
  const imported = Boolean(created);
  const cards = imported
    ? [["Categories added", created?.categories || 0], ["Menu items added", created?.items || 0], ["Modifiers added", (created?.modifier_groups || 0) + (created?.modifiers || 0)]]
    : [["Categories to add", preview?.categories_to_create || 0], ["Menu items to add", preview?.items_to_create || 0], ["Duplicates to skip", preview?.items_to_skip || 0]];
  return <section aria-live="polite" className={`mt-6 rounded-2xl border p-5 ${result.valid === false ? "border-red-200 bg-red-50" : imported ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
    <div className="flex items-start gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 ${result.valid === false ? "text-red-600" : imported ? "text-emerald-600" : "text-orange-600"}`} /><div><h2 className="font-semibold text-slate-950">{result.valid === false ? "Fix this import before continuing" : imported ? "Menu imported successfully" : "Ready to import"}</h2><p className="mt-1 text-sm text-slate-600">{imported ? "The menu cache was cleared automatically. Refresh the restaurant menu to see the new items." : "Review this summary, then choose Import menu to make the changes."}</p></div></div>
    <dl className="mt-5 grid gap-3 sm:grid-cols-3">{cards.map(([label, value]) => <div key={String(label)} className="rounded-xl border border-black/5 bg-white/80 px-4 py-3"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{value}</dd></div>)}</dl>
    {result.errors?.length ? <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-red-700">{result.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
    {duplicates.length ? <div className="mt-4 rounded-xl bg-white/70 p-4"><p className="text-sm font-semibold text-slate-800">Skipped duplicates</p><p className="mt-1 text-sm text-slate-600">Existing items were left unchanged.</p><ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{duplicates.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
  </section>;
}

export default function MenuImportPage() {
  const { id } = useParams<{ id: string }>(); const restaurantId = Number(id);
  const [restaurant, setRestaurant] = useState<BackendRestaurant | null>(null); const [text, setText] = useState(example); const [result, setResult] = useState<MenuImportResult | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { const token = getStoredAuthSession()?.accessToken; if (!Number.isInteger(restaurantId)) return; getRestaurant(restaurantId, { token }).then((response) => setRestaurant(response.data)).catch(() => setError("Could not load the restaurant details.")); }, [restaurantId]);
  const run = async (confirm: boolean) => { try { setBusy(true); setError(null); const response = await importRestaurantMenu(restaurantId, JSON.parse(text) as MenuImportPayload, confirm, { token: getStoredAuthSession()?.accessToken }); setResult(response.data); } catch (value) { setError(value instanceof Error ? value.message : "The import file is not valid JSON."); } finally { setBusy(false); } };
  const loadFile = async (file?: File) => { if (file) setText(await file.text()); };
  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><Link className="rounded text-sm font-semibold text-orange-600 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2" href={`/dashboard/restaurants/${id}`}>← Back to restaurant</Link>
    <header className="mt-6 border-b border-slate-200 pb-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Store className="h-4 w-4 text-orange-600" /> Working in</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{restaurant?.name || "Loading restaurant…"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Bring a structured menu from your AI, check exactly what will change, then import it without SQL or cache commands.</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"><span className="block text-slate-500">Restaurant ID</span><span className="font-semibold text-slate-900">{restaurantId}</span></div></div></header>
    <div className="mt-7 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><ClipboardCopy className="h-5 w-5 text-orange-600" /><h2 className="font-semibold text-slate-950">1. Ask your AI</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">Copy this instruction, attach the restaurant’s menu photos, and ask for JSON only.</p><textarea readOnly value={prompt} className="mt-4 h-64 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200" /><button type="button" onClick={() => navigator.clipboard.writeText(prompt)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"><ClipboardCopy className="h-4 w-4" /> Copy prompt</button></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><FileJson2 className="h-5 w-5 text-orange-600" /><h2 className="font-semibold text-slate-950">2. Review the import file</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">Paste the AI response or choose its JSON file. Existing same-name items in the same category are safely skipped.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2"><Upload className="h-4 w-4" /> Choose file<input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => loadFile(event.target.files?.[0])} /></label></div><textarea aria-label="Menu import JSON" value={text} onChange={(event) => setText(event.target.value)} className="mt-4 h-64 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs leading-5 text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={() => run(false)} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Validate import</button><button disabled={busy || !result?.valid} onClick={() => run(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Import menu</button></div></section></div>
    {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}{result ? <ResultSummary result={result} /> : null}
  </main>;
}
