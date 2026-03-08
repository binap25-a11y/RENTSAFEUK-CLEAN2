<<<<<<< HEAD
// This file was a misnamed duplicate of the media upload handler and has been removed to prevent routing conflicts.
// Please use /api/upload for all property media synchronization.
export async function GET() {
  return new Response("This endpoint has been deprecated. Use /api/upload.", { status: 410 });
=======
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // This route is no longer used.
  return NextResponse.json({ error: 'This functionality has been removed.' }, { status: 410 });
>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310
}
