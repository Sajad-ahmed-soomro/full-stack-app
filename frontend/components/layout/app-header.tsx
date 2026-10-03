"use client";

import { Button } from "@/components/ui/button";
import { CalendarIcon } from "@/components/ui/icons";
import { useAuth } from "@/lib/auth-context";

export function AppHeader() {
  const { user, business, signOut } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <CalendarIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {business?.name ?? "Schedulr"}
            </p>
            <p className="text-xs text-slate-500">
              Open {String(business?.openingHour ?? 9).padStart(2, "0")}:00 to{" "}
              {String(business?.closingHour ?? 17).padStart(2, "0")}:00 UTC
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm text-slate-700">{user?.fullName}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
