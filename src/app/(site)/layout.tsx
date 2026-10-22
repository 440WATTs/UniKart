import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SetupRequired } from "@/components/layout/SetupRequired";
import { Logo } from "@/components/layout/Logo";
import { isSupabaseConfigured } from "@/lib/env";
import { getUnreadCounts, getViewer } from "@/lib/session";

// Every page depends on the signed-in user (cookies), so never prerender.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <>
        <header className="border-b-[3px] border-ink bg-paper">
          <div className="container-page flex h-[60px] items-center">
            <Logo />
          </div>
        </header>
        <SetupRequired />
      </>
    );
  }
  const viewer = await getViewer().catch(() => null);
  const counts = await getUnreadCounts(viewer?.id).catch(() => ({ messages: 0, notifications: 0 }));
  return (
    <>
      <a href="#main" className="sr-only z-50 bg-sun p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Header />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
      <MobileTabBar unread={counts.messages} />
    </>
  );
}
