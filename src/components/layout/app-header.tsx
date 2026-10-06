"use client";

import Image from "next/image";
import type { SessionUser } from "@/types/user";
import { AppDrawer } from "@/components/layout/app-drawer";
import { HeaderSheetProvider } from "@/components/layout/header-sheet-context";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface AppHeaderProps {
  user: SessionUser | null;
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <HeaderSheetProvider>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <AppDrawer user={user} />
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {user?.name ?? "Usuario"}
              </p>
              <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                {user?.role ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationsBell />
            <ThemeToggle />
            <div className="relative h-9 w-24 sm:h-10 sm:w-28">
              <Image
                src="/logo.svg"
                alt="MVQro Espacios"
                fill
                className="object-contain object-right"
                priority
              />
            </div>
          </div>
        </div>
      </header>
    </HeaderSheetProvider>
  );
}
