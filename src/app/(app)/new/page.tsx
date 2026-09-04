import { PageHeader, EmptyState, ButtonLink } from "@/components/ui";

export const metadata = { title: "Start New — Shahi Lites" };

export default function NewPlaceholderPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Start New" title="New quotation" />
      <EmptyState
        title="Blueprint upload — coming in the next build"
        hint="This is where you'll drop a PDF or PNG blueprint and lay out the rooms."
        action={
          <ButtonLink href="/dashboard" variant="secondary">
            Back to dashboard
          </ButtonLink>
        }
      />
    </div>
  );
}
