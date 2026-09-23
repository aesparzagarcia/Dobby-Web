"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setBlockAdminMutations } from "@/lib/api";
import { canWriteAdmin } from "@/lib/adminAccess";

export type AdminSessionUser = {
  id?: string;
  email?: string;
  name?: string;
  lastName?: string;
  role?: string;
};

type AdminAccessValue = {
  user: AdminSessionUser | null;
  ready: boolean;
  canWrite: boolean;
  readOnly: boolean;
};

const AdminAccessContext = createContext<AdminAccessValue | null>(null);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const data = (await res.json()) as { user?: AdminSessionUser };
        if (cancelled) return;
        const next = data.user ?? null;
        setUser(next);
        setBlockAdminMutations(!canWriteAdmin(next?.role));
        setReady(true);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
      setBlockAdminMutations(false);
    };
  }, [router]);

  const value = useMemo<AdminAccessValue>(() => {
    const canWrite = canWriteAdmin(user?.role);
    return { user, ready, canWrite, readOnly: ready && !canWrite };
  }, [user, ready]);

  return (
    <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
  );
}

export function useAdminAccess(): AdminAccessValue {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) {
    throw new Error("useAdminAccess must be used within AdminAccessProvider");
  }
  return ctx;
}
