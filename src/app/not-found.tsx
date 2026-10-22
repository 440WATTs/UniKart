import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sky p-6 text-center">
      <p className="font-pixel text-5xl font-bold">404</p>
      <p className="text-lg font-semibold">This page doesn&apos;t exist.</p>
      <Link href="/marketplace" className="btn-primary">
        Go to the marketplace
      </Link>
    </main>
  );
}
