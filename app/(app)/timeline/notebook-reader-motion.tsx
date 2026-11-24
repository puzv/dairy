"use client";

import { ViewTransition, type ReactNode } from "react";
import { useEdition } from "@/components/edition/edition";

export function NotebookReaderMotion({ children }: { children: ReactNode }) {
  const { edition } = useEdition();
  if (edition !== "minimal") return children;
  return <ViewTransition name="minimal-reader" update={{ "minimal-read": "auto", default: "none" }} default="none">
    {children}
  </ViewTransition>;
}
