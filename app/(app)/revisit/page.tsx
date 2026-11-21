import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { RevisitDesk } from "./revisit-desk";
import styles from "./revisit.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "寻笺与回望" };

export default async function RevisitPage() {
  const { user } = await requireUser();
  return (
    <main className={styles.desk} data-revisit-desk="">
      <Link href="/timeline" className={styles.back}>← 返回目录</Link>
      <header className={styles.heading}><h1>寻笺与回望</h1></header>
      <RevisitDesk key={user.id} owner={user.id} />
    </main>
  );
}
