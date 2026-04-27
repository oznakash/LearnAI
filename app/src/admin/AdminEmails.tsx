import { useState } from "react";
import { useAdmin } from "./AdminContext";
import type { EmailProvider, EmailTemplate, EmailTemplateId } from "./types";
import { renderEmail, sampleTemplateVars } from "./store";

export function AdminEmails() {
  const { config, setConfig, updateTemplate, toggleTemplate } = useAdmin();
  const templateIds = Object.keys(config.emailTemplates) as EmailTemplateId[];
  const [activeId, setActiveId] = useState<EmailTemplateId>(templateIds[0]);
  const tpl = config.emailTemplates[activeId];

  const setProvider = (provider: EmailProvider) =>
    setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, provider } }));

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h3 className="h2 mb-2">Email provider</h3>
        <p className="muted text-xs">For local-only mode this is metadata. In production, your backend reads this to route through the chosen provider.</p>
        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          {(["resend", "postmark", "sendgrid", "ses", "smtp", "none"] as EmailProvider[]).map((p) => (
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

        {config.emailConfig.provider === "smtp" ? (
          <div className="grid sm:grid-cols-2 gap-2 mt-4">
            <Field label="SMTP host" value={config.emailConfig.smtp?.host ?? ""} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, smtp: { ...(cfg.emailConfig.smtp ?? { host: "", port: 587, secure: true, username: "", password: "" }), host: v } } }))} placeholder="smtp.example.com" />
            <Field label="Port" value={String(config.emailConfig.smtp?.port ?? 587)} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, smtp: { ...(cfg.emailConfig.smtp ?? { host: "", port: 587, secure: true, username: "", password: "" }), port: Number(v) || 587 } } }))} />
            <Field label="Username" value={config.emailConfig.smtp?.username ?? ""} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, smtp: { ...(cfg.emailConfig.smtp ?? { host: "", port: 587, secure: true, username: "", password: "" }), username: v } } }))} />
            <Field label="Password" value={config.emailConfig.smtp?.password ?? ""} type="password" onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, smtp: { ...(cfg.emailConfig.smtp ?? { host: "", port: 587, secure: true, username: "", password: "" }), password: v } } }))} />
            <label className="flex items-center gap-2 sm:col-span-2 text-sm mt-1">
              <input
                type="checkbox"
                checked={!!config.emailConfig.smtp?.secure}
                onChange={(e) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, smtp: { ...(cfg.emailConfig.smtp ?? { host: "", port: 587, secure: true, username: "", password: "" }), secure: e.target.checked } } }))}
              />
              TLS / secure connection
            </label>
            <p className="text-[11px] text-bad/80 sm:col-span-2">⚠️ The password is stored in localStorage for demo. In production, persist server-side only.</p>
          </div>
        ) : config.emailConfig.provider !== "none" ? (
          <div className="grid sm:grid-cols-2 gap-2 mt-4">
            <Field
              label={`${providerLabel(config.emailConfig.provider)} API key`}
              value={config.emailConfig.apiKey ?? ""}
              type="password"
              onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, apiKey: v } }))}
              placeholder={apiKeyPlaceholder(config.emailConfig.provider)}
            />
          </div>
        ) : (
          <p className="text-xs text-white/50 mt-3">No provider selected. Lifecycle emails will queue but not send.</p>
        )}

        <div className="grid sm:grid-cols-3 gap-2 mt-4">
          <Field label="From name" value={config.emailConfig.fromName} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, fromName: v } }))} />
          <Field label="From email" value={config.emailConfig.fromEmail} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, fromEmail: v } }))} />
          <Field label="Reply-to (optional)" value={config.emailConfig.replyTo ?? ""} onChange={(v) => setConfig((cfg) => ({ ...cfg, emailConfig: { ...cfg.emailConfig, replyTo: v } }))} />
        </div>
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
                  <span className={`text-[10px] ${t.enabled ? "text-good" : "text-white/40"}`}>{t.enabled ? "ON" : "off"}</span>
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
        <p className="text-[11px] text-white/50 mt-1">Use <code>{`{{firstName}}`}</code>, <code>{`{{streak}}`}</code>, <code>{`{{appName}}`}</code>, <code>{`{{appUrl}}`}</code>, <code>{`{{accent}}`}</code>, <code>{`{{tier}}`}</code>, etc. See sample variables in the preview.</p>
      </div>

      <section className="space-y-2">
        <div className="label">Live preview</div>
        <div className="rounded-xl border border-white/10 overflow-hidden bg-white">
          <div className="p-3 border-b border-black/10 text-xs text-black/60">
            <strong className="text-black">Subject:</strong> {rendered.subject || "(empty)"}
          </div>
          <iframe
            title={`preview-${tpl.id}`}
            sandbox=""
            srcDoc={rendered.body}
            className="w-full h-[420px] bg-white"
          />
        </div>
        <details className="text-xs text-white/60">
          <summary className="cursor-pointer hover:text-white">Sample template variables</summary>
          <pre className="mt-2 p-2 rounded bg-black/40 border border-white/10 text-[11px] overflow-x-auto">{JSON.stringify(sample, null, 2)}</pre>
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
    case "smtp": return "Generic SMTP";
    case "resend": return "Resend";
    case "postmark": return "Postmark";
    case "sendgrid": return "SendGrid";
    case "ses": return "Amazon SES";
    case "none": return "None (queue only)";
  }
}

function providerEmoji(p: EmailProvider): string {
  switch (p) {
    case "smtp": return "📨";
    case "resend": return "🟣";
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
