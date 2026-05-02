import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";
import {
  escape,
  renderProfileHtml,
  renderRobotsTxt,
  renderSitemapXml,
  safeUrl,
} from "../src/ssr.js";
import type { ProfileRecord, AggregateRecord } from "../src/types.js";

/**
 * SSR public-profile surface: `/u/:handle`, `/robots.txt`, `/sitemap.xml`.
 *
 * These are the SEO + share-link unfurl surface. Crawlers (Googlebot,
 * GPTBot, ClaudeBot, Twitterbot) and unfurlers (Slack, LinkedIn) hit
 * these without auth; the SPA never renders them. Tests pin: real
 * keyword content per profile, OG / Twitter / JSON-LD presence,
 * privacy gates (closed / kid / banned never expose aggregates), HTML
 * escape correctness, robots welcomes the AI bots, sitemap excludes
 * private profiles.
 */

let store: Store;
let app: ReturnType<typeof createApp>;

function makeProfile(patch: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    email: "maya@gmail.com",
    handle: "maya",
    displayFirst: "Maya",
    fullName: "Maya Patel",
    pictureUrl: "https://lh3.googleusercontent.com/maya/photo.jpg",
    ageBand: "adult",
    profileMode: "open",
    showFullName: true,
    showCurrent: true,
    showMap: true,
    showActivity: true,
    showBadges: true,
    showSignup: true,
    signalsGlobal: true,
    signals: ["ai-builder", "ai-pm"],
    banned: false,
    bannedSocial: false,
    createdAt: 1_730_000_000_000,
    updatedAt: 1_730_000_000_000,
    ...patch,
  };
}

function makeAggregate(patch: Partial<AggregateRecord> = {}): AggregateRecord {
  return {
    email: "maya@gmail.com",
    xpTotal: 740,
    xpWeek: 120,
    xpMonth: 320,
    streak: 12,
    guildTier: "Architect",
    currentTopicId: "ai-builder",
    currentLevel: 3,
    badges: ["streaker"],
    topicXp: { "ai-builder": 320, "ai-pm": 220 },
    activity14d: [0, 0, 1, 2, 3, 1, 0, 4, 5, 2, 1, 0, 3, 4],
    updatedAt: 1_730_000_000_000,
    ...patch,
  };
}

beforeEach(() => {
  store = createStore();
  app = createApp({ store, admins: ["admin@learnai.dev"], demoTrustHeader: true });
});

afterEach(() => {
  store.reset();
});

// -- HTML escape unit tests ---------------------------------------------

describe("ssr — escape helpers", () => {
  it("escapes the five XSS-relevant chars", () => {
    expect(escape(`<script>"&'</script>`)).toBe(
      "&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;",
    );
  });

  it("returns empty string for null/undefined", () => {
    expect(escape(null)).toBe("");
    expect(escape(undefined)).toBe("");
  });

  it("safeUrl drops javascript: / data: / file: / unknown schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,<script>x</script>")).toBe("");
    expect(safeUrl("file:///etc/passwd")).toBe("");
    expect(safeUrl(undefined)).toBe("");
  });

  it("safeUrl preserves https:// and http://", () => {
    expect(safeUrl("https://example.com/x.png")).toBe("https://example.com/x.png");
    expect(safeUrl("http://example.com/x.png")).toBe("http://example.com/x.png");
  });
});

// -- Profile HTML rendering ---------------------------------------------

