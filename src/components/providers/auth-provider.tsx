"use client";

import { SessionProvider } from "next-auth/react";
import { WebPushRegister } from "@/components/pwa/web-push-register";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WebPushRegister />
      {children}
    </SessionProvider>
  );
}
