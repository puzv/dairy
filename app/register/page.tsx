import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { registerAction } from "@/lib/actions/auth";
import { getCurrentSessionUser } from "@/lib/auth";
import { isLocalDeveloperRequest } from "@/lib/local-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "注册山笺",
};

export default async function RegisterPage() {
  const requestHeaders = await headers();

  // Registration is local-only and independently guarded from the proxy.
  if (!isLocalDeveloperRequest(requestHeaders.get("host"))) {
    notFound();
  }

  if (await getCurrentSessionUser()) {
    redirect("/timeline");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="register-heading">
        <div className="auth-brand">
          <span className="brand-seal" aria-hidden="true">
            山
          </span>
          <span className="brand-copy">
            <span className="brand-name">山笺</span>
            <span className="brand-sub">PRIVATE JOURNAL</span>
          </span>
        </div>

        <div className="auth-card">
          <header className="auth-heading">
            <h1 id="register-heading">创建账号</h1>
          </header>

          <AuthForm mode="register" action={registerAction} />
        </div>
      </section>
    </main>
  );
}
