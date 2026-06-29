import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAppName, getMasterLockdown } from "@/lib/settings";
import { GLOBAL_ADMIN_EMAIL } from "@/lib/constants";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; locked?: string; expired?: string }>;
}) {
  const session = await auth();
  const locked = await getMasterLockdown();
  const isGlobalAdmin = session?.user?.email === GLOBAL_ADMIN_EMAIL;

  // A token only counts as a real session if its account still exists and is
  // active — a data reset or removal can leave a valid token for a user who's
  // gone. An invalid one must re-authenticate (and not be bounced into the app,
  // which would loop with the layout's redirect back here).
  const account = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { status: true } })
    : null;
  const sessionValid = !!account && account.status === "ACTIVE";

  // Don't bounce a locked-out (non-global) session back into the app — that would
  // loop with the app layout's lockdown redirect. Let them sit on the login page.
  if (sessionValid && (isGlobalAdmin || !locked)) redirect("/orders");
  const sp = await searchParams;
  const appName = await getAppName();
  const initialError =
    sp.error === "CredentialsSignin" ? "Invalid email or password." : undefined;
  const lockedNotice = locked ? "Contact the system administrator." : undefined;
  const expiredNotice =
    sp.expired || (session?.user && !sessionValid)
      ? "Your previous session has ended. Please sign in again."
      : undefined;

  return (
    <div className="flex flex-1 items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-3xl shadow-sm">
            🎂
          </div>
          <h1 className="text-2xl font-bold text-brand-dark">{appName}</h1>
          <p className="text-sm text-foreground/60">Order Manager</p>
        </div>
        {lockedNotice && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
            🔒 {lockedNotice}
          </p>
        )}
        {expiredNotice && !lockedNotice && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
            {expiredNotice}
          </p>
        )}
        <LoginForm initialError={initialError} />
      </div>
    </div>
  );
}
