import Link from "next/link";
import { AvatarUpload, ProfileForm } from "@/components/account/AccountForms";
import { PageTitle } from "@/components/ui/EmptyState";
import { getInstitute, requireViewer } from "@/lib/session";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const viewer = await requireViewer("/account/profile");
  const institute = await getInstitute(viewer.membership?.institute_id);
  if (!viewer.profile) return <p>Profile not found.</p>;
  return (
    <div className="space-y-6">
      <PageTitle title="Profile" subtitle="How other members see you." />
      <div className="card p-5">
        <AvatarUpload userId={viewer.id} current={viewer.profile.avatar_url} />
      </div>
      <ProfileForm profile={viewer.profile} />
      <div className="card p-5 text-sm">
        <h2 className="font-bold">Institute</h2>
        <p className="mt-1">
          {institute ? `${institute.display_name} — ${viewer.isVerified ? "Verified member" : (viewer.membership?.status ?? "not verified")}` : "No institute yet"}
        </p>
        <p className="mt-1 text-muted">
          Your institute can only be changed through verification.{" "}
          <Link href="/account/institute" className="link">
            Manage institute verification
          </Link>
        </p>
      </div>
    </div>
  );
}
