import Link from "next/link";
import { Suspense } from "react";
import { BellIcon, ChatIcon, ChevronDown, HeartIcon, UserIcon } from "@/components/icons";
import { Dropdown, menuItemClass } from "@/components/ui/Dropdown";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { Logo } from "@/components/layout/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { CATEGORY_ICON } from "@/lib/constants";
import { getCategories } from "@/lib/listings";
import { logError } from "@/lib/log";
import { displayName, getInstitute, getUnreadCounts, getViewer } from "@/lib/session";

function CountBadge({ n, label }: { n: number; label: string }) {
  if (!n) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-5 rounded-full border-2 border-ink bg-sun px-1 text-center text-[11px] leading-4 font-bold">
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

const navLink = "rounded-md px-3 py-2 text-[15px] font-semibold hover:bg-ink hover:text-white";

export async function Header() {
  // The header must keep working during a database outage so Help, Login and
  // the page's own error message stay reachable; failures are logged.
  const [viewer, institute, categories] = await Promise.all([
    getViewer().catch((e) => (logError("header.viewer", e), null)),
    getInstitute().catch((e) => (logError("header.institute", e), null)),
    getCategories(),
  ]);
  const counts = await getUnreadCounts(viewer?.id).catch(() => ({ messages: 0, notifications: 0 }));
  const name = displayName(viewer?.profile);

  return (
    <header className="sticky top-0 z-40">
      {/* Bar mirrors the landing-page header: paper surface, 3px ink rule. */}
      <div className="border-b-[3px] border-ink bg-paper">
        <div className="container-page flex h-[60px] items-center gap-2 lg:gap-4">
          <Logo href="/" />
          <nav aria-label="Main" className="ml-2 hidden items-center gap-1 lg:flex">
            <Link href="/marketplace" className={navLink}>
              Shop
            </Link>
            <Link href="/sell" className={navLink}>
              Sell
            </Link>
            <Dropdown
              buttonClassName={`${navLink} inline-flex items-center gap-1`}
              label={
                <>
                  Categories <ChevronDown size={16} />
                </>
              }
            >
              {categories.map((c) => (
                <Link key={c.id} href={`/search?category=${c.id}`} className={menuItemClass}>
                  <span aria-hidden>{CATEGORY_ICON[c.id] ?? "📦"}</span>
                  {c.name}
                </Link>
              ))}
              <Link href="/search?type=free" className={menuItemClass}>
                <span aria-hidden>{CATEGORY_ICON.free}</span>Free Items
              </Link>
              <Link href="/categories" className={`${menuItemClass} border-t border-line`}>
                All categories →
              </Link>
            </Dropdown>
            {!viewer && (
              <Link href="/#contact" className={navLink}>
                About
              </Link>
            )}
          </nav>

          <Suspense fallback={<div className="hidden h-11 flex-1 md:block" />}>
            <HeaderSearch className="mx-2 hidden flex-1 md:block" />
          </Suspense>
          <div className="flex-1 md:hidden" />

          {viewer ? (
            <div className="flex items-center gap-0.5 sm:gap-1">
              <Link href="/messages" className="btn-ghost relative hidden px-2.5 sm:inline-flex" aria-label="Messages">
                <ChatIcon />
                <span className="hidden xl:inline">Messages</span>
                <CountBadge n={counts.messages} label="unread conversations" />
              </Link>
              <Link href="/saved" className="btn-ghost hidden px-2.5 sm:inline-flex" aria-label="Saved items">
                <HeartIcon />
                <span className="hidden xl:inline">Saved</span>
              </Link>
              <Link href="/account/notifications" className="btn-ghost relative px-2.5" aria-label="Notifications">
                <BellIcon />
                <CountBadge n={counts.notifications} label="unread notifications" />
              </Link>
              {institute && (
                <Link
                  href="/account/institute"
                  className="hidden items-center gap-1 rounded-full border-2 border-ink bg-sky px-3 py-1 text-xs font-bold lg:inline-flex"
                  title={viewer.isVerified ? `Verified ${institute.display_name} member` : "Institute verification"}
                >
                  {institute.display_name}
                  {viewer.isVerified ? " ✓" : " · verify"}
                </Link>
              )}
              <Dropdown
                align="right"
                ariaLabel="Account menu"
                buttonClassName="btn-ghost max-w-40 px-2"
                label={
                  <>
                    <UserIcon />
                    <span className="hidden truncate sm:inline">{name}</span>
                    <ChevronDown size={14} className="hidden sm:block" />
                  </>
                }
              >
                <div className="border-b border-line px-4 py-2 text-xs text-muted">
                  Signed in as <span className="font-semibold text-ink">{name}</span>
                </div>
                <Link href="/account" className={menuItemClass}>Your account</Link>
                <Link href="/account/listings" className={menuItemClass}>My listings</Link>
                <Link href="/account/orders" className={menuItemClass}>Offers &amp; deals</Link>
                <Link href="/saved" className={menuItemClass}>Saved items</Link>
                <Link href="/account/institute" className={menuItemClass}>Institute verification</Link>
                <Link href="/account/settings" className={menuItemClass}>Settings</Link>
                {viewer.isStaff && (
                  <Link href="/admin" className={menuItemClass}>Admin</Link>
                )}
                <form action="/auth/signout" method="post" className="border-t border-line">
                  <button type="submit" className={menuItemClass}>Log out</button>
                </form>
              </Dropdown>
            </div>
          ) : (
            <Link href="/login" className="btn-primary btn-sm h-10 px-4 text-[15px]">
              Login
            </Link>
          )}
          <MobileMenu
            signedIn={Boolean(viewer)}
            isStaff={Boolean(viewer?.isStaff)}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      </div>
      {/* Sky band: search on small screens, quick categories everywhere. */}
      <div className="border-b-2 border-ink bg-sky">
        <div className="container-page py-2 md:hidden">
          <Suspense fallback={<div className="h-11" />}>
            <HeaderSearch />
          </Suspense>
        </div>
        <nav aria-label="Categories" className="container-page hidden gap-1 overflow-x-auto py-1.5 text-sm font-semibold md:flex">
          {institute && (
            <span className="mr-2 flex shrink-0 items-center font-pixel text-[15px]">{institute.display_name.toUpperCase()} MARKETPLACE</span>
          )}
          {categories.map((c) => (
            <Link key={c.id} href={`/search?category=${c.id}`} className="shrink-0 rounded px-2.5 py-1 hover:bg-ink hover:text-white">
              {c.name}
            </Link>
          ))}
          <Link href="/search?type=free" className="shrink-0 rounded px-2.5 py-1 hover:bg-ink hover:text-white">
            Free Items
          </Link>
          <Link href="/wanted" className="shrink-0 rounded px-2.5 py-1 hover:bg-ink hover:text-white">
            Wanted
          </Link>
        </nav>
      </div>
    </header>
  );
}
