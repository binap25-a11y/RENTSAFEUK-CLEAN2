import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side media upload handler.
 * Manages binary synchronization with the Supabase 'Images' bucket (Case Sensitive).
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
                        'sb_publishable_9RMHLJbKcpjnvH5SuUx7hg_3TuajLPe';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: "Supabase configuration missing on server." 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const propertyId = formData.get("propertyId") as string;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: "No valid file provided" }, { status: 400 });
    }

    // Organize storage path for strict isolation
    const fileExt = file.name.split('.').pop() || 'jpg';
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

  } catch (err: any) {
    console.error('Server-side media upload handler crashed:', err);
    return NextResponse.json({ error: err.message || "Internal server error during media synchronization" }, { status: 500 });
  }
}
