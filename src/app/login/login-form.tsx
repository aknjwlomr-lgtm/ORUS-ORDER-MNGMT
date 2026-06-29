"use client";

import { type FormEvent, useState } from "react";
import { getCsrfToken, getSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Fieldset } from "@/components/ui/field";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // We deliberately do NOT use next-auth's signIn() redirect handling.
      // In this setup NextAuth builds redirect URLs against http://localhost:3000
      // regardless of the request host, which breaks logins from a LAN IP / phone.
      // Instead we post the credentials ourselves with redirect:"manual" (so the
      // browser never tries to follow that bad redirect), then confirm via the
      // session and navigate on the current origin.
      const submittedEmail = email.trim().toLowerCase();
      const csrfToken = (await getCsrfToken()) ?? "";
      await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "same-origin",
        redirect: "manual",
        body: new URLSearchParams({
          csrfToken,
          email: submittedEmail,
          password,
        }),
      });

      // The Set-Cookie from the response above is applied by the browser even
      // for an opaque (manual) redirect, so the session is now established.
      // Only treat it as success if the session is actually for the account we
      // just submitted: a stale token for a different (e.g. deleted) account can
      // linger and would otherwise look like a successful login, sending the user
      // into the app only to be bounced straight back here in a loop.
      const session = await getSession();
      if (session?.user?.email?.toLowerCase() === submittedEmail) {
        window.location.href = "/orders";
        return;
      }
      setError("Invalid email or password.");
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Fieldset label="Email" required>
            <Input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Fieldset>
          <Fieldset label="Password" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Fieldset>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
