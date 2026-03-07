import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side binary upload handler for Supabase.
 * Processes multi-part form data and streams it to the 'Images' bucket.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const propertyId = formData.get("propertyId") as string;

    if (!file || !userId || !propertyId) {
      return NextResponse.json({ error: "Missing required identification metadata" }, { status: 400 });
    }

    console.log(`Processing binary sync for user ${userId}, property ${propertyId}...`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_9RMHLJbKcpjnvH5SuUx7hg_3TuajLPe';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${propertyId}/${fileName}`;

    // Convert to buffer for resilient server-side stream processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('Images')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase storage failure:', error.message);
      // Helpful hint for the user if they haven't set the RLS policy yet
      const hint = error.message.includes('row-level security') 
        ? " (Hint: Check your 'Images' bucket RLS policies in Supabase)" 
        : "";
      return NextResponse.json({ error: error.message + hint }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error('API Synchronization error:', error.message);
    return NextResponse.json({ error: "Internal media synchronization failure" }, { status: 500 });
  }
}
