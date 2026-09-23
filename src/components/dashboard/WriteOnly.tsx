"use client";

import type { ReactNode } from "react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";

/** Renders children only for full ADMIN (not the read-only viewer). */
export function WriteOnly({ children }: { children: ReactNode }) {
  const { canWrite, ready } = useAdminAccess();
  if (!ready || !canWrite) return null;
  return <>{children}</>;
}
