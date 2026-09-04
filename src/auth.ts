import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { googleAuthConfigured, isSuperadminEmail } from "@/lib/auth-config";

/*
 * Auth.js (NextAuth v5). Google is the only provider. JWT sessions (no
 * database adapter needed). When the Google env vars are absent this exports
 * a NextAuth with no providers, and the app falls back to local mock auth
 * (see src/lib/session.ts) -- /api/auth/* is simply never linked to.
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
    // Superadmins can always in. Everyone else needs an active row in the
    // access list (added by a superadmin from /admin) -- denying here stops
    // the sign-in before a session is ever created.
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      if (isSuperadminEmail(email)) {
        const { touchSignIn } = await import("@/lib/store");
        await touchSignIn(email, user.name ?? email);
        return true;
      }

      const { isAllowed, touchSignIn } = await import("@/lib/store");
      const allowed = await isAllowed(email);
      if (!allowed) return "/sign-in?error=AccessDenied";

      await touchSignIn(email, user.name ?? email);
      return true;
    },
  },
});