describe("ssr — renderProfileHtml (open profile)", () => {
  it("contains the player's full name in <title> and as <h1>", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
      origin: "https://learnai.cloud-claude.com",
    });
    expect(html).toContain("<title>Maya Patel (@maya) — LearnAI</title>");
    expect(html).toContain("<h1>Maya Patel</h1>");
    // Handle in the body too.
    expect(html).toContain("@maya");
  });

  it("emits OpenGraph + Twitter card meta with name + image + URL", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
      origin: "https://learnai.cloud-claude.com",
    });
    expect(html).toContain('property="og:type" content="profile"');
    expect(html).toContain('property="og:title" content="Maya Patel (@maya)');
    expect(html).toContain('property="og:url" content="https://learnai.cloud-claude.com/u/maya"');
    expect(html).toContain(
      'property="og:image" content="https://lh3.googleusercontent.com/maya/photo.jpg"',
    );
    // When the user has a (square) Google avatar, we use Twitter's
    // `summary` card (square thumbnail) instead of `summary_large_image`
    // (which expects a 1200x630 image and crops square avatars badly).
    expect(html).toContain('name="twitter:card" content="summary"');
  });

  it("falls back to summary_large_image + 1200x630 dims when there's no user picture", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ pictureUrl: undefined }),
      aggregate: makeAggregate(),
    });
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
  });

  it("avatar img carries referrerpolicy=no-referrer + crossorigin=anonymous (Safari Reduce Protections mitigation)", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
    });
    expect(html).toMatch(/<img[^>]*referrerpolicy="no-referrer"/);
    expect(html).toMatch(/<img[^>]*crossorigin="anonymous"/);
  });

  it("emits a strict-origin-when-cross-origin referrer meta hint", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
    });
    expect(html).toContain(
      'name="referrer" content="strict-origin-when-cross-origin"',
    );
  });

  it("emits JSON-LD ProfilePage with Person mainEntity", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
    });
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toMatch(/"@type"\s*:\s*"ProfilePage"/);
    expect(html).toMatch(/"@type"\s*:\s*"Person"/);
    expect(html).toContain('"name":"Maya Patel"');
    expect(html).toContain('"alternateName":"@maya"');
  });

  it("includes the explicit robots invitation for crawlers", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
    });
    expect(html).toContain('name="robots" content="index, follow, max-image-preview:large"');
  });

  it("renders the achievement chips (XP, streak, tier)", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
    });
    expect(html).toContain("⚡ 740");
    expect(html).toContain("🔥 12-day streak");
    expect(html).toContain("🏅 Architect");
  });

  it("renders 'Currently working on' with the canonical level number", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate({ currentTopicId: "ai-builder", currentLevel: 3 }),
    });
    expect(html).toContain("Currently working on");
    expect(html).toContain("Being an AI Builder");
    expect(html).toContain("Level 3");
  });

  it("hides 'Currently working on' when the level is 0 (player hasn't really started)", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate({ currentLevel: 0 }),
    });
    expect(html).not.toContain("Currently working on");
  });

  it("renders sample sparks for each Signal in <details> collapsibles (SEO content)", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-builder", "ai-pm"] }),
      aggregate: makeAggregate(),
    });
    // <details> tags so the layout is tight but bots get the full content.
    expect(html).toMatch(/<details>/);
    // Both signal topics appear as section summaries.
    expect(html).toContain("Being an AI Builder");
    expect(html).toContain("AI Product Management");
    // Sample-spark titles + teasers — the SEO indexable content.
    expect(html).toContain("Tiny ships &gt; big plans");
    expect(html).toContain("Loom-before-code");
    expect(html).toContain("Evals are your roadmap");
  });

  it("renders the 14-day activity sparkline as accessible HTML bars", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
    });
    expect(html).toContain("Last 14 days");
    expect(html).toMatch(/aria-label="14-day activity sparkline"/);
  });

  it("ends with a 'Sign in to start' CTA that lands on /", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
    });
    expect(html).toMatch(/Sign in to start[^<]*</);
    expect(html).toMatch(/href="\/"/);
  });

  it("never leaks the player's email", () => {
    const html = renderProfileHtml({
      profile: makeProfile(),
      aggregate: makeAggregate(),
    });
    expect(html).not.toContain("maya@gmail.com");
  });
});

// -- Personalized learnings + AI-ingestion structured data --------------

describe("ssr — personalized topic learnings (SEO + AI ingestion)", () => {
  it("renders the 'What @<handle> is learning' section header personalized to the user", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-builder"] }),
      aggregate: makeAggregate(),
    });
    expect(html).toContain("What @maya is learning");
  });

  it("includes the longer 'whatYoudLearn' rundown per Signal topic — keyword-dense SEO content", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-foundations"] }),
      aggregate: makeAggregate(),
    });
    // Pin a few keyword-dense phrases from the new whatYoudLearn body.
    expect(html).toContain("transformer architecture");
    expect(html).toContain("scaling laws");
    expect(html).toContain("RLHF");
  });

  it("renders 5 sample sparks per Signal topic (was 2 in the v1 snippet)", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-builder"] }),
      aggregate: makeAggregate(),
    });
    const sparkCount = (html.match(/<article class="spark"/g) ?? []).length;
    expect(sparkCount).toBeGreaterThanOrEqual(5);
  });

  it("each sample spark carries Schema.org LearningResource microdata", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-pm"] }),
      aggregate: makeAggregate(),
    });
    expect(html).toContain('itemtype="https://schema.org/LearningResource"');
    expect(html).toContain('itemprop="name"');
    expect(html).toContain('itemprop="description"');
    expect(html).toContain('itemprop="learningResourceType" content="article"');
  });

  it("renders a per-topic XP hint when the aggregate carries earned XP for that topic", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-builder"] }),
      aggregate: makeAggregate({ topicXp: { "ai-builder": 320 } }),
    });
    // The per-topic XP pill flag personalizes each Signal section so two
    // users with the same Signals don't render byte-identical content.
    expect(html).toContain("⚡ 320 earned here");
  });

  it("hides the per-topic XP hint when the user hasn't earned XP in that topic yet", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["cybersecurity"] }),
      aggregate: makeAggregate({ topicXp: {} }),
    });
    expect(html).not.toContain("earned here");
  });
});

