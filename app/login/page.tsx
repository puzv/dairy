import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ViewTransition } from "react";

import { loginAction } from "@/lib/actions/auth";
import { getCurrentSessionUser } from "@/lib/auth";

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
    <ViewTransition default="none" exit="login-exit">
      <LoginExperience action={loginAction} />
    </ViewTransition>
  );
}
