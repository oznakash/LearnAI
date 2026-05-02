// Per-profile SEO head helper.
//
// `index.html` ships static OG meta for the site as a whole. Open profile
// pages can usefully give crawlers and unfurlers their own title, OG
// description, and a `Person` JSON-LD block.
//
// We *update existing meta tags in place* (matched by their property/name
// selector) and stash their original `content` on a `data-lai-seo-original`
// attribute so unmount can restore them. If a tag doesn't exist we create
// one tagged with `data-lai-seo-created="1"` so unmount can remove it.
// This avoids the duplicate-tag-bug an id-keyed approach would cause:
// unfurlers (Slack, LinkedIn, Twitter) read the *first* matching tag, so
// a "create new" approach would leave the static index.html tags winning.
//
// Closed profiles, "not found", and the closed-gate view never call
// setProfileSeo() — only the resolved Open profile does.
//
// This is the static-SPA approximation. SSR / static prerender lands
// later; modern Googlebot does execute JS, so the meta + JSON-LD do get
// picked up today.

export interface ProfileSeo {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  jsonLd: Record<string, unknown>;
}

const ORIGINAL_ATTR = "data-lai-seo-original";
const CREATED_ATTR = "data-lai-seo-created";
const JSON_LD_ID = "__lai_ld_profile";
const TITLE_BACKUP_ATTR = "data-lai-title-backup";

interface MetaSpec {
  attr: "name" | "property";
  attrValue: string;
}

const META_KEYS: MetaSpec[] = [
  { attr: "name", attrValue: "description" },
  { attr: "property", attrValue: "og:title" },
  { attr: "property", attrValue: "og:description" },
  { attr: "property", attrValue: "og:url" },
  { attr: "property", attrValue: "og:type" },
  { attr: "property", attrValue: "og:image" },
  { attr: "name", attrValue: "twitter:card" },
  { attr: "name", attrValue: "twitter:title" },
  { attr: "name", attrValue: "twitter:description" },
];

function applyMeta(spec: MetaSpec, content: string) {
  if (typeof document === "undefined") return;
  const sel = `meta[${spec.attr}="${spec.attrValue}"]`;
  let el = document.head.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(spec.attr, spec.attrValue);
    el.setAttribute(CREATED_ATTR, "1");
    document.head.appendChild(el);
  } else if (!el.hasAttribute(ORIGINAL_ATTR)) {
    // First touch — remember what was here so we can restore it on unmount.
    el.setAttribute(ORIGINAL_ATTR, el.getAttribute("content") ?? "");
  }
  el.setAttribute("content", content);
}

function restoreMeta(spec: MetaSpec) {
  if (typeof document === "undefined") return;
  const sel = `meta[${spec.attr}="${spec.attrValue}"]`;
  const el = document.head.querySelector(sel) as HTMLMetaElement | null;
  if (!el) return;
  if (el.getAttribute(CREATED_ATTR) === "1") {
    el.remove();
    return;
  }
  if (el.hasAttribute(ORIGINAL_ATTR)) {
    el.setAttribute("content", el.getAttribute(ORIGINAL_ATTR) ?? "");
    el.removeAttribute(ORIGINAL_ATTR);
  }
}

export function setProfileSeo(seo: ProfileSeo) {
  if (typeof document === "undefined") return;
  const head = document.head;
  if (!head.getAttribute(TITLE_BACKUP_ATTR)) {
    head.setAttribute(TITLE_BACKUP_ATTR, document.title);
  }
  document.title = seo.title;
  applyMeta({ attr: "name", attrValue: "description" }, seo.description);
  applyMeta({ attr: "property", attrValue: "og:title" }, seo.title);
  applyMeta({ attr: "property", attrValue: "og:description" }, seo.description);
  applyMeta({ attr: "property", attrValue: "og:url" }, seo.url);
  applyMeta({ attr: "property", attrValue: "og:type" }, "profile");
  applyMeta({ attr: "name", attrValue: "twitter:card" }, "summary_large_image");
  applyMeta({ attr: "name", attrValue: "twitter:title" }, seo.title);
  applyMeta({ attr: "name", attrValue: "twitter:description" }, seo.description);
  if (seo.imageUrl) {
    applyMeta({ attr: "property", attrValue: "og:image" }, seo.imageUrl);
  }

  let script = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = JSON_LD_ID;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(seo.jsonLd);
}

export function clearProfileSeo() {
  if (typeof document === "undefined") return;
  const head = document.head;
  const original = head.getAttribute(TITLE_BACKUP_ATTR);
  if (original) {
    document.title = original;
    head.removeAttribute(TITLE_BACKUP_ATTR);
  }
  for (const spec of META_KEYS) restoreMeta(spec);
  document.getElementById(JSON_LD_ID)?.remove();
}

export interface PersonJsonLdArgs {
  name: string;
  handle: string;
  url: string;
  imageUrl?: string;
  description?: string;
  // Forward-compat slot for when external links land on the profile.
  // Kept here so callers can pass an empty array today and we won't
  // emit a `sameAs` key, which is the schema.org-correct shape.
  sameAs?: string[];
}

export function buildPersonJsonLd(args: PersonJsonLdArgs): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: args.name,
    alternateName: args.handle,
    url: args.url,
  };
  if (args.description) ld.description = args.description;
  if (args.imageUrl) ld.image = args.imageUrl;
  if (args.sameAs && args.sameAs.length > 0) ld.sameAs = args.sameAs;
  return ld;
}
