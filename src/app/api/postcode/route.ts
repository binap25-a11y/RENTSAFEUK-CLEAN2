// This file was a misnamed duplicate of the media upload handler and has been removed to prevent routing conflicts.
// Please use /api/upload for all property media synchronization.
export async function GET() {
  return new Response("This endpoint has been deprecated. Use /api/upload.", { status: 410 });
}
