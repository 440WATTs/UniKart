import Link from "next/link";
import { ForgotPasswordForm } from "../AuthForms";
import { AuthShell } from "../AuthShell";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we'll send you a link to choose a new password.">
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="link">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}
