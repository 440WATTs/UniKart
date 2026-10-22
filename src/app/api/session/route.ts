import { NextResponse } from "next/server";
import { displayName, getViewer } from "@/lib/session";

/** Minimal session info for the static landing page header. */
export async function GET() {
  const viewer = await getViewer();
  return NextResponse.json(
    { user: viewer ? { name: displayName(viewer.profile).toUpperCase().slice(0, 14), verified: viewer.isVerified } : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
