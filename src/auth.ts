import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { GLOBAL_ADMIN_EMAIL } from "@/lib/constants";
import { getMasterLockdown } from "@/lib/settings";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { branch: true },
        });
        if (!user || user.status !== "ACTIVE") return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Master lockdown: only the global admin can log in while it's on.
        if (user.email !== GLOBAL_ADMIN_EMAIL && (await getMasterLockdown())) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          branchId: user.branchId,
          branchName: user.branch?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        const u = user as { role?: string; branchId?: string | null; branchName?: string | null };
        token.role = u.role ?? "STAFF";
        token.branchId = u.branchId ?? null;
        token.branchName = u.branchName ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "STAFF";
        session.user.branchId = (token.branchId as string | null) ?? null;
        session.user.branchName = (token.branchName as string | null) ?? null;
      }
      return session;
    },
  },
});
