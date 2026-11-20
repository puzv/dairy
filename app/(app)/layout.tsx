import { AppHeader } from "@/components/app-header";
import { AppearanceProvider } from "@/components/appearance/appearance";
import "./appearance.css";
import "./appearance-layout.css";
import { requireDiarySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Protected routes must not render before the session is verified. Each page
  // and Server Action also guards itself independently before DB access.
  await requireDiarySession();

  return (
    <AppearanceProvider>
      <AppHeader />
      <div data-appearance-fallback="" />
      <div className="page-shell">{children}</div>
    </AppearanceProvider>
  );
}
