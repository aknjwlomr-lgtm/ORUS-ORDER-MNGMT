import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAppName, getMasterLockdown, getAdminSectionAccess } from "@/lib/settings";
import { GLOBAL_ADMIN_EMAIL } from "@/lib/constants";
import { AppNameProvider } from "@/components/app-name-context";
import { Sidebar, MobileHeader, BottomNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // The lockdown check, app name and account lookup are independent — fetch them
  // together so the layout costs one DB round-trip, not three (matters on mobile).
  const isGlobalAdmin = session.user.email === GLOBAL_ADMIN_EMAIL;
  const [locked, appName, dbUser, adminAccess] = await Promise.all([
    isGlobalAdmin ? Promise.resolve(false) : getMasterLockdown(),
    getAppName(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, role: true, status: true },
    }),
    getAdminSectionAccess(),
  ]);

  // A JWT session can outlive its account: another admin may have reset the data
  // (which keeps only the admin who ran it) or removed/disabled this user. Never
  // show a stale or deleted identity — force a fresh login. Reading name/role
  // from the DB also keeps the nav in sync if the account was renamed.
  if (!dbUser || dbUser.status !== "ACTIVE") redirect("/login?expired=1");

  // Master lockdown: while on, everyone except the global admin is locked out
  // of the app (even with an existing session).
  if (locked) redirect("/login?locked=1");

  // Reports/Customers nav links: global admin always sees them; other admins only
  // when the global admin has enabled that area (Settings → Admin access).
  const user = {
    name: dbUser.name,
    role: dbUser.role,
    showReports: isGlobalAdmin || adminAccess.reports,
    showCustomers: isGlobalAdmin || adminAccess.customers,
  };

  return (
    <AppNameProvider value={appName}>
      <div className="flex min-h-dvh flex-1">
        <Sidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader user={user} />
          {/* pt/pb on mobile clear the fixed top header and bottom nav; desktop has neither. */}
        <main className="flex-1 pt-16 pb-20 md:pt-0 md:pb-4">{children}</main>
          <BottomNav user={user} />
        </div>
      </div>
    </AppNameProvider>
  );
}
