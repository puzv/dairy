import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { loginAction } from "@/lib/actions/auth";
import { getCurrentSessionUser } from "@/lib/auth";
import { isLocalDeveloperRequest } from "@/lib/local-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录山笺",
};

export default async function LoginPage() {
  const requestHeaders = await headers();

  // Keep the loopback guard independent from the proxy, even on the login page.
  if (!isLocalDeveloperRequest(requestHeaders.get("host"))) {
    notFound();
  }

  if (await getCurrentSessionUser()) {
    redirect("/timeline");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="login-heading">
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
            <h1 id="login-heading">登录山笺</h1>
          </header>

          <AuthForm mode="login" action={loginAction} />
        </div>
      </section>
    </main>
  );
}
