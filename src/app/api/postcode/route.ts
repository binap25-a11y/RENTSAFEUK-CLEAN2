import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // This route is no longer used.
  return NextResponse.json({ error: 'This functionality has been removed.' }, { status: 410 });
}
