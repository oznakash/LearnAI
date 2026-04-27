import type { AdminConfig, EmailTemplate, EmailTemplateId } from "./types";

export const DEFAULT_TEMPLATES: Record<EmailTemplateId, EmailTemplate> = {
  welcome: {
    id: "welcome",
    name: "Welcome",
    description: "Sent right after the player completes onboarding.",
    enabled: true,
    trigger: "On profile created",
    subject: "Welcome to {{appName}}, {{firstName}} ⚡",
    body: `<table width="100%" style="font-family: Inter, system-ui, sans-serif; background:#0b1020; color:#e6e8f2; padding:32px;"><tr><td align="center">
<table width="560" style="background:#121833; border-radius:18px; padding:28px;">
<tr><td>
<div style="display:flex; align-items:center; gap:12px;">
  <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,{{accent}},{{accent2}}); display:inline-block; text-align:center; line-height:44px; color:white; font-weight:700;">{{logoEmoji}}</div>
  <strong style="font-size:18px;">{{appName}}</strong>
</div>
<h1 style="font-size:26px; line-height:1.2; margin:18px 0 8px;">Hey {{firstName}}, you're in.</h1>
<p style="color:#bcc1d6;">Your first quest is waiting. {{dailyMinutes}} minutes a day, real expertise.</p>
<a href="{{appUrl}}" style="display:inline-block; padding:12px 18px; background:{{accent}}; color:#fff; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">▶ Start your first Spark</a>
<p style="color:#9ba3c7; font-size:12px; margin-top:24px;">You picked: {{interestsList}}.</p>
</td></tr></table>
</td></tr></table>`,
  },
  "first-spark": {
    id: "first-spark",
    name: "First Spark celebration",
    description: "Sent after the first completed Spark.",
    enabled: true,
    trigger: "On first Spark complete",
    subject: "✨ First Spark, {{firstName}} — that's how it starts",
    body: `<table width="100%" style="font-family: Inter, sans-serif; background:#0b1020; color:#e6e8f2; padding:32px;"><tr><td align="center">
<table width="560" style="background:#121833; border-radius:18px; padding:28px;">
<tr><td>
<h1 style="margin:0 0 6px;">First Spark — locked in.</h1>
<p style="color:#bcc1d6;">+{{xp}} ⚡ Synapses earned. Keep going tomorrow to start a streak.</p>
<a href="{{appUrl}}" style="display:inline-block; padding:12px 18px; background:{{accent}}; color:#fff; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">Continue the path</a>
</td></tr></table>
</td></tr></table>`,
  },
  "daily-reminder": {
    id: "daily-reminder",
    name: "Daily reminder",
    description: "Daily nudge if the player hasn't completed a Spark today.",
    enabled: false,
    trigger: "Daily, if no Spark today",
    subject: "🔥 {{streak}}-day streak — keep it alive?",
    body: `<table width="100%" style="font-family: Inter, sans-serif; background:#0b1020; color:#e6e8f2; padding:32px;"><tr><td align="center">
<table width="560" style="background:#121833; border-radius:18px; padding:28px;">
<tr><td>
<h1 style="margin:0 0 6px;">5 minutes saves your streak.</h1>
<p style="color:#bcc1d6;">You're on a {{streak}}-day streak. One Spark today keeps it.</p>
<a href="{{appUrl}}" style="display:inline-block; padding:12px 18px; background:{{accent}}; color:#fff; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">▶ Save my streak</a>
</td></tr></table>
</td></tr></table>`,
  },
  "streak-save": {
    id: "streak-save",
    name: "Streak save (last call)",
    description: "Sent in the last hour before a streak resets.",
    enabled: true,
    trigger: "T-60min from streak reset",
    subject: "Last hour to save your {{streak}}-day streak 🔥",
    body: `<table width="100%" style="font-family: Inter, sans-serif; background:#0b1020; color:#e6e8f2; padding:32px;"><tr><td align="center">
<table width="560" style="background:#121833; border-radius:18px; padding:28px;">
<tr><td>
<h1 style="margin:0 0 6px;">One Spark. One hour. Your call.</h1>
<p style="color:#bcc1d6;">Don't lose all that compounding. We picked an easy one for you.</p>
<a href="{{appUrl}}" style="display:inline-block; padding:12px 18px; background:{{accent}}; color:#fff; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">Save my streak</a>
</td></tr></table>
</td></tr></table>`,
  },
  "weekly-digest": {
    id: "weekly-digest",
    name: "Weekly digest",
    description: "Sent every Sunday with the week's progress + 3 Pulse Sparks.",
    enabled: true,
    trigger: "Weekly, Sunday",
    subject: "Your {{appName}} week: {{xpThisWeek}} ⚡, {{sparksThisWeek}} Sparks",
    body: `<table width="100%" style="font-family: Inter, sans-serif; background:#0b1020; color:#e6e8f2; padding:32px;"><tr><td align="center">
<table width="560" style="background:#121833; border-radius:18px; padding:28px;">
<tr><td>
<h1 style="margin:0 0 6px;">Your week in {{appName}}</h1>
<p style="color:#bcc1d6;">{{xpThisWeek}} ⚡ · {{sparksThisWeek}} Sparks · {{minutesThisWeek}} minutes.</p>
<p style="color:#bcc1d6;">Top topic: <strong>{{topTopic}}</strong>.</p>
<a href="{{appUrl}}" style="display:inline-block; padding:12px 18px; background:{{accent}}; color:#fff; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">Open your dashboard</a>
</td></tr></table>
</td></tr></table>`,
  },
  "re-engagement": {
    id: "re-engagement",
    name: "Re-engagement (7d inactive)",
    description: "Sent after 7 days without a Spark.",
    enabled: true,
    trigger: "T+7 days inactive",
    subject: "Miss your build streak, {{firstName}}?",
    body: `<table width="100%" style="font-family: Inter, sans-serif; background:#0b1020; color:#e6e8f2; padding:32px;"><tr><td align="center">
<table width="560" style="background:#121833; border-radius:18px; padding:28px;">
<tr><td>
<h1 style="margin:0 0 6px;">Drop by — 5 minutes, that's all.</h1>
<p style="color:#bcc1d6;">AI moved while you were away. We've got 3 fresh Sparks ready.</p>
<a href="{{appUrl}}" style="display:inline-block; padding:12px 18px; background:{{accent}}; color:#fff; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">Catch up</a>
</td></tr></table>
</td></tr></table>`,
  },
  "level-up": {
    id: "level-up",
    name: "Level up celebration",
    description: "Sent on Guild Tier promotion.",
    enabled: true,
    trigger: "On Guild Tier increase",
    subject: "🏅 You're now {{tier}}",
    body: `<table width="100%" style="font-family: Inter, sans-serif; background:#0b1020; color:#e6e8f2; padding:32px;"><tr><td align="center">
<table width="560" style="background:#121833; border-radius:18px; padding:28px;">
<tr><td>
<h1 style="margin:0 0 6px;">{{firstName}} → {{tier}} 🏅</h1>
<p style="color:#bcc1d6;">{{xp}} ⚡ Synapses and counting. Next tier: {{nextTier}} at {{nextTierThreshold}} ⚡.</p>
<a href="{{appUrl}}" style="display:inline-block; padding:12px 18px; background:{{accent}}; color:#fff; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">Show off your badge</a>
</td></tr></table>
</td></tr></table>`,
  },
  "boss-beaten": {
    id: "boss-beaten",
    name: "Boss beaten",
    description: "Sent when a Boss Cell is passed.",
    enabled: true,
    trigger: "On Boss Cell pass",
    subject: "👾 Boss cell down — {{topicName}} L{{level}}",
    body: `<table width="100%" style="font-family: Inter, sans-serif; background:#0b1020; color:#e6e8f2; padding:32px;"><tr><td align="center">
<table width="560" style="background:#121833; border-radius:18px; padding:28px;">
<tr><td>
<h1 style="margin:0 0 6px;">Boss defeated.</h1>
<p style="color:#bcc1d6;">Level {{level}} of <strong>{{topicName}}</strong> is in the bag. The next level is unlocked.</p>
<a href="{{appUrl}}" style="display:inline-block; padding:12px 18px; background:{{accent}}; color:#fff; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">▶ Next level</a>
</td></tr></table>
</td></tr></table>`,
  },
};

export function defaultAdminConfig(): AdminConfig {
  return {
    bootstrapped: false,
    admins: [],
    branding: {
      appName: "BuilderQuest",
      tagline: "Level up. Build more.",
      accentColor: "#7c5cff",
      accent2Color: "#28e0b3",
      logoEmoji: "BQ",
    },
    flags: {
      allowDemoMode: true,
      allowPlayerApiKeys: true,
      publicLeaderboard: true,
      liveModeForApiKeyHolders: true,
      voiceMode: false,
      buildCardVerification: false,
    },
    defaultDailyMinutes: 10,
    perUserDailyTokenCap: 0,
    emailConfig: {
      provider: "none",
      fromName: "BuilderQuest",
      fromEmail: "no-reply@example.com",
    },
    emailTemplates: { ...DEFAULT_TEMPLATES },
    emailQueue: [],
  };
}
