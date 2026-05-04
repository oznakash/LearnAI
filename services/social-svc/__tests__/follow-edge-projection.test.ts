import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";

/**
 * Wire-shape regression: every FollowEdge that leaves the server has
 * its `target` and `follower` rewritten from the stored email to the
 * public handle.
 *
 * The bug this pins: Profile.tsx and the offline social service both
 * compare `e.target.toLowerCase() === handle.toLowerCase()`. Pre-fix,
 * the server returned `target: "<email>"`, so a follow that was
 * correctly persisted server-side never lit up in the SPA. Refresh
 * looked like the follow had reset.
 *
 * Privacy bonus: cross-viewer reads no longer leak Gmail addresses
 * into client memory.
 */

let store: Store;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = createStore();
  app = createApp({
    store,
    admins: ["admin@learnai.dev"],
    demoTrustHeader: true,
  });
});

afterEach(() => {
  store.reset();
});

const headers = (email: string) => ({ "x-user-email": email });

async function signUp(email: string) {
  const r = await request(app).get("/v1/social/me").set(headers(email));
  expect(r.status).toBe(200);
  return r.body as { handle: string };
}

describe("FollowEdge wire shape", () => {
  it("POST /follow returns target as a HANDLE, not an email", async () => {
    await signUp("maya@gmail.com");
    const priya = await signUp("priya@gmail.com");
    const r = await request(app)
      .post(`/v1/social/follow/${priya.handle}`)
      .set(headers("maya@gmail.com"));
    expect(r.status).toBe(201);
    expect(r.body.target).toBe(priya.handle);
    expect(r.body.target).not.toContain("@");
    expect(r.body.follower).not.toContain("@");
  });

  it("GET /me/following returns edges where every target is a HANDLE", async () => {
    await signUp("maya@gmail.com");
    const priya = await signUp("priya@gmail.com");
    await signUp("alex@gmail.com");
    await request(app).post(`/v1/social/follow/priya`).set(headers("maya@gmail.com"));
    await request(app).post(`/v1/social/follow/alex`).set(headers("maya@gmail.com"));
    const r = await request(app)
      .get("/v1/social/me/following")
      .set(headers("maya@gmail.com"));
    expect(r.body.length).toBe(2);
    for (const edge of r.body) {
      expect(edge.target).not.toContain("@");
      expect(edge.follower).not.toContain("@");
    }
    expect(r.body.map((e: { target: string }) => e.target).sort()).toEqual(["alex", "priya"]);
  });

  it("GET /me/followers also returns handles", async () => {
    await signUp("maya@gmail.com");
    await signUp("priya@gmail.com");
    await request(app).post(`/v1/social/follow/maya`).set(headers("priya@gmail.com"));
    const r = await request(app)
      .get("/v1/social/me/followers")
      .set(headers("maya@gmail.com"));
    expect(r.body.length).toBe(1);
    expect(r.body[0].follower).toBe("priya");
    expect(r.body[0].target).toBe("maya");
  });

  it("Profile.tsx-style follow detection works (handle === handle, no email mismatch)", async () => {
    // This is the exact contract the SPA's Profile.tsx FollowActionCluster
    // depends on: list following, then for the handle on the URL, find
    // an edge whose `target` matches that handle. Pre-fix this never
    // matched; post-fix it does.
    await signUp("maya@gmail.com");
    const priya = await signUp("priya@gmail.com");
    await request(app).post(`/v1/social/follow/${priya.handle}`).set(headers("maya@gmail.com"));
    const list = await request(app)
      .get("/v1/social/me/following")
      .set(headers("maya@gmail.com"));
    const edge = list.body.find((e: { target: string }) =>
      e.target.toLowerCase() === priya.handle.toLowerCase(),
    );
    expect(edge).toBeDefined();
    expect(edge!.status).toBe("approved");
  });
});

describe("approve / decline accept handle (with email back-compat)", () => {
  beforeEach(async () => {
    await signUp("maya@gmail.com");
    await signUp("priya@gmail.com");
    // Make priya's profile closed so a follow lands as 'pending'.
    await request(app)
      .put("/v1/social/me")
      .set(headers("priya@gmail.com"))
      .send({ profileMode: "closed" });
  });

  it("POST /requests/<handle>/approve flips a pending edge to approved", async () => {
    await request(app).post(`/v1/social/follow/priya`).set(headers("maya@gmail.com"));
    const r = await request(app)
      .post(`/v1/social/requests/maya/approve`)
      .set(headers("priya@gmail.com"));
    expect(r.status).toBe(204);
    const followers = await request(app)
      .get("/v1/social/me/followers?status=approved")
      .set(headers("priya@gmail.com"));
    expect(followers.body.length).toBe(1);
    expect(followers.body[0].follower).toBe("maya");
  });

  it("POST /requests/<email>/approve still works (legacy back-compat)", async () => {
    await request(app).post(`/v1/social/follow/priya`).set(headers("maya@gmail.com"));
    const r = await request(app)
      .post(`/v1/social/requests/${encodeURIComponent("maya@gmail.com")}/approve`)
      .set(headers("priya@gmail.com"));
    expect(r.status).toBe(204);
  });

  it("POST /requests/<handle>/decline removes the pending edge", async () => {
    await request(app).post(`/v1/social/follow/priya`).set(headers("maya@gmail.com"));
    const r = await request(app)
      .post(`/v1/social/requests/maya/decline`)
      .set(headers("priya@gmail.com"));
    expect(r.status).toBe(204);
    const followers = await request(app)
      .get("/v1/social/me/followers")
      .set(headers("priya@gmail.com"));
    expect(followers.body.length).toBe(0);
  });
});
