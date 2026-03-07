import { NextResponse } from "next/server";

/**
 * This route has been deprecated in favor of direct client-side Firebase Storage uploads.
 * Bypasses cross-platform RLS issues by leveraging native Firebase security rules.
 */
export async function POST() {
  return NextResponse.json({ error: "Endpoint deprecated. Use Firebase Storage directly." }, { status: 410 });
}
