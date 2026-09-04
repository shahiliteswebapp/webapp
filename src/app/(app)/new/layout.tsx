import { DraftProvider } from "@/lib/draft/context";

export default function NewFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DraftProvider>{children}</DraftProvider>;
}
