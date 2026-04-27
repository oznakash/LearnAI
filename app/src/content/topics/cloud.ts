import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "cloud" as const;

export const cloud: Topic = {
  id: T,
  name: "Cloud Computing",
  emoji: "☁️",
  tagline: "Where AI runs: compute, storage, networks, GPUs.",
  color: "#7c5cff",
  visual: "cloud",
  levels: [
    level(T, 1, "What 'the cloud' actually is", "Other people's computers, organized.", 4, [
      spark("Compute as a tap", {
        type: "microread",
        title: "Cloud = on-demand resources",
        body: "The cloud is a giant pool of compute, storage, and networking you rent by the second. AWS, GCP, Azure are the big three; Cloudflare, Fly, Render, Vercel sit on top with friendlier APIs. The point isn't 'someone else's computer' — it's the elasticity: scale to a million users by 5pm, scale to zero by midnight, pay for what you used.",
        takeaway: "Elastic + pay-per-use = the cloud's real magic.",
        visual: "cloud",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "What's the biggest practical advantage of cloud over your own server?",
        options: ["Cheaper always", "Elasticity — scale up and back down on demand", "Better hardware", "Lower latency"],
        answer: 1,
        explain: "Elasticity is the killer feature.",
      }),
    ]),
    level(T, 2, "IaaS vs PaaS vs SaaS", "Three layers of abstraction.", 4, [
      spark("Pizza analogy", {
        type: "microread",
        title: "The classic stack",
        body: "IaaS (EC2, GCE) = you rent the kitchen, you cook everything. PaaS (Vercel, Render, Fly) = you rent a kitchen with a stove ready, you bring ingredients. SaaS (Notion, Slack) = food delivered. Modern teams sit on PaaS for speed, drop to IaaS only when forced. Each layer trades control for speed.",
        takeaway: "PaaS by default. IaaS only when you must.",
      }),
      spark("Pattern match", {
        type: "patternmatch",
        prompt: "Match each example to its layer",
        pairs: [
          { left: "AWS EC2 instance", right: "IaaS" },
          { left: "Vercel hosting", right: "PaaS" },
          { left: "Notion", right: "SaaS" },
          { left: "GCP Cloud Run", right: "PaaS" },
        ],
        explain: "More managed = higher up the stack.",
      }),
    ]),
    level(T, 3, "Containers + serverless", "Two ways to ship.", 4, [
      spark("Docker in 60 seconds", {
        type: "microread",
        title: "Containers + serverless",
        body: "A container packages your app + deps in one runnable unit. Run it anywhere — Docker, Kubernetes, Cloud Run, ECS. Serverless (Lambda, Cloud Functions) goes further: no container, no server, just a function that runs on request. Serverless wins for spiky/cheap workloads. Containers win when you need control or steady traffic.",
        takeaway: "Containers = portable. Serverless = automatic scale.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "For new AI products, start on a simple PaaS (Render, Fly, Vercel). Don't touch Kubernetes until you have a real reason — it eats months of your life otherwise.",
      }),
    ]),
    level(T, 4, "GPUs and AI compute", "Why your AI bill is huge.", 4, [
      spark("H100s and friends", {
        type: "microread",
        title: "Why GPUs cost so much",
        body: "AI inference and training need massive parallel matrix math. GPUs (and now NPUs/TPUs) do this thousands of times faster than CPUs. An H100 GPU rents for $2-8/hour. For inference, providers (Anthropic, Together, Replicate, Fireworks) handle this for you. For training or self-hosting, you'll feel the bill.",
        takeaway: "Use API providers unless you have a strong reason to self-host.",
        visual: "chip",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "Cheapest path to ship an AI app today?",
        options: ["Buy your own GPUs", "Use API providers (Anthropic/OpenAI/etc.)", "Train your own model", "Wait for cheaper hardware"],
        answer: 1,
        explain: "API providers handle the GPU complexity for you.",
      }),
    ]),
    level(T, 5, "Storage tiers", "Hot, warm, cold.", 4, [
      spark("Match storage to access", {
        type: "microread",
        title: "Don't pay hot prices for cold data",
        body: "S3 Standard ≈ instant access, premium price. S3 Infrequent Access ≈ retrieved monthly. Glacier ≈ retrieved yearly, near-zero cost. Same files, 90%+ cost difference. Move logs and old artifacts to cold tiers automatically (lifecycle policies). For databases, archive cold tables out of your primary DB.",
        takeaway: "Lifecycle policies = invisible cost wins.",
      }),
    ]),
    level(T, 6, "Latency basics", "Where slow comes from.", 4, [
      spark("The latency budget", {
        type: "microread",
        title: "Speed-of-light is a real constraint",
        body: "Cross-region API calls add 50-200ms. Database queries 1-50ms. LLM calls often 500-3000ms. Build a 'latency budget': decide how much of your user-perceived time each layer can spend. Move user-facing inference to the same region as users. Cache aggressively.",
        takeaway: "Latency budget per request. Cache to stay inside it.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Stream LLM responses to users token-by-token. Same total latency, but feels 5x faster because they see progress.",
      }),
    ]),
    level(T, 7, "Networking essentials", "VPCs, CDNs, edges.", 4, [
      spark("VPC + CDN + edge", {
        type: "microread",
        title: "Three networking primitives",
        body: "VPC = your private network in the cloud (isolation, security). CDN = serve static stuff from 200+ edge locations near users (Cloudflare, Akamai). Edge functions = run small code at those edge locations (low latency rewrites, auth checks). Most AI apps need all three.",
        takeaway: "VPC isolates. CDN distributes. Edge runs fast.",
      }),
    ]),
    level(T, 8, "Cost guardrails", "Stop the runaway bill.", 4, [
      spark("Budgets + alerts", {
        type: "microread",
        title: "Set budgets day one",
        body: "Every cloud has billing alerts. Configure them on day one — daily, weekly, monthly thresholds. Tag every resource by team/feature so you know what's eating your money. Tag your AI calls too (prompt caching, model used, tenant_id) so you can attribute later.",
        takeaway: "Budgets + tags. Day one. Always.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Set a 'panic budget' at 2x your expected monthly spend that auto-kills suspicious workloads. Saved many a startup from a $40k inference bill from a bug.",
      }),
    ]),
    level(T, 9, "Disaster recovery", "When the region falls.", 4, [
      spark("Backups + multi-region", {
        type: "microread",
        title: "Backups, failover, RTO/RPO",
        body: "RTO = how fast can you recover. RPO = how much data loss is OK. Pick targets per system, design backups + failover to meet them. For most AI apps: nightly DB backups + cross-region read replica is enough. For payments or critical data: multi-region active-active.",
        takeaway: "Define RTO/RPO. Engineer to meet them.",
      }),
    ]),
    level(T, 10, "Boss: cloud check", "Final gate.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: Cloud",
        questions: [
          {
            type: "quickpick",
            prompt: "Best default for a brand-new AI side project?",
            options: ["AWS EC2 + custom Kubernetes", "Vercel/Render/Fly (PaaS)", "Buy your own server", "Heroku free tier"],
            answer: 1,
            explain: "PaaS first. Lower complexity per dollar.",
          },
          {
            type: "quickpick",
            prompt: "Inference latency feels slow even though API is fast. Most likely fix?",
            options: ["Bigger model", "Stream responses to user", "Add Kubernetes", "Cold-tier the DB"],
            answer: 1,
            explain: "Streaming = perceived speed.",
          },
          {
            type: "quickpick",
            prompt: "First cost guardrail to set up?",
            options: ["Negotiate enterprise", "Billing alerts + tags + a panic budget", "Move to a cheaper region", "Switch clouds"],
            answer: 1,
            explain: "Visibility + auto-stop. Day one.",
          },
        ],
      }),
    ]),
  ],
};
