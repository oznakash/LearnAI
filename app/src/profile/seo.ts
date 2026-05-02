// Per-profile SEO head helper.
//
// `index.html` ships static OG meta for the site as a whole. Open profile
// pages can usefully give crawlers and unfurlers their own title, OG
// description, and a `Person` JSON-LD block. We mutate the head from
// `Profile.tsx` on mount and revert on unmount so internal navigation
// doesn't leak per-profile meta.
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

const META_IDS = [
  "__lai_meta_desc",
  "__lai_og_title",
  "__lai_og_desc",
  "__lai_og_url",
  "__lai_og_image",
  "__lai_og_type",
  "__lai_tw_card",
  "__lai_tw_title",
  "__lai_tw_desc",
] as const;
const JSON_LD_ID = "__lai_ld_profile";
const TITLE_BACKUP_ATTR = "data-lai-title-backup";

function setMeta(id: string, attr: "name" | "property", attrValue: string, content: string) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(id) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.id = id;
    el.setAttribute(attr, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function setProfileSeo(seo: ProfileSeo) {
  if (typeof document === "undefined") return;
  // Stash the original <title> exactly once so clearProfileSeo can restore
  // it. Multiple Profile mounts in a row reuse the same backup.
  const head = document.head;
  if (!head.getAttribute(TITLE_BACKUP_ATTR)) {
    head.setAttribute(TITLE_BACKUP_ATTR, document.title);
  }
  document.title = seo.title;
  setMeta("__lai_meta_desc", "name", "description", seo.description);
  setMeta("__lai_og_title", "property", "og:title", seo.title);
  setMeta("__lai_og_desc", "property", "og:description", seo.description);
  setMeta("__lai_og_url", "property", "og:url", seo.url);
  setMeta("__lai_og_type", "property", "og:type", "profile");
  setMeta("__lai_tw_card", "name", "twitter:card", "summary_large_image");
  setMeta("__lai_tw_title", "name", "twitter:title", seo.title);
  setMeta("__lai_tw_desc", "name", "twitter:description", seo.description);
  if (seo.imageUrl) {
    setMeta("__lai_og_image", "property", "og:image", seo.imageUrl);
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
  for (const id of META_IDS) {
    const el = document.getElementById(id);
    el?.remove();
  }
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
