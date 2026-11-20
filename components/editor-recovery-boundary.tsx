"use client";

import { useEffect } from "react";
import { clearEditorRecovery } from "./editor-recovery";

export function ClearEditorRecovery() {
  useEffect(() => { clearEditorRecovery(); }, []);
  return null;
}
