"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, LogOut, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import type { SessionUser } from "@/types/user";
import { can, isAdmin } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { useHeaderSheet } from "@/components/layout/header-sheet-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavItem {
  href: string;
  label: string;
  show: boolean;
}

function buildNavItems(user: SessionUser | null): NavItem[] {
  return [
    {
      href: "/calendario",
      label: "Calendario",
      show: can(user, "view:calendar"),
    },
    {
      href: "/reserva",
      label: "Reservar",
      show: can(user, "create:reservation"),
    },
    {
      href: "/reservas",
      label: "Mis reservas",
      show: can(user, "view:reservations"),
    },
    {
      href: "/admin/aprobaciones",
      label: "Aprobaciones",
      show: isAdmin(user),
    },
    {
      href: "/admin/espacios",
      label: "Espacios",
      show: isAdmin(user),
    },
    {
      href: "/admin/recursos",
      label: "Recursos",
      show: isAdmin(user),
    },
    {
      href: "/admin/usuarios",
      label: "Usuarios",
      show: isAdmin(user),
    },
    {
      href: "/admin/dashboard",
      label: "Dashboard",
      show: isAdmin(user),
    },
  ].filter((item) => item.show);
}

interface AppDrawerProps {
  user: SessionUser | null;
}

export function AppDrawer({ user }: AppDrawerProps) {
  const pathname = usePathname();
  const { activeSheet, setSheetOpen } = useHeaderSheet();
  const [signingOut, setSigningOut] = React.useState(false);
  const navItems = buildNavItems(user);
  const open = activeSheet === "menu";

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setSheetOpen("menu", false);

    try {
      await signOut({ redirectTo: "/login" });
    } catch {
      window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent("/login")}`;
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => setSheetOpen("menu", nextOpen)}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú" type="button">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full flex-col gap-0 p-0">
        <SheetHeader className="shrink-0 space-y-1 border-b px-6 py-5 pr-14">
          <SheetTitle>Menú</SheetTitle>
        </SheetHeader>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={() => setSheetOpen("menu", false)}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname.startsWith(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="safe-area-pb shrink-0 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Cerrar sesión
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
