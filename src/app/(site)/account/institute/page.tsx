import { InstituteEmailForms, ManualReviewForm } from "@/components/account/AccountForms";
import { CheckBadge } from "@/components/icons";
import { PageTitle } from "@/components/ui/EmptyState";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { getInstitute, getInstitutes, requireViewer } from "@/lib/session";

export const metadata = { title: "Institute verification" };

export default async function InstitutePage() {
  const viewer = await requireViewer("/account/institute");
  const [institute, all] = await Promise.all([getInstitute(env.defaultInstituteId), getInstitutes()]);
  const m = viewer.membership;
  const upcoming = all.filter((i) => !i.is_active);

  return (
    <div className="space-y-6">
      <PageTitle title="Institute verification" subtitle="Verified members can sell, message other members and make offers." />

      {institute && (
        <section className="overflow-hidden rounded-lg border-2 border-ink bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-sky px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-extrabold">{institute.display_name}</h2>
              <p className="text-sm">
                {institute.official_name}
                {institute.city ? ` · ${institute.city}, ${institute.state}` : ""}
              </p>
            </div>
            <span className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-bold">
              {m?.status === "verified" ? (
                <span className="inline-flex items-center gap-1">
                  <CheckBadge size={16} /> Verified
                </span>
              ) : m?.status === "pending" ? (
                "Pending"
              ) : m?.status === "rejected" ? (
                "Rejected"
              ) : m?.status === "revoked" ? (
                "Revoked"
              ) : (
                "Not verified"
              )}
            </span>
          </div>

          <div className="space-y-6 p-5">
            {m?.status === "verified" ? (
              <div className="text-sm">
                <p>
                  You&apos;re a verified member of <strong>{institute.display_name}</strong>
                  {m.verified_at ? ` since ${formatDate(m.verified_at)}` : ""}
                  {m.institute_email ? ` (${m.institute_email})` : m.method === "manual_review" ? " (reviewed by a moderator)" : ""}.
                </p>
                <p className="mt-2 text-muted">
                  The badge shows that UniMart checked your institute membership. It doesn&apos;t mean UniMart or the institute vouches
                  for any trade.
                </p>
              </div>
            ) : m?.status === "revoked" ? (
              <p className="text-sm text-danger">Your membership was revoked{m.review_note ? `: ${m.review_note}` : ""}. Contact support if you think this is a mistake.</p>
            ) : (
              <>
                {m?.status === "rejected" && (
                  <p className="rounded-md border-2 border-danger bg-danger-soft p-3 text-sm text-danger">
                    Your last request was not approved{m.review_note ? `: ${m.review_note}` : "."} You can try again below.
                  </p>
                )}
                {m?.status === "pending" && m.method === "manual_review" && (
                  <p className="rounded-md border-2 border-ink bg-butter p-3 text-sm">
                    Your manual review request is waiting for a moderator. You can still verify instantly with your institute email.
                  </p>
                )}
                <div>
                  <h3 className="font-bold">Verify with your institute email</h3>
                  {institute.email_domains_confirmed && institute.email_domains.length > 0 ? (
                    <div className="mt-3">
                      <InstituteEmailForms
                        instituteId={institute.id}
                        domains={institute.email_domains}
                        pendingEmail={m?.status === "pending" && m.method === "institute_email" ? m.institute_email : null}
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-ink-soft">
                      Email verification for {institute.display_name} will be enabled once an administrator confirms the official email
                      domain. Until then, request a manual review.
                    </p>
                  )}
                </div>
                {institute.allow_manual_review && !(m?.status === "pending" && m.method === "manual_review") && (
                  <div className="border-t border-line pt-5">
                    <h3 className="font-bold">No institute email?</h3>
                    <p className="mt-1 mb-3 text-sm text-ink-soft">Ask a moderator to review your membership instead.</p>
                    <ManualReviewForm instituteId={institute.id} />
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      <section className="card p-5 text-sm">
        <h2 className="font-bold">Other campuses</h2>
        <p className="mt-1 text-ink-soft">
          UniMart currently runs at {institute?.display_name ?? "one institute"} only. Other institutes will be added through a controlled
          onboarding process{upcoming.length ? ` (${upcoming.map((i) => i.display_name).join(", ")} in preparation)` : ""}.
          Changing institute will always need a new verification.
        </p>
      </section>
    </div>
  );
}
