import { redirect } from "next/navigation";
import { signInAction } from "@/lib/actions/auth";
import { getSession } from "@/lib/session";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui";

export const metadata = { title: "Sign in — Shahi Lites" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark subtitle={false} className="justify-center" />
          <p className="eyebrow mt-3">Employee Portal</p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-hairline bg-paper p-6">
          <h1 className="font-display text-2xl text-ink-deep">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Local development sign-in. Google sign-in is wired in later — this
            stands in for it without changing the rest of the app.
          </p>

          {error === "missing" && (
            <p className="mt-3 rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-xs text-rejected">
              Enter both a name and an email address.
            </p>
          )}

          <form action={signInAction} className="mt-5 space-y-4">
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
                    value="manager"
                    className="accent-[var(--color-gold-deep)]"
                  />
                  Manager
                </label>
              </div>
            </fieldset>

            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          Shahi Lites · internal use only
        </p>
      </div>
    </div>
  );
}