describe("ssr — JSON-LD Course graph for AI ingestion bots", () => {
  function parseJsonLd(html: string): Record<string, unknown> {
    const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(m).toBeTruthy();
    return JSON.parse(
      m![1].replace(/\\u003c/g, "<").replace(/--\\u003e/g, "-->"),
    );
  }

  it("emits a @graph with ProfilePage + Person + a Course per Signal", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-builder", "ai-pm"] }),
      aggregate: makeAggregate(),
    });
    const json = parseJsonLd(html);
    const graph = json["@graph"] as { "@type": string }[];
    expect(Array.isArray(graph)).toBe(true);
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("ProfilePage");
    expect(types).toContain("Person");
    expect(types.filter((t) => t === "Course").length).toBe(2);
  });

  it("each Course carries a hasPart array of LearningResource items", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-foundations"] }),
      aggregate: makeAggregate(),
    });
    const json = parseJsonLd(html);
    const graph = json["@graph"] as Array<{
      "@type": string;
      hasPart?: Array<{ "@type": string; name: string; description: string }>;
    }>;
    const course = graph.find((n) => n["@type"] === "Course");
    expect(course).toBeDefined();
    expect(course!.hasPart!.length).toBeGreaterThanOrEqual(5);
    expect(course!.hasPart![0]["@type"]).toBe("LearningResource");
    expect(course!.hasPart![0].name).toBeTruthy();
    expect(course!.hasPart![0].description).toBeTruthy();
  });

  it("the Person knowsAbout the user's Signal courses", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ signals: ["ai-builder", "memory-safety"] }),
      aggregate: makeAggregate(),
    });
    const json = parseJsonLd(html);
    const graph = json["@graph"] as Array<{
      "@type": string;
      knowsAbout?: string[];
    }>;
    const person = graph.find((n) => n["@type"] === "Person");
    expect(person?.knowsAbout).toEqual(
      expect.arrayContaining([
        expect.stringContaining("#topic-ai-builder"),
        expect.stringContaining("#topic-memory-safety"),
      ]),
    );
  });

  it("closed profiles emit no Course / LearningResource leakage in the JSON-LD", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ profileMode: "closed", signals: ["ai-builder"] }),
      aggregate: makeAggregate(),
    });
    expect(html).not.toContain('"@type":"Course"');
    expect(html).not.toContain('"@type":"LearningResource"');
  });
});

describe("ssr — privacy gates", () => {
  it("renders the closed gate (no XP, no signals, no aggregates) for profileMode=closed", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ profileMode: "closed" }),
      aggregate: makeAggregate(),
    });
    expect(html).toContain("This profile is closed");
    expect(html).not.toContain("⚡ 740");
    expect(html).not.toContain("Currently working on");
    expect(html).not.toContain("Being an AI Builder");
    // Display name + avatar still shown — that's the public minimum.
    expect(html).toContain("Maya Patel");
    expect(html).toContain("@maya");
  });

  it("kid profiles are forced to the closed gate even if profileMode is open", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ ageBand: "kid", profileMode: "open" }),
      aggregate: makeAggregate(),
    });
    expect(html).toContain("This profile is closed");
    expect(html).not.toContain("⚡ 740");
  });

  it("first-name fallback when showFullName=false (default visitor view)", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ showFullName: false }),
      aggregate: makeAggregate(),
    });
    expect(html).toContain("<h1>Maya</h1>");
    expect(html).not.toContain("<h1>Maya Patel</h1>");
  });

  it("hostile pictureUrl with javascript: is dropped (initials fallback)", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ pictureUrl: "javascript:alert(1)" }),
      aggregate: makeAggregate(),
    });
    expect(html).not.toContain("javascript:");
    // Initials fallback rendered instead of <img>
    expect(html).toContain(">MP<");
  });

  it("escapes XSS attempts in fullName", () => {
    const html = renderProfileHtml({
      profile: makeProfile({ fullName: '<script>alert("pwn")</script>' }),
      aggregate: makeAggregate(),
    });
    expect(html).not.toContain("<script>alert(");
    expect(html).toContain("&lt;script&gt;");
  });
});

// -- HTTP route integration tests ---------------------------------------

