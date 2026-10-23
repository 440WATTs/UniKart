import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t-[3px] border-ink bg-paper pb-20 md:pb-0">
      <div className="container-page grid gap-8 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-pixel text-xl font-bold">UniKart</p>
          <p className="mt-2 text-muted">Your Campus. Your Marketplace.</p>
          <p className="mt-3 text-xs text-muted">
            UniKart is an independent student project. It is not operated, affiliated with or endorsed by NIT Sikkim or any
            other institute.
          </p>
        </div>
        <nav aria-label="Shop">
          <p className="mb-2 font-bold">Shop</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:underline" href="/marketplace">Marketplace</Link></li>
            <li><Link className="hover:underline" href="/categories">Categories</Link></li>
            <li><Link className="hover:underline" href="/search?type=free">Free items</Link></li>
            <li><Link className="hover:underline" href="/wanted">Wanted items</Link></li>
          </ul>
        </nav>
        <nav aria-label="Sell">
          <p className="mb-2 font-bold">Sell</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:underline" href="/sell">Post a listing</Link></li>
            <li><Link className="hover:underline" href="/sell?kind=wanted">Post a wanted request</Link></li>
            <li><Link className="hover:underline" href="/account/listings">My listings</Link></li>
            <li><Link className="hover:underline" href="/account/institute">Get verified</Link></li>
          </ul>
        </nav>
        <nav aria-label="Help">
          <p className="mb-2 font-bold">Help</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:underline" href="/help">Help &amp; Safety</Link></li>
            <li><Link className="hover:underline" href="/contact">Contact</Link></li>
            <li><Link className="hover:underline" href="/terms">Terms (draft)</Link></li>
            <li><Link className="hover:underline" href="/privacy">Privacy (draft)</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
