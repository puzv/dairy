import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { EditionAuth } from "@/components/edition/edition-auth";
import { loginAction, registerAction } from "@/lib/actions/auth";
import { getCurrentSessionUser } from "@/lib/auth";
import { safeAuthNext } from "@/lib/auth-next";

import { LoginExperience } from "../login/login-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "注册山笺",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  if (await getCurrentSessionUser()) {
    redirect("/timeline");
  }

  const next = safeAuthNext((await searchParams).next);

  return (
    <EditionAuth initialMode="register" loginAction={loginAction} registerAction={registerAction} next={next}>
      <LoginExperience initialMode="register" loginAction={loginAction} registerAction={registerAction} next={next}>
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

              <AuthForm mode="register" action={registerAction} next={next} />
            </div>
          </section>
        </main>
      </LoginExperience>
    </EditionAuth>
  );
}
