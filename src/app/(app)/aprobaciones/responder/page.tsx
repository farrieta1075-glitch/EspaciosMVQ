import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ApprovalResponderClient } from "@/components/approval/approval-responder-client";

export default function ApprovalResponderPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </div>
      }
    >
      <ApprovalResponderClient />
    </Suspense>
  );
}
