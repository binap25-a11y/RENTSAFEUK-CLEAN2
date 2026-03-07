import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side media upload handler for Supabase Storage.
 * Manages binary synchronization with the 'Images' bucket.
 */
export async function POST(req: NextRequest) {
  try {
    // Hardcoded configuration for project reliability
    const supabaseUrl = 'https://owfjowiiyshhqzhatwqr.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
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

    console.log(`Processing media upload for user ${userId}, property ${propertyId}...`);

    // Organize storage path for strict tenant isolation
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId || 'system'}/${propertyId || 'misc'}/${fileName}`;

    // Convert File to Buffer for robust server-side handling
    const buffer = Buffer.from(await file.arrayBuffer());

    // Perform the binary upload to the 'Images' bucket (Case Sensitive)
    const { error: uploadError } = await supabase.storage
      .from("Images")
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type // Ensure correct MIME type
      });

    if (uploadError) {
      console.error('Supabase storage upload failure:', uploadError.message);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Retrieve the absolute public URL for the newly uploaded asset
    const { data: urlData } = supabase.storage
      .from("Images")
      .getPublicUrl(filePath);

    console.log(`Binary sync successful. Public URL: ${urlData.publicUrl}`);

    return NextResponse.json({ 
      url: urlData.publicUrl,
      path: filePath 
    });

  } catch (err: any) {
    console.error('Critical failure in upload pipeline:', err);
    return NextResponse.json({ 
      error: err.message || "Internal server error during media synchronization" 
    }, { status: 500 });
  }
}
