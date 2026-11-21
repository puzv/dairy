"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEdition } from "./edition";
import { AppearanceTrigger } from "@/components/appearance/appearance";
import { logoutAction } from "@/lib/actions/auth";
import styles from "./controls.module.css";

const commands = [
  { label: "写今天", href: "/entries/new", keys: "write new xiejintian" },
  { label: "日记目录", href: "/timeline", keys: "home timeline mulu" },
  { label: "继续草稿", href: "/timeline?tab=drafts", keys: "drafts caogao" },
  { label: "查看收藏", href: "/timeline?tab=favorites", keys: "favorites shoucang" },
  { label: "打开回收站", href: "/timeline?tab=trash", keys: "trash huishouzhan" },
];

function CommandMenu() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const matches = commands.filter(c => (c.label + " " + c.keys).includes(search.trim().toLowerCase()));
  function open() {
    setSearch("");
    setActive(0);
    dialog.current?.showModal();
  }
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.isComposing) {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else if (!document.querySelector("dialog[open]")) open();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function go(href: string) {
    dialog.current?.close();
    router.push(href);
  }
  return <>
    <button className={styles.commandTrigger} type="button" ref={trigger} onClick={open} aria-haspopup="dialog">指令 <kbd>⌘ / Ctrl K</kbd></button>
    <dialog className={styles.dialog} ref={dialog} aria-labelledby="command-heading"
      onClose={() => trigger.current?.focus({ preventScroll: true })}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <section><header><h2 id="command-heading">指令</h2><button type="button" aria-label="关闭指令" onClick={() => dialog.current?.close()}>×</button></header>
        <input autoFocus aria-label="搜索指令" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="journal-commands"
          aria-activedescendant={matches.length ? "command-" + active : undefined} placeholder="搜索指令…" value={search}
          onChange={e => { setSearch(e.target.value); setActive(0); }}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing || !matches.length) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActive((active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
            }
            if (e.key === "Enter") { e.preventDefault(); go(matches[active].href); }
          }} />
        <ul role="listbox" aria-label="可用指令" id="journal-commands">{matches.map((command, i) =>
          <li key={command.href} role="option" aria-selected={i === active} id={"command-" + i}
            onPointerMove={() => setActive(i)} onClick={() => go(command.href)}>{command.label}<span aria-hidden="true">↵</span></li>)}</ul>
        {!matches.length && <p role="status">没有匹配的指令</p>}
      </section>
    </dialog>
  </>;
}

function FocusControl() {
  const pathname = usePathname();
  const params = useSearchParams();
  const isEditor = pathname === "/entries/new" || pathname.endsWith("/edit");
  const focused = isEditor && params.get("focus") === "1";
  function changeFocus(value: boolean) {
    const url = new URL(location.href);
    if (value) url.searchParams.set("focus", "1");
    else url.searchParams.delete("focus");
    window.history.replaceState(null, "", url);
  }
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-writing-focus", focused);
    if (!focused) return;
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("dialog[open], [aria-expanded='true']")) changeFocus(false);
    }
    window.addEventListener("keydown", escape);
    return () => {
      document.documentElement.removeAttribute("data-writing-focus");
      window.removeEventListener("keydown", escape);
    };
  }, [focused]);
  return isEditor ? <button type="button" aria-pressed={focused} onClick={() => changeFocus(!focused)}>
    {focused ? "退出专注" : "专注写作"}</button> :
    <Link href="/entries/new?focus=1" transitionTypes={["write-journal"]}>专注写作 <span aria-hidden="true">↗</span></Link>;
}

export function EditionToolbar() {
  const { edition } = useEdition();
  if (edition === "shanjian") return null;
  return <nav className={styles.toolbar} data-edition-toolbar aria-label="主题导航">
    <Link href="/timeline" className={styles.wordmark}>山笺 <span>{edition === "tech" ? "观测台" : "手记"}</span></Link>
    <div className={styles.tools}>
      {edition === "tech" ? <CommandMenu /> : <FocusControl />}
      <div className={styles.account}><AppearanceTrigger />
        <form action={logoutAction}><button type="submit">退出登录</button></form>
      </div>
    </div>
  </nav>;
}
