import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { SignupForm } from "../AuthForms";
import { AuthShell, GoogleButton, OrDivider } from "../AuthShell";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/account/institute");
  if (await getViewer()) redirect(next);
  return (
    <AuthShell
      title="Create your account"
      subtitle="Buy and sell with your campus community. After signing up you'll verify your institute membership."
    >
      <GoogleButton next="/account/institute" />
      <OrDivider />
      <SignupForm next={next} />
      <p className="mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="link">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
