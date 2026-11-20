import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ViewTransition } from "react";

import { loginAction, registerAction } from "@/lib/actions/auth";
import { getCurrentSessionUser } from "@/lib/auth";
import { ClearEditorRecovery } from "@/components/editor-recovery-boundary";

import { LoginExperience } from "./login-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录",
};

export default async function LoginPage() {
  if (await getCurrentSessionUser()) {
    redirect("/timeline");
  }

  return (
    <>
      <ClearEditorRecovery />
      <ViewTransition default="none" exit="login-exit">
        <LoginExperience loginAction={loginAction} registerAction={registerAction} />
      </ViewTransition>
    </>
  );
}
