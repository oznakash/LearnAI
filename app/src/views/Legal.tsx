// Legal pages — Privacy Policy + Terms of Use.
//
// Source-of-truth lives in `docs/legal/{privacy,terms}.md` so the prose
// is reviewable in pull requests and the git log is the audit trail. We
// import the markdown as a raw string at build time (Vite ?raw import)
// and render it with a tiny inline markdown subset — only enough to
// cover what the two docs actually use:
//
//   #, ##, ### headings · paragraphs · bullets · ---
//   **bold** · *italic* · `code` · [text](url)
//
// Why no markdown library: these two docs are plain prose, the bundle
// is already large, and safety is straightforward (input is the repo,
// not user content).
//
// LinkedIn's app-review crawler hits the *server-rendered* version of
// these URLs — see services/social-svc/src/ssr.ts — so this SPA view
// is the experience for signed-in users navigating from the footer or
// the sign-in card.

import privacyMd from "../../../docs/legal/privacy.md?raw";
import termsMd from "../../../docs/legal/terms.md?raw";
import type { ReactNode } from "react";

export type LegalKind = "privacy" | "terms";

export function Legal({ kind }: { kind: LegalKind }) {
  const md = kind === "privacy" ? privacyMd : termsMd;
  return (
    <article className="card max-w-3xl mx-auto">
      <Markdown source={md} />
      <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/50">
        <a className="hover:text-white" href="/privacy">Privacy Policy</a>
        <a className="hover:text-white" href="/terms">Terms of Use</a>
        <a
          className="hover:text-white"
          href="https://github.com/oznakash/learnai"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source code
        </a>
      </div>
    </article>
  );
}

// -- Tiny markdown renderer (handles only what privacy.md / terms.md need) ---

function Markdown({ source }: { source: string }) {
  // Drop any leading frontmatter / BOM; normalize line endings.
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Horizontal rule.
    if (/^-{3,}$/.test(trimmed)) {
      out.push(<hr key={key++} className="my-6 border-white/10" />);
      i++;
      continue;
    }
    // Headings (# / ## / ###).
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1]!.length;
      const text = h[2]!;
      const inner = <Inline text={text} />;
      const cls =
        level === 1
          ? "h1 mt-2 mb-3"
          : level === 2
            ? "h2 mt-7 mb-2"
            : "text-base font-semibold text-white mt-5 mb-1";
      // Renderer is intentionally limited to a small fixed heading set
      // — the two legal docs only use h1 / h2 / h3.
      if (level === 1) {
        out.push(<h1 key={key++} className={cls}>{inner}</h1>);
      } else if (level === 2) {
        out.push(<h2 key={key++} className={cls}>{inner}</h2>);
      } else {
        out.push(<h3 key={key++} className={cls}>{inner}</h3>);
      }
      i++;
      continue;
    }
    // Unordered list — consume contiguous lines starting with "- ".
    if (/^- /.test(trimmed)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^- /.test(lines[i]!.trim())) {
        const text = lines[i]!.trim().replace(/^-\s+/, "");
        items.push(
          <li key={key++} className="ml-5 list-disc text-white/80">
            <Inline text={text} />
          </li>,
        );
        i++;
      }
      out.push(
        <ul key={key++} className="my-2 space-y-1">
          {items}
        </ul>,
      );
      continue;
    }
    // Blank line — already handled by paragraph spacing; skip.
    if (trimmed === "") {
      i++;
      continue;
    }
    // Paragraph — consume contiguous non-empty, non-special lines.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^- /.test(lines[i]!.trim()) &&
      !/^#{1,6}\s/.test(lines[i]!.trim()) &&
      !/^-{3,}$/.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!.trim());
      i++;
    }
    out.push(
      <p key={key++} className="my-3 text-sm text-white/80 leading-relaxed">
        <Inline text={paraLines.join(" ")} />
      </p>,
    );
  }

  return <>{out}</>;
}

// Inline rendering: **bold**, *italic* / _italic_, `code`, [text](url).
// Tokenizer-style so the order is correct (bold before italic).
function Inline({ text }: { text: string }) {
  // Replace placeholders so nested inline doesn't collide.
  const parts: Array<string | ReactNode> = [text];
  let key = 0;

  const replace = (
    re: RegExp,
    render: (match: RegExpMatchArray) => ReactNode,
  ) => {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (typeof p !== "string") continue;
      const segments: Array<string | ReactNode> = [];
      let lastIndex = 0;
      let m: RegExpExecArray | null;
      const reG = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      while ((m = reG.exec(p)) !== null) {
        if (m.index > lastIndex) segments.push(p.slice(lastIndex, m.index));
        segments.push(render(m));
        lastIndex = m.index + m[0].length;
      }
      if (lastIndex < p.length) segments.push(p.slice(lastIndex));
      if (segments.length) {
        parts.splice(i, 1, ...segments);
        i += segments.length - 1;
      }
    }
  };

  // Inline code first (so its content is escaped from other rules).
  replace(/`([^`]+)`/g, (m) => (
    <code key={`c-${key++}`} className="px-1 py-0.5 rounded bg-white/10 text-[12px] font-mono">
      {m[1]}
    </code>
  ));
  // Links.
  replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m) => {
    const isExternal = /^https?:\/\//.test(m[2]!);
    return (
      <a
        key={`l-${key++}`}
        href={m[2]}
        className="text-accent2 hover:underline"
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {m[1]}
      </a>
    );
  });
  // Bold.
  replace(/\*\*([^*]+)\*\*/g, (m) => (
    <strong key={`b-${key++}`} className="text-white">
      {m[1]}
    </strong>
  ));
  // Italic — *foo* or _foo_.
  replace(/(?:^|[\s(\-])\*([^*\n]+)\*(?:[\s.,;:!?)\-]|$)/g, (m) => {
    // We captured the bracketing whitespace/punct; preserve them.
    const raw = m[0];
    const inner = m[1]!;
    const before = raw.slice(0, raw.indexOf("*"));
    const after = raw.slice(raw.lastIndexOf("*") + 1);
    return (
      <span key={`i-${key++}`}>
        {before}
        <em className="italic">{inner}</em>
        {after}
      </span>
    );
  });
  replace(/(?:^|[\s(\-])_([^_\n]+)_(?:[\s.,;:!?)\-]|$)/g, (m) => {
    const raw = m[0];
    const inner = m[1]!;
    const before = raw.slice(0, raw.indexOf("_"));
    const after = raw.slice(raw.lastIndexOf("_") + 1);
    return (
      <span key={`i-${key++}`}>
        {before}
        <em className="italic">{inner}</em>
        {after}
      </span>
    );
  });

  return <>{parts}</>;
}
