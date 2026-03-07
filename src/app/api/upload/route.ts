import { NextRequest, NextResponse } from "next/server";

/**
 * DEPRECATED: Property media is now synchronized directly via Firebase Storage client-side.
 * This endpoint is retained for general diagnostic purposes but is no longer part of the
 * core property onboarding or edit pipelines to avoid Supabase RLS conflicts.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    error: "Direct binary upload to Supabase is currently restricted by RLS policies. Please use the Firebase Storage client-side utility instead.",
    code: "RLS_RESTRICTION"
  }, { status: 403 });
}
