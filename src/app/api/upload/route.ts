import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with service role key for backend storage access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "Supabase server-side client not configured." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const propertyId = formData.get("propertyId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    // Organize by user and property for security and order
    const filePath = `${userId || 'system'}/${propertyId || 'misc'}/${fileName}`;

    const { data, error } = await supabase.storage
      .from("images")
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: urlData.publicUrl });

  } catch (err) {
    console.error('Server upload error:', err);
    return NextResponse.json({ error: "Internal server error during upload" }, { status: 500 });
  }
}
