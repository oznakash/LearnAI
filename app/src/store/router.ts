// Tiny URL ↔ View router.
//
// LearnAI's `View` is a discriminated union held in React state. Without
// URL sync, refreshing any page snaps the user back to home — see PR
// fixing this. We map View ↔ pathname both ways and wire the SPA to
// `window.history` + `popstate`. No router library; ~50 lines is plenty.
//
// All deploy targets (nginx.conf, vercel.json, netlify.toml, static.json)
// already fall back to /index.html for unknown paths, so HTML5 path
// routing works everywhere — no hash routes needed.

import type { TopicId } from "../types";
import type { View } from "../App";

/** Decode the current pathname into a View. Unknown paths → home. */
export function viewFromPath(pathname: string): View {
  const parts = pathname.split("/").filter(Boolean);
  const head = parts[0] ?? "";

  switch (head) {
    case "":
      return { name: "home" };
    case "tasks":
    case "dashboard":
    case "settings":
    case "leaderboard":
    case "calibration":
    case "memory":
    case "admin":
      return { name: head };
    case "topic": {
      const topicId = parts[1];
      return topicId ? { name: "topic", topicId: topicId as TopicId } : { name: "home" };
    }
    case "play": {
      const topicId = parts[1];
      if (!topicId) return { name: "home" };
      const levelId = parts[2];
      return { name: "play", topicId: topicId as TopicId, levelId };
    }
    case "u": {
      // /u/<handle> → Public Profile. The handle is path-decoded; we
      // don't validate here (the Profile view handles 404).
      const handle = parts[1];
      if (!handle) return { name: "home" };
      return { name: "profile", handle: decodeURIComponent(handle) };
    }
    default:
      return { name: "home" };
  }
}

/** Encode a View as an absolute pathname. */
export function pathForView(v: View): string {
  switch (v.name) {
    case "home":
      return "/";
    case "topic":
      return `/topic/${encodeURIComponent(v.topicId)}`;
    case "play":
      return v.levelId
        ? `/play/${encodeURIComponent(v.topicId)}/${encodeURIComponent(v.levelId)}`
        : `/play/${encodeURIComponent(v.topicId)}`;
    case "tasks":
    case "dashboard":
    case "settings":
    case "leaderboard":
    case "calibration":
    case "memory":
    case "admin":
      return `/${v.name}`;
    case "profile":
      return `/u/${encodeURIComponent(v.handle)}`;
  }
}

/** Two views point at the same URL. Used to skip pushState when nothing changed. */
export function sameView(a: View, b: View): boolean {
  return pathForView(a) === pathForView(b);
}
