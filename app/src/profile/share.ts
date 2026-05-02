// Share helpers for the public-profile route.
//
// `Profile.tsx` already builds a clean `${origin}/u/${handle}` URL. This
// helper adds two things on top of the previous clipboard-only flow:
//   1. `navigator.share` when the platform supports it (mobile share sheet)
//   2. A return value the caller can show as a toast — the previous
//      implementation gave no feedback, which made the button feel broken.

export type ShareResult = "shared" | "copied" | "failed";

export function buildProfileUrl(handle: string, origin?: string): string {
  if (!handle) return "";
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/u/${encodeURIComponent(handle)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export interface ShareArgs {
  handle: string;
  displayName: string;
  origin?: string;
}

export async function shareProfile(args: ShareArgs): Promise<ShareResult> {
  const url = buildProfileUrl(args.handle, args.origin);
  if (!url) return "failed";
  const nav =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { share?: (data: ShareData) => Promise<void> })
      : null;
  if (nav?.share) {
    try {
      await nav.share({
        title: `${args.displayName} on LearnAI`,
        text: `${args.displayName} is learning AI on LearnAI.`,
        url,
      });
      return "shared";
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
  }
  const ok = await copyToClipboard(url);
  return ok ? "copied" : "failed";
}
