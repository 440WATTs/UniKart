"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/account", "Overview"],
  ["/account/listings", "My listings"],
  ["/account/orders", "Offers & deals"],
  ["/saved", "Saved items"],
  ["/messages", "Messages"],
  ["/account/notifications", "Notifications"],
  ["/account/profile", "Profile"],
  ["/account/institute", "Institute verification"],
  ["/account/settings", "Settings"],
  ["/help", "Help & Safety"],
] as const;

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="mb-6 lg:mb-0">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-0.5 lg:px-0">
        {LINKS.map(([href, label]) => {
          const active = href === "/account" ? path === href : path.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap ${active ? "bg-ink text-white" : "hover:bg-black/5"}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-2 lg:border-t lg:border-line lg:pt-2">
          <form action="/auth/signout" method="post">
            <button type="submit" className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold whitespace-nowrap hover:bg-black/5">
              Log out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
