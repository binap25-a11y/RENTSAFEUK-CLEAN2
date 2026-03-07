import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side media upload handler.
 * Manages binary synchronization with the Supabase 'Images' bucket.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
// Use Service Role if available, otherwise fallback to Anon Key for public bucket access
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Initialize Supabase only if we have the required parameters
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ 
        error: "Supabase storage is not configured on the server. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) are set in your environment variables." 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const propertyId = formData.get("propertyId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Generate a unique file name with timestamp
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Organize storage path by user and property for strict isolation
    const filePath = `${userId || 'system'}/${propertyId || 'misc'}/${fileName}`;

    // Perform the binary upload to the 'Images' bucket (Case Sensitive)
    const { data, error } = await supabase.storage
      .from("Images")
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase storage upload error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Retrieve the public URL for the newly uploaded asset
    const { data: urlData } = supabase.storage
      .from("Images")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: urlData.publicUrl });

  } catch (err) {
    console.error('Server-side media upload handler crashed:', err);
    return NextResponse.json({ error: "Internal server error during media synchronization" }, { status: 500 });
  }
}
