import { redirect } from "next/navigation";
import {
  signInGoogleAction,
  signInMockAction,
} from "@/lib/actions/auth";
import { googleAuthConfigured } from "@/lib/auth-config";
import { getSession } from "@/lib/session";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui";

export const metadata = { title: "Sign in · Shahi Lites" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;
  const googleMode = googleAuthConfigured();

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Wordmark subtitle={false} className="justify-center" />
          <p className="eyebrow mt-2">Employee Portal</p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-hairline bg-paper p-6">
          <h1 className="font-display text-2xl text-ink-deep">Sign in</h1>

          {error === "missing" && (
            <p className="mt-3 rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-xs text-rejected">
              Enter both a name and an email address.
            </p>
          )}
          {error === "AccessDenied" && (
            <p className="mt-3 rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-xs text-rejected">
              This Gmail address does not have access to Shahi Lites. Ask
              your superadmin to add it.
            </p>
          )}
          {error === "OAuthAccountNotLinked" && (
            <p className="mt-3 rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-xs text-rejected">
              That email is already linked to a different sign-in method.
            </p>
          )}

          {googleMode ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Use your Shahi Lites Google account.
              </p>
              <form action={signInGoogleAction} className="mt-5">
                <Button type="submit" variant="secondary" className="w-full">
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.3 17.7 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.5 28.3a14.5 14.5 0 0 1 0-8.6l-7.9-6.1a24 24 0 0 0 0 20.8l7.9-6.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-3.8-13.5-9.1l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Local development sign-in. Add the Google OAuth keys to{" "}
                <code className="mx-1">.env.local</code> to switch this to
                real Google sign-in; nothing else changes.
              </p>
              <form action={signInMockAction} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-medium text-muted">Name</span>
                  <input
                    name="name"
                    required
                    autoComplete="name"
                    defaultValue="Priya Sharma"
                    className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-muted">
                    Email (Gmail)
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    defaultValue="priya@example.com"
                    className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                  />
                </label>

                <fieldset className="block">
                  <span className="text-xs font-medium text-muted">Role</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold-tint">
                      <input
                        type="radio"
                        name="role"
                        value="employee"
                        defaultChecked
                        className="accent-[var(--color-gold-deep)]"
                      />
                      Employee
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold-tint">
                      <input
                        type="radio"
                        name="role"
                        value="superadmin"
                        className="accent-[var(--color-gold-deep)]"
                      />
                      Superadmin
                    </label>
                  </div>
                </fieldset>

                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-faint">
          Shahi Lites · internal use only
        </p>
      </div>
    </div>
  );
}
