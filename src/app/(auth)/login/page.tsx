import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Cargando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
