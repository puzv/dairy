import Link from "next/link";

import { logoutAction } from "@/lib/actions/auth";

export function AppHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/timeline" className="brand" aria-label="山笺 · 回到日记">
          <span className="brand-seal" aria-hidden="true">
            山
          </span>
          <span className="brand-copy">
            <span className="brand-name">山笺</span>
            <span className="brand-sub">PRIVATE JOURNAL</span>
          </span>
        </Link>

        <form action={logoutAction} className="logout-form">
          <button type="submit" className="logout-button">
            退出登录
          </button>
        </form>
      </div>
    </header>
  );
}
