import Link from "next/link";
import { redirect } from "next/navigation";
import { AUTH_ERRORS, errorText } from "@/lib/errors";
import { safeNext } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { LoginForm } from "../AuthForms";
import { AuthShell, GoogleButton, OrDivider } from "../AuthShell";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getViewer()) redirect(next);
  return (
    <AuthShell
      title="Log in"
      subtitle={next === "/sell" ? "Log in to list an item for sale." : "Welcome back to UniMart."}
    >
      {sp.error && (
        <p role="alert" className="mb-4 rounded-md border-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorText(sp.error, AUTH_ERRORS)}
        </p>
      )}
      <GoogleButton next={next} />
      <OrDivider />
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm">
        New to UniMart?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="link">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
