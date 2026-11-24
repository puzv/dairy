import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ViewTransition } from "react";

import { loginAction, registerAction } from "@/lib/actions/auth";
import { getCurrentSessionUser } from "@/lib/auth";
import { safeAuthNext } from "@/lib/auth-next";
import { ClearEditorRecovery } from "@/components/editor-recovery-boundary";
import { EditionAuth } from "@/components/edition/edition-auth";

import { LoginExperience } from "./login-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  if (await getCurrentSessionUser()) {
    redirect("/timeline");
  }

  const next = safeAuthNext((await searchParams).next);

  return (
    <>
      <ClearEditorRecovery />
      <EditionAuth initialMode="login" loginAction={loginAction} registerAction={registerAction} next={next}>
        <ViewTransition default="none" exit="login-exit">
          <LoginExperience initialMode="login" loginAction={loginAction} registerAction={registerAction} next={next} />
        </ViewTransition>
      </EditionAuth>
    </>
  );
}
