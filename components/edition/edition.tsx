"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { editionCookie, editionNames, type Edition } from "@/lib/edition";
import styles from "./controls.module.css";

const EditionContext = createContext<{ edition: Edition; setEdition: (next: Edition) => void } | null>(null);

export function EditionProvider({ initialEdition, children }: { initialEdition: Edition; children: ReactNode }) {
  const [edition, update] = useState(initialEdition);
  function setEdition(next: Edition) {
    document.documentElement.dataset.edition = next;
    document.cookie = editionCookie + "=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "");
    update(next);
  }
  return <EditionContext.Provider value={{ edition, setEdition }}>{children}</EditionContext.Provider>;
}

export function useEdition() {
  const value = useContext(EditionContext);
  if (!value) throw new Error("EditionProvider is required.");
  return value;
}

export function NonMinimalControls({ children }: { children: ReactNode }) {
  const { edition } = useEdition();
  return edition === "minimal" ? null : children;
}

export function EditionPicker() {
  const { edition, setEdition } = useEdition();
  return <div className={styles.picker} data-edition-picker role="group" aria-label="选择主题">
    {(Object.keys(editionNames) as Edition[]).map(id =>
      <button type="button" key={id} data-choice={id} aria-pressed={edition === id}
        onClick={() => setEdition(id)}>{editionNames[id]}</button>)}
  </div>;
}
