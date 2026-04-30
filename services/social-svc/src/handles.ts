// Handle generation + display-name helpers. Mirrors
// app/src/social/handles.ts; kept duplicated so the service compiles
// independently. Both files must stay in sync.

const MAX_LEN = 24;

export function baseHandleFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").toLowerCase().replace(/\./g, "");
  let out = "";
  for (const ch of local) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch === "_" || ch === "-") out += ch;
    else if (out && out[out.length - 1] !== "-") out += "-";
  }
  out = out.replace(/[-_]{2,}/g, "-");
  out = out.replace(/^[-_]+|[-_]+$/g, "");
  if (out.length > MAX_LEN) out = out.slice(0, MAX_LEN);
  if (!out) out = "user";
  return out;
}

export function disambiguateHandle(
  base: string,
  isTaken: (candidate: string) => boolean,
): string | null {
  if (!isTaken(base)) return base;
  for (let n = 2; n <= 9999; n++) {
    const candidate = `${base}${n}`;
    if (!isTaken(candidate)) return candidate;
  }
  return null;
}

export function firstNameFrom(fullName: string | undefined, email: string): string {
  const n = (fullName ?? "").trim();
  if (n) {
    const first = n.split(/\s+/)[0];
    if (first) return first;
  }
  const base = baseHandleFromEmail(email);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function resolveDisplayName(opts: {
  fullName?: string;
  showFullName: boolean;
  email: string;
}): string {
  if (opts.showFullName && opts.fullName?.trim()) return opts.fullName.trim();
  return firstNameFrom(opts.fullName, opts.email);
}
