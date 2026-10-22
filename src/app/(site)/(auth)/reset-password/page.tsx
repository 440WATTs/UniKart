import Link from "next/link";
import { getViewer } from "@/lib/session";
import { ResetPasswordForm } from "../AuthForms";
import { AuthShell } from "../AuthShell";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const viewer = await getViewer();
  return (
    <AuthShell title="Choose a new password">
      {viewer ? (
        <ResetPasswordForm />
      ) : (
        <p className="text-sm">
          This page opens from the link in your password-reset email. The link may have expired;{" "}
          <Link href="/forgot-password" className="link">
            request a new one
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
