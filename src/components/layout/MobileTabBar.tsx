"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatIcon, HomeIcon, PlusIcon, SearchIcon, UserIcon } from "@/components/icons";

const TABS = [
  { href: "/marketplace", label: "Home", icon: HomeIcon, match: ["/marketplace"] },
  { href: "/search", label: "Search", icon: SearchIcon, match: ["/search", "/categories"] },
  { href: "/sell", label: "Sell", icon: PlusIcon, match: ["/sell"], primary: true },
  { href: "/messages", label: "Messages", icon: ChatIcon, match: ["/messages"] },
  { href: "/account", label: "Account", icon: UserIcon, match: ["/account", "/saved", "/login", "/signup"] },
];

export function MobileTabBar({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, match, primary }) => {
          const active = match.some((m) => path === m || path.startsWith(m + "/"));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-ink" : "text-muted"}`}
              >
                {primary ? (
                  <span className="flex h-8 w-12 items-center justify-center rounded-md border-2 border-ink bg-sun text-ink shadow-hard-sm">
                    <Icon size={20} />
                  </span>
                ) : (
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                )}
                {label}
                {label === "Messages" && unread > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-18px)] h-2.5 w-2.5 rounded-full border border-ink bg-sun" aria-label={`${unread} unread`} />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
