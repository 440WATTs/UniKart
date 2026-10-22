import Image from "next/image";
import Link from "next/link";

/** The UniMart mark and wordmark from the landing page header. */
export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2 font-pixel text-[22px] leading-none font-bold sm:text-2xl" aria-label="UniMart home">
      <Image src="/brand/unimart-logo.png" alt="" width={37} height={28} className="h-7 w-auto [image-rendering:pixelated]" priority />
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>UniMart</span>
    </Link>
  );
}
