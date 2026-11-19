"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="not-found-shell">
      <span className="not-found-mark" aria-hidden="true">
        暂
      </span>
      <h1>这一页暂时停住了</h1>
      <p>可能是连接或配置的问题。稍后再试一次，或回到日记首页。</p>
      <div className="form-actions error-actions">
        <button type="button" className="button-primary" onClick={reset}>
          再试一次
        </button>
        <Link href="/timeline" className="button-secondary">
          回到日记
        </Link>
      </div>
    </main>
  );
}
