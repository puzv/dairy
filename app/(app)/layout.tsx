import { AppHeader } from "@/components/app-header";
import { EditionToolbar } from "@/components/edition/toolbar";
import { NonMinimalControls } from "@/components/edition/edition";
import { AppearanceProvider } from "@/components/appearance/appearance";
import "./appearance.css";
import "./appearance-layout.css";
import "../editions-journal.css";
import { requireDiarySession } from "@/lib/auth";
import { NotebookActionsProvider } from "./timeline/notebook-actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Protected routes must not render before the session is verified. Each page
  // and Server Action also guards itself independently before DB access.
  const user = await requireDiarySession();

  return (
    <AppearanceProvider>
      <NotebookActionsProvider key={user.id} ownerId={user.id}>
        <EditionToolbar />
        <NonMinimalControls><AppHeader /></NonMinimalControls>
        <div data-appearance-fallback="" />
        <div className="page-shell">{children}</div>
      </NotebookActionsProvider>
    </AppearanceProvider>
  );
}
