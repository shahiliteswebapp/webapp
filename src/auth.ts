import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { googleAuthConfigured } from "@/lib/auth-config";

/*
 * Auth.js (NextAuth v5). Google is the only provider. JWT sessions (no database
 * adapter needed). When the Google env vars are absent this exports a NextAuth
 * with no providers — the app falls back to local mock auth (see
 * src/lib/session.ts), so `/api/auth/*` is simply never linked to.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: googleAuthConfigured()
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : [],
  callbacks: {
    // Any Google account may sign in for now; the client will restrict this
    // to an employee allow-list later.
    signIn: () => true,
  },
});
