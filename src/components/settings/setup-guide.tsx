import type { ReactNode } from "react";
import { Database, Rocket, RefreshCw, ShieldAlert, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[12.5px] break-all">{children}</code>;
}

function Block({ children }: { children: ReactNode }) {
  return (
    <pre className="mt-1.5 overflow-x-auto rounded-lg bg-foreground/[0.04] p-3 font-mono text-[12px] leading-relaxed text-foreground/80">
      {children}
    </pre>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-black/5 bg-muted/20 p-4">
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-brand-dark">{icon} {title}</h3>
      <ol className="space-y-2.5 text-sm text-foreground/75">{children}</ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand-dark">{n}</span>
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </li>
  );
}

/**
 * Static, global-admin-only reference for re-wiring the app to a new Supabase
 * database and/or Vercel deployment. Intentionally contains NO secrets and no
 * inputs — connection strings/passwords live only in env vars, never in the app.
 */
export function SetupGuide() {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold text-brand-dark">Connect a new Supabase / Vercel</h2>
          <p className="mt-1 text-sm text-foreground/55">
            Step-by-step for pointing this app at a fresh database or deployment.
          </p>
        </div>

        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>
            Connection strings contain your database password, so they live <strong>only</strong> in
            environment variables — the <Code>.env</Code> file locally and Vercel&apos;s env vars in
            production. Never paste them into the app or store them in the database.
          </p>
        </div>

        <Section icon={<Database size={16} />} title="A · New Supabase database">
          <Step n={1}>
            <p>Create the project and note its <strong>region</strong> (e.g. Mumbai / <Code>ap-south-1</Code>).</p>
          </Step>
          <Step n={2}>
            <p>In Supabase: <strong>Connect → Connection pooling</strong>. Copy the IPv4 pooler URIs (host <Code>aws-…pooler.supabase.com</Code>, not the direct <Code>db.*.supabase.co</Code> host, which is IPv6-only). To avoid mixing them up:</p>
            <p>• <strong>Transaction pooler</strong> — port <Code>6543</Code> → this is your <Code>DATABASE_URL</Code></p>
            <p>• <strong>Session pooler</strong> — port <Code>5432</Code> → this is your <Code>DIRECT_URL</Code></p>
          </Step>
          <Step n={3}>
            <p>Set them in <Code>.env</Code> (URL-encode special chars in the password, e.g. <Code>@</Code> → <Code>%40</Code>). <strong>Add <Code>?pgbouncer=true</Code> to the end of the Transaction pooler / <Code>DATABASE_URL</Code></strong> — the Session pooler / <Code>DIRECT_URL</Code> has no such suffix:</p>
            <Block>{`# Transaction pooler (6543) — note the ?pgbouncer=true
DATABASE_URL="…pooler…:6543/postgres?pgbouncer=true"

# Session pooler (5432) — no suffix
DIRECT_URL="…pooler…:5432/postgres"`}</Block>
          </Step>
          <Step n={4}>
            <p>Create the tables in the empty database:</p>
            <Block>npm run db:push</Block>
          </Step>
          <Step n={5}>
            <p>Create the admin account (only the admin — no demo data):</p>
            <Block>npm run db:seed</Block>
            <p className="text-xs text-foreground/50">Login: <Code>global@admin.in</Code> / <Code>admin123</Code> — change this password after first sign-in.</p>
          </Step>
          <Step n={6}>
            <p>Match the deploy region to the DB region in <Code>vercel.json</Code> (see region codes below):</p>
            <Block>{`{ "regions": ["bom1"] }`}</Block>
          </Step>
        </Section>

        <Section icon={<Rocket size={16} />} title="B · Deploy / switch Vercel">
          <Step n={1}>
            <p>Vercel → Project → <strong>Settings → Environment Variables</strong>. Set these for Production (and Preview), then redeploy:</p>
            <Block>{`DATABASE_URL      = transaction pooler (6543)
DIRECT_URL        = session pooler (5432)
AUTH_SECRET       = a long random string
AUTH_TRUST_HOST   = true`}</Block>
          </Step>
          <Step n={2}>
            <p>Redeploy. The region is already pinned by <Code>vercel.json</Code>, so functions sit next to the database.</p>
          </Step>
        </Section>

        <Section icon={<RefreshCw size={16} />} title="C · After any switch (do every time)">
          <Step n={1}>
            <p><strong>Sign out and back in on every device</strong> (phone + PC). Old sessions point at users that no longer exist and will fail to save.</p>
          </Step>
          <Step n={2}>
            <p>Change the default admin password in <strong>Settings → User management</strong>.</p>
          </Step>
          <Step n={3}>
            <p>For local phone testing over WiFi, the PC&apos;s LAN IP must be allowed in <Code>next.config.ts</Code> (<Code>serverActions.allowedOrigins</Code>). Update it if your PC&apos;s IP changes.</p>
          </Step>
        </Section>

        <Section icon={<MapPin size={16} />} title="Vercel region codes">
          <li className="text-sm text-foreground/75">
            Pick the one nearest your Supabase region: <Code>bom1</Code> Mumbai · <Code>sin1</Code> Singapore · <Code>hnd1</Code> Tokyo · <Code>iad1</Code> US East · <Code>fra1</Code> Frankfurt.
          </li>
        </Section>
      </CardContent>
    </Card>
  );
}
