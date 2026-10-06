import { requireSuperadmin } from "@/lib/session";
import { listAccess } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import {
  addAccessAction,
  removeAccessAction,
  restoreAccessAction,
} from "@/lib/actions/admin";
import { Button, EmptyState, Eyebrow, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Access · Shahi Lites" };

export default async function AdminPage() {
  const session = await requireSuperadmin();
  const entries = await listAccess();
  const active = entries.filter((e) => e.status === "active");
  const removed = entries.filter((e) => e.status === "removed");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Superadmin" title="Access" />

      <p className="text-sm text-muted">
        Only the Gmail addresses listed below may sign in. Removing someone
        locks them out right away, and only a superadmin can restore access
        from this page.
      </p>

      <form
        action={addAccessAction}
        className="flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-hairline bg-panel/40 p-4"
      >
        <label className="w-full text-xs text-muted sm:w-auto">
          Gmail address
          <input
            name="email"
            type="email"
            required
            placeholder="name@gmail.com"
            className="mt-1 block w-full rounded-md sm:w-64 border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        <label className="w-full text-xs text-muted sm:w-auto">
          Name (optional)
          <input
            name="name"
            placeholder="Display name"
            className="mt-1 block w-full rounded-md sm:w-48 border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        <Button type="submit" className="w-full sm:w-auto">Grant access</Button>
      </form>

      <section className="space-y-2.5">
        <Eyebrow>Active ({active.length})</Eyebrow>
        {active.length === 0 ? (
          <EmptyState
            title="Nobody added yet"
            hint="Grant access to an employee's Gmail address above."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((e) => (
              <li
                key={e.email}
                className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-paper p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{e.name || e.email}</p>
                  {e.name && <p className="truncate text-sm text-muted">{e.email}</p>}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-faint">Sign-ins</dt>
                    <dd className="text-ink">{e.signInCount}</dd>
                  </div>
                  <div>
                    <dt className="text-faint">Last seen</dt>
                    <dd className="text-ink">
                      {e.lastSignInAt ? fmtDateTime(e.lastSignInAt) : "Not signed in yet"}
                    </dd>
                  </div>
                </dl>
                {e.email !== session.email ? (
                  <form action={removeAccessAction} className="mt-auto">
                    <input type="hidden" name="email" value={e.email} />
                    <button
                      type="submit"
                      className="h-9 w-full rounded-full border border-rejected/40 px-3 text-xs font-medium text-rejected hover:bg-rejected/5"
                    >
                      Remove access
                    </button>
                  </form>
                ) : (
                  <p className="mt-auto text-xs text-faint">This is you.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {removed.length > 0 && (
        <section className="space-y-2.5">
          <Eyebrow>Removed ({removed.length})</Eyebrow>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {removed.map((e) => (
              <li
                key={e.email}
                className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-panel/40 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-faint line-through">{e.name || e.email}</p>
                  {e.name && <p className="truncate text-sm text-faint">{e.email}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Removed {e.removedAt ? fmtDateTime(e.removedAt) : ""}
                  </p>
                </div>
                <form action={restoreAccessAction} className="mt-auto">
                  <input type="hidden" name="email" value={e.email} />
                  <button
                    type="submit"
                    className="h-9 w-full rounded-full bg-gold px-3 text-xs font-medium text-paper hover:opacity-90"
                  >
                    Restore access
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