describe("GET /u/:handle (no auth)", () => {
  it("returns 200 + HTML for an open profile", async () => {
    const profile = makeProfile();
    store.upsertProfile(profile);
    store.upsertAggregate(makeAggregate());
    const r = await request(app).get("/u/maya");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/html/);
    expect(r.text).toContain("Maya Patel");
    expect(r.text).toContain('property="og:title"');
  });

  it("returns 404 + a friendly HTML page for an unknown handle", async () => {
    const r = await request(app).get("/u/no-such-user");
    expect(r.status).toBe(404);
    expect(r.headers["content-type"]).toMatch(/text\/html/);
    expect(r.text).toContain("@no-such-user");
    expect(r.text).toContain("noindex");
  });

  it("returns 404 for banned profiles (no leakage that the handle exists)", async () => {
    store.upsertProfile(makeProfile({ banned: true }));
    const r = await request(app).get("/u/maya");
    expect(r.status).toBe(404);
    expect(r.text).not.toContain("Architect");
  });

  it("returns 404 for syntactically invalid handles without touching the store", async () => {
    const r = await request(app).get("/u/" + "x".repeat(60));
    expect(r.status).toBe(404);
  });

  it("does NOT require auth (the whole point of this surface)", async () => {
    store.upsertProfile(makeProfile());
    const r = await request(app).get("/u/maya"); // no X-User-Email
    expect(r.status).toBe(200);
  });

  it("emits a short cache header so deploys roll out within a minute", async () => {
    store.upsertProfile(makeProfile());
    const r = await request(app).get("/u/maya");
    expect(r.headers["cache-control"]).toMatch(/max-age=60/);
  });
});

describe("GET /robots.txt (no auth)", () => {
  it("returns 200 + text/plain", async () => {
    const r = await request(app).get("/robots.txt");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/plain/);
  });

  it("welcomes the AI ingestion bots explicitly", async () => {
    const r = await request(app).get("/robots.txt");
    for (const ua of [
      "GPTBot",
      "ChatGPT-User",
      "ClaudeBot",
      "anthropic-ai",
      "PerplexityBot",
      "Google-Extended",
      "Applebot-Extended",
    ]) {
      expect(r.text).toContain(`User-agent: ${ua}`);
    }
  });

  it("welcomes classic search + unfurl crawlers", async () => {
    const r = await request(app).get("/robots.txt");
    for (const ua of [
      "Googlebot",
      "Bingbot",
      "DuckDuckBot",
      "Twitterbot",
      "facebookexternalhit",
      "Slackbot",
      "LinkedInBot",
    ]) {
      expect(r.text).toContain(`User-agent: ${ua}`);
    }
  });

  it("explicitly disallows private SPA-only routes", async () => {
    const r = await request(app).get("/robots.txt");
    for (const path of ["/admin", "/settings", "/memory", "/tasks", "/dashboard", "/play"]) {
      expect(r.text).toContain(`Disallow: ${path}`);
    }
  });

  it("links to the sitemap", async () => {
    const r = await request(app).get("/robots.txt");
    expect(r.text).toMatch(/Sitemap:\s*https?:\/\/[^/]+\/sitemap\.xml/);
  });
});

describe("GET /sitemap.xml (no auth)", () => {
  it("returns 200 + application/xml", async () => {
    const r = await request(app).get("/sitemap.xml");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/application\/xml/);
    expect(r.text).toContain('<?xml version="1.0"');
  });

  it("lists every open profile and skips closed / kid / banned", async () => {
    store.upsertProfile(makeProfile({ email: "open@gmail.com", handle: "open-u", profileMode: "open" }));
    store.upsertProfile(makeProfile({ email: "closed@gmail.com", handle: "closed-u", profileMode: "closed" }));
    store.upsertProfile(makeProfile({ email: "kid@gmail.com", handle: "kid-u", ageBand: "kid", profileMode: "open" }));
    store.upsertProfile(makeProfile({ email: "ban@gmail.com", handle: "ban-u", banned: true }));
    const r = await request(app).get("/sitemap.xml");
    expect(r.text).toContain("/u/open-u");
    expect(r.text).not.toContain("/u/closed-u");
    expect(r.text).not.toContain("/u/kid-u");
    expect(r.text).not.toContain("/u/ban-u");
  });

  it("includes the home page at priority 1.0", async () => {
    const r = await request(app).get("/sitemap.xml");
    expect(r.text).toContain("<priority>1.0</priority>");
  });
});

// -- renderSitemapXml unit (origin override) ---------------------------

describe("renderSitemapXml", () => {
  it("respects an explicit origin (X-Forwarded-Host path through nginx)", () => {
    const xml = renderSitemapXml(
      [makeProfile({ handle: "maya" })],
      "https://staging.learnai.dev",
    );
    expect(xml).toContain("https://staging.learnai.dev/u/maya");
  });
});

// -- robots origin override --------------------------------------------

describe("renderRobotsTxt", () => {
  it("emits the sitemap URL using the supplied origin", () => {
    const text = renderRobotsTxt("https://staging.learnai.dev");
    expect(text).toContain("Sitemap: https://staging.learnai.dev/sitemap.xml");
  });
});
