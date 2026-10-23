/** PREVIEW ONLY: every action explains that it needs the real backend. */
import type { ActionState } from "@/lib/types";
export const PREVIEW_MSG = "Preview only: this action needs the real backend (Supabase), so nothing was saved.";
export const previewState = async (): Promise<ActionState> => ({ error: PREVIEW_MSG });
