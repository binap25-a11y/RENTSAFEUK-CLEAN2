import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Centrally managed Supabase initialization for server-side storage handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
// We fallback to the Anon key if the Service Role key is missing, as long as bucket rules allow public uploads
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey && supabaseKey.length > 0) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      console.error('Supabase server-side client not configured. Missing valid keys.');
      return NextResponse.json({ 
        error: "Supabase storage is not configured on the server. Please check your environment variables." 
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
    
    // Organize storage path by user and property for precise identification and security
    const filePath = `${userId || 'system'}/${propertyId || 'misc'}/${fileName}`;

    // Perform the binary upload to the 'images' bucket
    const { data, error } = await supabase.storage
      .from("images")
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
      .from("images")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: urlData.publicUrl });

  } catch (err) {
    console.error('Server-side media upload handler crashed:', err);
    return NextResponse.json({ error: "Internal server error during media synchronization" }, { status: 500 });
  }
}
