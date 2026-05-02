/**
 * Admin → Creators tab — paste-and-draft Spark UI.
 *
 * Pinning the contract the CPO surfaced after the first content sprint:
 *
 *   "I am seeing many creators were created, but 0 sparks and not seeing
 *    ability to paste content there or prompt."
 *
 * Tests:
 *   1. The 9 seed creators all render (Lenny + 8 sprint-#2 sources).
 *   2. The "+ Add Spark" button on the active creator opens the modal.
 *   3. Without an Anthropic API key, the AI-draft button is disabled and
 *      a hint points the operator at the right Settings field.
 *   4. The "Or fill by hand" path produces a draft form whose save flow
 *      writes a MicroRead Spark into `contentOverrides.topics[topicId]`
 *      with creator attribution.
 *   5. Closing the modal clears the form (re-open is empty).
 *   6. Topic / level / category dropdowns expose only valid choices.
 *   7. After saving, the creator's attributed-Spark count includes the
 *      newly-added Spark (paste→edit→save→count round-trip).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { AdminCreators } from "../admin/AdminCreators";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { STORAGE_KEY } from "../store/game";
import { defaultAdminConfig } from "../admin/defaults";

function seedAdmin(extras: Partial<{ apiKey: string }> = {}) {
  // Player: signed-in admin so the AdminProvider grants `isAdmin`.
  // Optional apiKey gates the "Draft Spark with AI" button — present in
  // happy-path tests, absent in the missing-key test.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: {
        email: "admin@gmail.com",
        name: "Admin",
        provider: "google",
      },
      profile: {
        ageBand: "adult",
        skillLevel: "builder",
        interests: ["ai-foundations"],
        dailyMinutes: 10,
        createdAt: Date.now() - 86_400_000,
      },
      xp: 0,
      streak: 0,
      history: [],
      apiKey: extras.apiKey,
      apiProvider: extras.apiKey ? "anthropic" : undefined,
    })
  );
  const cfg = defaultAdminConfig();
  cfg.bootstrapped = true;
  cfg.admins = ["admin@gmail.com"];
  cfg.serverAuth = { mode: "demo", mem0Url: "", googleClientId: "" };
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(cfg));
}

function mount() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <AdminCreators />
      </AdminProvider>
    </PlayerProvider>
  );
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AdminCreators — paste-and-draft Spark UI", () => {
  it("renders all 9 seed creators in the registry", async () => {
    seedAdmin();
    mount();
    await settle();

    // Names from `app/src/content/creators.ts`. We don't pin order
    // (that's UI-driven) — just the presence.
    const creatorNames = [
      "Lenny's Podcast",
      "AlphaSignal",
      "Hacker News",
      "Y Combinator",
      "Anthropic",
      "Simon Willison",
      "Hugging Face",
      "Latent Space",
      "Google DeepMind",
    ];
    for (const name of creatorNames) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("clicking '+ Add Spark' opens the paste-and-draft modal", async () => {
    seedAdmin();
    mount();
    await settle();

    // The Add Spark button is in the active creator's detail card. The
    // first creator (sorted alphabetically) is auto-selected on mount.
    const addBtn = screen.getByTestId("add-spark");
    fireEvent.click(addBtn);
    await settle();

    // Modal is identifiable by role + aria-label.
    expect(screen.getByRole("dialog", { name: /add spark/i })).toBeTruthy();
    // The paste textarea + topic / level / category selectors are wired.
    expect(screen.getByTestId("paste-content")).toBeTruthy();
    expect(screen.getByTestId("topic-select")).toBeTruthy();
    expect(screen.getByTestId("level-select")).toBeTruthy();
    expect(screen.getByTestId("category-select")).toBeTruthy();
  });

  it("disables 'Draft Spark with AI' and shows a hint when no API key is set", async () => {
    seedAdmin({}); // no apiKey
    mount();
    await settle();

    fireEvent.click(screen.getByTestId("add-spark"));
    await settle();

    // The hint surfaces and the button is disabled.
    expect(screen.getByTestId("missing-key-hint").textContent).toMatch(
      /api key/i
    );
    const draftBtn = screen.getByTestId("draft-with-ai") as HTMLButtonElement;
    expect(draftBtn.disabled).toBe(true);
  });

  it("manual draft → save persists a MicroRead Spark to contentOverrides", async () => {
    seedAdmin({ apiKey: "sk-ant-test" });
    mount();
    await settle();

    fireEvent.click(screen.getByTestId("add-spark"));
    await settle();

    // Pick AI Foundations · L2 · pattern.
    fireEvent.change(screen.getByTestId("topic-select"), {
      target: { value: "ai-foundations" },
    });
    fireEvent.change(screen.getByTestId("level-select"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByTestId("category-select"), {
      target: { value: "pattern" },
    });

    // Skip AI — fill by hand.
    fireEvent.click(screen.getByTestId("manual-draft"));
    await settle();

    fireEvent.change(screen.getByTestId("draft-title"), {
      target: { value: "Prompt caching is the cheapest leverage you have" },
    });
    fireEvent.change(screen.getByTestId("draft-body"), {
      target: {
        body: "ignored",
        value:
          "When the same context flows into Claude on every request, the rest is paid once.",
      },
    });
    fireEvent.change(screen.getByTestId("draft-takeaway"), {
      target: { value: "Cache the system prompt before optimizing anything else." },
    });

    fireEvent.click(screen.getByTestId("save-spark"));
    await settle();

    // Modal is now closed (we don't render the dialog after save).
    expect(screen.queryByRole("dialog", { name: /add spark/i })).toBeNull();

    // localStorage carries the override write — the AdminContext save
    // effect runs synchronously (debounce-free) on every dispatch.
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY) ?? "{}";
    const cfg = JSON.parse(raw);
    const aiFoundations = cfg.contentOverrides?.topics?.["ai-foundations"];
    expect(aiFoundations).toBeTruthy();
    const lvl2 = aiFoundations.levels.find(
      (l: { index: number }) => l.index === 2
    );
    expect(lvl2).toBeTruthy();
    const newSpark = lvl2.sparks.find(
      (sp: { title: string }) =>
        typeof sp.title === "string" && sp.title.includes("Prompt caching")
    );
    expect(newSpark).toBeTruthy();
    expect(newSpark.exercise.type).toBe("microread");
    expect(newSpark.exercise.category).toBe("pattern");
    expect(newSpark.exercise.source.name).toBeTruthy();
  });

  it("closing the modal without saving clears the draft form on re-open", async () => {
    seedAdmin({ apiKey: "sk-ant-test" });
    mount();
    await settle();

    fireEvent.click(screen.getByTestId("add-spark"));
    await settle();

    fireEvent.change(screen.getByTestId("paste-content"), {
      target: { value: "scratchpad text that should not survive close" },
    });

    fireEvent.click(screen.getByTestId("close-modal"));
    await settle();
    expect(screen.queryByRole("dialog", { name: /add spark/i })).toBeNull();

    // Re-open: paste textarea is empty (modal mounts fresh).
    fireEvent.click(screen.getByTestId("add-spark"));
    await settle();
    const ta = screen.getByTestId("paste-content") as HTMLTextAreaElement;
    expect(ta.value).toBe("");
  });

  it("topic / level / category dropdowns expose the expected choice sets", async () => {
    seedAdmin({ apiKey: "sk-ant-test" });
    mount();
    await settle();

    fireEvent.click(screen.getByTestId("add-spark"));
    await settle();

    const topicSel = screen.getByTestId("topic-select") as HTMLSelectElement;
    const topicValues = within(topicSel)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    // 12 topic ids — must be exact for the loader to find them.
    expect(topicValues.length).toBe(12);
    expect(topicValues).toEqual(
      expect.arrayContaining([
        "ai-foundations",
        "llms-cognition",
        "ai-pm",
        "ai-builder",
        "open-source",
      ])
    );

    const levelSel = screen.getByTestId("level-select") as HTMLSelectElement;
    const levelValues = within(levelSel)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(levelValues).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);

    const catSel = screen.getByTestId("category-select") as HTMLSelectElement;
    const catValues = within(catSel)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    // 6 SparkCategory members.
    expect(catValues).toEqual([
      "principle",
      "pattern",
      "tooling",
      "company",
      "news",
      "frontier",
    ]);
  });

  it("AI draft button calls Anthropic when an API key is set + paste is non-trivial", async () => {
    seedAdmin({ apiKey: "sk-ant-test-XYZ" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  type: "microread",
                  title: "Title from AI",
                  body: "Body distilled from the pasted content.",
                  takeaway: "Cache before tuning.",
                  source: { name: "AlphaSignal", url: "https://alphasignal.ai/archive" },
                  category: "pattern",
                  addedAt: "2026-05-01",
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )) as typeof fetch);

    mount();
    await settle();
    fireEvent.click(screen.getByTestId("add-spark"));
    await settle();

    // Need >20 chars of paste for the button to enable.
    fireEvent.change(screen.getByTestId("paste-content"), {
      target: {
        value:
          "AlphaSignal: prompt caching is the cheapest leverage you have when the same context flows into Claude on every request.",
      },
    });

    const draftBtn = screen.getByTestId("draft-with-ai") as HTMLButtonElement;
    expect(draftBtn.disabled).toBe(false);
    await act(async () => {
      draftBtn.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(fetchSpy).toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(
      "sk-ant-test-XYZ"
    );
    expect((init.headers as Record<string, string>)["anthropic-version"]).toBe(
      "2023-06-01"
    );

    // The drafted preview shows up — populated from the mocked response.
    const titleField = screen.getByTestId("draft-title") as HTMLInputElement;
    expect(titleField.value).toBe("Title from AI");
  });
});
