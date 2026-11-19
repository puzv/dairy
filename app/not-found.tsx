import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "没有找到这一页",
};

export default function NotFound() {
  return (
    <main className="not-found-shell">
      <span className="not-found-mark" aria-hidden="true">
        空
      </span>
      <h1>这一页不存在</h1>
      <p>也许它已被收起，或从不属于这个账号。回到日记，继续翻阅吧。</p>
      <Link href="/timeline" className="button-primary">
        回到日记
      </Link>
    </main>
  );
}
