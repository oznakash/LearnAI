import { useState } from "react";
import { useAdmin } from "./AdminContext";
import type { EmailProvider, EmailTemplate, EmailTemplateId } from "./types";
import { renderEmail, sampleTemplateVars } from "./store";

const ALL_PROVIDERS: EmailProvider[] = [
  "smtp-our-server",
  "resend",
  "smtp-relay",
  "emailjs",
  "postmark",
  "sendgrid",
  "ses",
  "none",
];


export function AdminEmails() {
  const { config, setConfig, updateTemplate, toggleTemplate, flushQueue, sendTestEmail } = useAdmin();
  const templateIds = Object.keys(config.emailTemplates) as EmailTemplateId[];
  const [activeId, setActiveId] = useState<EmailTemplateId>(templateIds[0]);
  const tpl = config.emailTemplates[activeId];

  const setProvider = (provider: EmailProvider) =>
    setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, provider } }));

  const setSmtpField = (
    key: "host" | "port" | "secure" | "username" | "password",
    value: string | number | boolean
  ) =>
    setConfig((cfg) => ({
      ...cfg,
      emailConfig: {
        ...cfg.emailConfig,
        smtp: {
          host: cfg.emailConfig.smtp?.host ?? "",
          port: cfg.emailConfig.smtp?.port ?? 587,
          secure: cfg.emailConfig.smtp?.secure ?? true,
          username: cfg.emailConfig.smtp?.username ?? "",
          password: cfg.emailConfig.smtp?.password ?? "",
          [key]: value,
        },
      },
    }));

  const setEmailJs = (key: "serviceId" | "templateId" | "userId", value: string) =>
    setConfig((cfg) => ({
      ...cfg,
      emailConfig: {
        ...cfg.emailConfig,
        emailjs: {
          serviceId: cfg.emailConfig.emailjs?.serviceId ?? "",
          templateId: cfg.emailConfig.emailjs?.templateId ?? "",
          userId: cfg.emailConfig.emailjs?.userId ?? "",
          [key]: value,
        },
      },
    }));

  const queued = config.emailQueue.filter((q) => q.status === "queued").length;
  const sent = config.emailQueue.filter((q) => q.status === "sent").length;
  const failed = config.emailQueue.filter((q) => q.status === "failed").length;

  const [testTo, setTestTo] = useState("");
  const [testStatus, setTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [flushing, setFlushing] = useState(false);

  const onTest = async () => {
    if (!testTo) return;
    setTestStatus(null);
    const r = await sendTestEmail(testTo.trim(), activeId);
    setTestStatus({ ok: r.ok, msg: r.ok ? "Sent ✓" : `Failed: ${r.error ?? "unknown"}` });
  };

  const onFlush = async () => {
    setFlushing(true);
    try {
      await flushQueue();
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="h2">Email provider</h3>
            <p className="muted text-xs">
              Browser-friendly providers: <strong>Resend</strong>, <strong>EmailJS</strong>, or your own{" "}
              <strong>SMTP relay</strong> (POST endpoint that speaks SMTP). Postmark / SendGrid / SES need a server-side relay.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="chip bg-warn/10 text-warn border-warn/30">queued · {queued}</span>
            <span className="chip bg-good/10 text-good border-good/30">sent · {sent}</span>
            <span className="chip bg-bad/10 text-bad border-bad/30">failed · {failed}</span>
            <button className="btn-primary text-xs" onClick={onFlush} disabled={flushing || queued === 0}>
              {flushing ? "Sending…" : `📤 Send queue (${queued})`}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-2 mt-3">
          {ALL_PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`p-3 rounded-xl border text-center ${
                config.emailConfig.provider === p
                  ? "bg-accent/15 border-accent shadow-glow"
                  : "bg-white/5 border-white/10 hover:border-white/30"
              }`}
            >
              <div className="text-2xl">{providerEmoji(p)}</div>
              <div className="font-semibold text-white text-sm">{providerLabel(p)}</div>
            </button>
          ))}
        </div>

        {/* Provider-specific fields */}
        {config.emailConfig.provider === "smtp-our-server" && (
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            <p className="text-[11px] text-white/70 sm:col-span-2">
              ✓ No browser-side credentials. The SPA POSTs to{" "}
              <code className="text-white/90">/v1/email/send</code> on the social-svc sidecar
              (same container as the SPA). The sidecar uses nodemailer with SMTP creds from
              env vars (<code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code>,{" "}
              <code>SMTP_FROM_EMAIL</code>) — set on cloud-claude. Admin-only on the server side
              (your Gmail must be in <code>SOCIAL_ADMIN_EMAILS</code>). The From / Reply-To shown
              below are sent in the request and override the server defaults if set.
            </p>
            <Field
              label="From name"
              value={config.emailConfig.fromName}
              placeholder="LearnAI"
              onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, fromName: v } }))}
            />
            <Field
              label="Reply-To (optional)"
              value={config.emailConfig.replyTo ?? ""}
              placeholder="support@useyl.com"
              onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, replyTo: v } }))}
            />
          </div>
        )}

        {config.emailConfig.provider === "resend" && (
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            <Field
              label="Resend API key"
              value={config.emailConfig.apiKey ?? ""}
              type="password"
              placeholder="re_…"
              onChange={(v) =>
                setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, apiKey: v } }))
              }
            />
            <p className="text-[11px] text-white/50 sm:col-span-2">
              Get a key at <a className="underline" href="https://resend.com" target="_blank" rel="noreferrer">resend.com</a>.
              Verify the sending domain there before sending. Calls are made from the browser via{" "}
              <code className="text-[10px]">POST https://api.resend.com/emails</code>.
            </p>
          </div>
        )}

        {config.emailConfig.provider === "smtp-relay" && (
          <div className="space-y-3 mt-2">
            <Field
              label="Webhook URL"
              value={config.emailConfig.webhookUrl ?? ""}
              placeholder="https://your-relay.example.com/send"
              onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, webhookUrl: v } }))}
            />
            <Field
              label="Webhook auth (optional, sent as Bearer)"
              value={config.emailConfig.webhookAuth ?? ""}
              type="password"
              onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, webhookAuth: v } }))}
            />
            <p className="text-[11px] text-white/50">
              The relay receives a JSON POST with{" "}
              <code className="text-[10px]">{`{ from, to, subject, html, replyTo, smtp, templateId }`}</code> and is
              responsible for actually opening an SMTP connection. Recommended: keep your real SMTP password
              server-side and ignore the <code>smtp</code> block from this request.
            </p>

            <details className="text-xs text-white/70 mt-2">
              <summary className="cursor-pointer hover:text-white">Or paste SMTP credentials here (forwarded to your relay)</summary>
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                <Field label="SMTP host" value={config.emailConfig.smtp?.host ?? ""} placeholder="smtp.example.com" onChange={(v) => setSmtpField("host", v)} />
                <Field label="Port" value={String(config.emailConfig.smtp?.port ?? 587)} onChange={(v) => setSmtpField("port", Number(v) || 587)} />
                <Field label="Username" value={config.emailConfig.smtp?.username ?? ""} onChange={(v) => setSmtpField("username", v)} />
                <Field label="Password" value={config.emailConfig.smtp?.password ?? ""} type="password" onChange={(v) => setSmtpField("password", v)} />
                <label className="flex items-center gap-2 sm:col-span-2 text-sm mt-1">
                  <input
                    type="checkbox"
                    checked={!!config.emailConfig.smtp?.secure}
                    onChange={(e) => setSmtpField("secure", e.target.checked)}
                  />
                  TLS / secure connection
                </label>
                <p className="text-[11px] text-bad/80 sm:col-span-2">
                  ⚠️ The password is stored in localStorage. Treat this as a development convenience; in production keep
                  the password server-side only and pass it from there.
                </p>
              </div>
            </details>
          </div>
        )}

        {config.emailConfig.provider === "emailjs" && (
          <div className="grid sm:grid-cols-3 gap-2 mt-2">
            <Field
              label="Service ID"
              value={config.emailConfig.emailjs?.serviceId ?? ""}
              placeholder="service_…"
              onChange={(v) => setEmailJs("serviceId", v)}
            />
            <Field
              label="Template ID"
              value={config.emailConfig.emailjs?.templateId ?? ""}
              placeholder="template_…"
              onChange={(v) => setEmailJs("templateId", v)}
            />
            <Field
              label="Public User ID"
              value={config.emailConfig.emailjs?.userId ?? ""}
              placeholder="user_…"
              onChange={(v) => setEmailJs("userId", v)}
            />
            <p className="text-[11px] text-white/50 sm:col-span-3">
              Create an EmailJS service + template at{" "}
              <a className="underline" href="https://www.emailjs.com" target="_blank" rel="noreferrer">emailjs.com</a>{" "}
              with parameters <code>to_email</code>, <code>subject</code>, <code>body</code>. Browser-safe by design.
            </p>
          </div>
        )}

        {(config.emailConfig.provider === "postmark" ||
          config.emailConfig.provider === "sendgrid" ||
          config.emailConfig.provider === "ses") && (
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            <Field
              label={`${providerLabel(config.emailConfig.provider)} API key`}
              value={config.emailConfig.apiKey ?? ""}
              type="password"
              onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, apiKey: v } }))}
              placeholder={apiKeyPlaceholder(config.emailConfig.provider)}
            />
            <p className="text-[11px] text-warn sm:col-span-2">
              {providerLabel(config.emailConfig.provider)} doesn't accept browser-origin requests safely — wire it through your
              own backend (or use the <strong>SMTP relay</strong> option above, which is provider-agnostic).
            </p>
          </div>
        )}

        {config.emailConfig.provider === "none" && (
          <p className="text-xs text-white/50 mt-3">
            No provider selected. Lifecycle emails will queue but not send. You can still use <em>Send queue</em> to
            replay them later.
          </p>
        )}

        <div className="grid sm:grid-cols-3 gap-2 mt-4">
          <Field label="From name" value={config.emailConfig.fromName} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, fromName: v } }))} />
          <Field label="From email" value={config.emailConfig.fromEmail} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, fromEmail: v } }))} />
          <Field label="Reply-to (optional)" value={config.emailConfig.replyTo ?? ""} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, replyTo: v } }))} />
        </div>
      </section>

      <section className="card p-4">
        <h3 className="font-display font-semibold text-white">Send a test</h3>
        <p className="muted text-xs">Sends the currently selected template (below) using the live provider.</p>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2 mt-2">
          <input
            className="input"
            placeholder="recipient@gmail.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button className="btn-primary" onClick={onTest} disabled={!testTo}>
            ✉ Send test
          </button>
        </div>
        {testStatus && (
          <div className={`text-xs mt-2 ${testStatus.ok ? "text-good" : "text-bad"}`}>{testStatus.msg}</div>
        )}
      </section>

      <section className="grid lg:grid-cols-[260px_1fr] gap-4">
        <div className="card p-2 space-y-1 max-h-[640px] overflow-y-auto scroll-fade">
          {templateIds.map((id) => {
            const t = config.emailTemplates[id];
            const active = id === activeId;
            return (
              <button
                key={id}
                onClick={() => setActiveId(id)}
                className={`w-full text-left p-3 rounded-xl transition ${
                  active ? "bg-accent/15 border border-accent" : "border border-white/5 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  <span className={`text-[10px] ${t.enabled ? "text-good" : "text-white/40"}`}>
                    {t.enabled ? "ON" : "off"}
                  </span>
                </div>
                <div className="text-[11px] text-white/50 mt-0.5">{t.trigger}</div>
              </button>
            );
          })}
        </div>

        <TemplateEditor
          tpl={tpl}
          onUpdate={updateTemplate}
          onToggle={(en) => toggleTemplate(tpl.id, en)}
        />
      </section>

      <section className="card p-5 space-y-4">
        <header>
          <h3 className="font-display font-semibold text-white">Email policy</h3>
          <p className="text-xs text-white/60">
            Anti-spam rules applied to every send. Cap, dedupe by priority,
            auto-flush, unsubscribe, open-tracking, pause-on-unread. All
            persisted in the admin config.
          </p>
        </header>
        <PolicyControls />
      </section>

      {config.emailQueue.length > 0 && (
        <section className="card p-4">
          <h3 className="font-display font-semibold text-white">Queue (latest 50)</h3>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs">
              <thead className="text-white/50">
                <tr>
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">To</th>
                  <th className="text-left p-2">Subject</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {config.emailQueue.slice(0, 50).map((q) => (
                  <tr key={q.id} className="border-t border-white/5">
                    <td className="p-2 text-white/60 whitespace-nowrap">{new Date(q.queuedAt).toLocaleString()}</td>
                    <td className="p-2 text-white">{q.to}</td>
                    <td className="p-2 text-white/80">{q.subjectRendered}</td>
                    <td className="p-2">
                      <span
                        className={`chip text-[10px] ${
                          q.status === "sent"
                            ? "bg-good/10 text-good border-good/30"
                            : q.status === "failed"
                            ? "bg-bad/10 text-bad border-bad/30"
                            : q.status === "superseded" ||
                              q.status === "rate-limited" ||
                              q.status === "paused"
                            ? "bg-white/5 text-white/60 border-white/15"
                            : q.status === "unsubscribed"
                            ? "bg-bad/10 text-bad border-bad/30"
                            : "bg-warn/10 text-warn border-warn/30"
                        }`}
                      >
                        {q.status}
                      </span>
                      {q.error && <div className="text-bad text-[10px] mt-0.5">{q.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function TemplateEditor({
  tpl,
  onUpdate,
  onToggle,
}: {
  tpl: EmailTemplate;
  onUpdate: (t: EmailTemplate) => void;
  onToggle: (enabled: boolean) => void;
}) {
  const { config } = useAdmin();
  const sample = sampleTemplateVars(config);
  const rendered = renderEmail(tpl, sample);

  return (
    <div className="card p-4 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-white/50">{tpl.trigger}</div>
          <h3 className="h2">{tpl.name}</h3>
          <p className="muted text-xs">{tpl.description}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tpl.enabled} onChange={(e) => onToggle(e.target.checked)} />
          enabled
        </label>
      </header>

      <div>
        <div className="label">Subject</div>
        <input
          className="input"
          value={tpl.subject}
          onChange={(e) => onUpdate({ ...tpl, subject: e.target.value })}
        />
      </div>

      <div>
        <div className="label">HTML body</div>
        <textarea
          className="input min-h-[200px] font-mono text-xs"
          value={tpl.body}
          onChange={(e) => onUpdate({ ...tpl, body: e.target.value })}
        />
        <p className="text-[11px] text-white/50 mt-1">
          Use <code>{`{{firstName}}`}</code>, <code>{`{{streak}}`}</code>, <code>{`{{appName}}`}</code>,{" "}
          <code>{`{{appUrl}}`}</code>, <code>{`{{accent}}`}</code>, <code>{`{{tier}}`}</code>, etc. Sample variables in
          the preview below.
        </p>
      </div>

      <section className="space-y-2">
        <div className="label">Live preview</div>
        <div className="rounded-xl border border-white/10 overflow-hidden bg-white">
          <div className="p-3 border-b border-black/10 text-xs text-black/60">
            <strong className="text-black">Subject:</strong> {rendered.subject || "(empty)"}
          </div>
          <iframe title={`preview-${tpl.id}`} sandbox="" srcDoc={rendered.body} className="w-full h-[420px] bg-white" />
        </div>
        <details className="text-xs text-white/60">
          <summary className="cursor-pointer hover:text-white">Sample template variables</summary>
          <pre className="mt-2 p-2 rounded bg-black/40 border border-white/10 text-[11px] overflow-x-auto">
            {JSON.stringify(sample, null, 2)}
          </pre>
        </details>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <input
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function providerLabel(p: EmailProvider): string {
  switch (p) {
    case "smtp-our-server": return "Our SMTP server";
    case "smtp-relay": return "SMTP relay (webhook)";
    case "resend": return "Resend";
    case "emailjs": return "EmailJS";
    case "postmark": return "Postmark";
    case "sendgrid": return "SendGrid";
    case "ses": return "Amazon SES";
    case "none": return "None (queue only)";
  }
}

function providerEmoji(p: EmailProvider): string {
  switch (p) {
    case "smtp-our-server": return "🏠";
    case "smtp-relay": return "📨";
    case "resend": return "🟣";
    case "emailjs": return "✉️";
    case "postmark": return "🟡";
    case "sendgrid": return "🔵";
    case "ses": return "☁️";
    case "none": return "🚫";
  }
}

function apiKeyPlaceholder(p: EmailProvider): string {
  switch (p) {
    case "resend": return "re_…";
    case "postmark": return "Server token";
    case "sendgrid": return "SG.…";
    case "ses": return "AWS access key id";
    default: return "API key";
  }
}

function PolicyControls() {
  const { config, setConfig } = useAdmin();
  const policy = config.emailPolicy;
  const set = (mut: (p: typeof policy) => typeof policy) =>
    setConfig((c) => ({ ...c, emailPolicy: mut(c.emailPolicy) }));
  return (
    <div className="grid sm:grid-cols-2 gap-3 text-sm">
      <Toggle
        label="Master switch"
        hint="When off, every queued email sends immediately with no policy applied."
        value={policy.enabled}
        onChange={(v) => set((p) => ({ ...p, enabled: v }))}
      />
      <Toggle
        label="Auto-flush queue"
        hint="When on, queued emails send automatically after the debounce window. When off, only the manual button sends."
        value={policy.autoFlushEnabled}
        onChange={(v) => set((p) => ({ ...p, autoFlushEnabled: v }))}
      />
      <NumberInput
        label="Cap per recipient (hours)"
        hint="At most one email per recipient per this many hours."
        min={1}
        max={720}
        value={policy.capPerWindowHours}
        onChange={(v) => set((p) => ({ ...p, capPerWindowHours: v }))}
      />
      <NumberInput
        label="Auto-flush debounce (s)"
        hint="Wait this long after the last queue event before sending. Lets us pick the best of competing sends."
        min={0}
        max={600}
        value={policy.autoFlushDebounceSeconds}
        onChange={(v) => set((p) => ({ ...p, autoFlushDebounceSeconds: v }))}
      />
      <Toggle
        label="Transactional bypasses cap"
        hint="When on, welcome / first-spark / level-up / boss-beaten / streak-save can send even inside the rate-limit window. Off by default — operator caution."
        value={policy.transactionalBypass}
        onChange={(v) => set((p) => ({ ...p, transactionalBypass: v }))}
      />
      <Toggle
        label="Append unsubscribe link"
        hint="One-click unsubscribe footer + RFC 8058 List-Unsubscribe header (so Gmail's native pill shows up)."
        value={policy.appendUnsubscribe}
        onChange={(v) => set((p) => ({ ...p, appendUnsubscribe: v }))}
      />
      <Toggle
        label="Append open-tracking pixel"
        hint="1×1 transparent PNG that records email opens. Used to drive the pause-on-unread cooldown."
        value={policy.appendOpenPixel}
        onChange={(v) => set((p) => ({ ...p, appendOpenPixel: v }))}
      />
      <Toggle
        label="Pause sends on N unreads"
        hint="If the user gets N consecutive emails without opening any, pause sends to them for `pauseDurationDays`."
        value={policy.pauseOnUnreadEnabled}
        onChange={(v) => set((p) => ({ ...p, pauseOnUnreadEnabled: v }))}
      />
      <NumberInput
        label="Unread count to pause"
        min={1}
        max={10}
        value={policy.pauseOnUnreadCount}
        onChange={(v) => set((p) => ({ ...p, pauseOnUnreadCount: v }))}
      />
      <NumberInput
        label="Pause duration (days)"
        min={1}
        max={365}
        value={policy.pauseDurationDays}
        onChange={(v) => set((p) => ({ ...p, pauseDurationDays: v }))}
      />
      <div className="sm:col-span-2 text-xs text-white/50 border-t border-white/5 pt-3">
        Priority order (highest first):{" "}
        <code className="text-white/70">{policy.priorityOrder.join(" › ")}</code>
        <div className="text-white/40 mt-1">
          When two templates queue for the same recipient inside one flush window,
          the one earlier in this list wins; the rest are marked superseded.
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="text-sm text-white">{label}</div>
        {hint && <div className="text-[11px] text-white/50 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

function NumberInput({
  label,
  hint,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
      <span className="text-sm text-white">{label}</span>
      <input
        type="number"
        className="input"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
      />
      {hint && <span className="text-[11px] text-white/50">{hint}</span>}
    </label>
  );
}
