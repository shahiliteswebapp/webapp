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
        <label className="text-xs text-muted">
          Gmail address
          <input
            name="email"
            type="email"
            required
            placeholder="name@gmail.com"
            className="mt-1 block w-64 rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        <label className="text-xs text-muted">
          Name (optional)
          <input
            name="name"
            placeholder="Display name"
            className="mt-1 block w-48 rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        <Button type="submit">Grant access</Button>
      </form>

      <section className="space-y-2.5">
        <Eyebrow>Active ({active.length})</Eyebrow>
        {active.length === 0 ? (
          <EmptyState
            title="Nobody added yet"
            hint="Grant access to an employee's Gmail address above."
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-panel text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Email</th>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Sign-ins</th>
                  <th className="px-4 py-2.5 font-semibold">Last seen</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {active.map((e) => (
                  <tr key={e.email}>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {e.email}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {e.name || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {e.signInCount}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {e.lastSignInAt
                        ? fmtDateTime(e.lastSignInAt)
                        : "Not signed in yet"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {e.email !== session.email && (
                        <form action={removeAccessAction}>
                          <input type="hidden" name="email" value={e.email} />
                          <button
                            type="submit"
                            className="rounded-full border border-rejected/40 px-3 py-1 text-xs text-rejected hover:bg-rejected/5"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {removed.length > 0 && (
        <section className="space-y-2.5">
          <Eyebrow>Removed ({removed.length})</Eyebrow>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-panel text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Email</th>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Removed</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {removed.map((e) => (
                  <tr key={e.email}>
                    <td className="px-4 py-2.5 font-medium text-faint line-through">
                      {e.email}
                    </td>
                    <td className="px-4 py-2.5 text-faint">{e.name || "-"}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {e.removedAt ? fmtDateTime(e.removedAt) : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <form action={restoreAccessAction}>
                        <input type="hidden" name="email" value={e.email} />
                        <button
                          type="submit"
                          className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-paper hover:opacity-90"
                        >
                          Restore access
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
