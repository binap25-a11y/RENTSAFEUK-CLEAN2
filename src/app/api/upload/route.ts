import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side media upload handler.
 * Manages binary synchronization with the Supabase 'Images' bucket.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
    // Use the publishable key provided by the user if available
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: "Supabase configuration missing on server. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or ANON_KEY) are set." 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const propertyId = formData.get("propertyId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Organize storage path for strict isolation
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId || 'system'}/${propertyId || 'misc'}/${fileName}`;

    // Perform the binary upload to the 'Images' bucket (Case Sensitive)
    const { error: uploadError } = await supabase.storage
      .from("Images")
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError.message);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
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
