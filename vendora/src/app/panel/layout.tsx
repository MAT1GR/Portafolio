import { requireUser, getUserStores, ROLE_PERMISSIONS } from "@/lib/auth";
import { env } from "@/lib/env";
import { PanelNav } from "@/components/panel/nav";
import { Toaster } from "@/components/client";

export const metadata = { title: "Panel" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const stores = await getUserStores(user.id);
  return (
    <div className="min-h-dvh">
      <PanelNav
        brand={env.brand}
        isAdmin={user.platformRole === "SUPERADMIN"}
        user={{ name: user.name, email: user.email, plan: user.plan.name }}
        stores={stores.map((s) => ({ id: s.store.id, name: s.store.name, slug: s.store.slug, role: s.role, perms: ROLE_PERMISSIONS[s.role] }))}
      />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
