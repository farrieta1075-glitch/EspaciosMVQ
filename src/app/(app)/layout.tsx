import { auth } from "@/lib/auth/index";
import { AppHeader } from "@/components/layout/app-header";
import { ModalBodyCleanup } from "@/components/layout/modal-body-cleanup";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-dvh flex-col">
      <ModalBodyCleanup />
      <AppHeader user={session?.user ?? null} />
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-clip px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
