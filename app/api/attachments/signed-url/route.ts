import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// 7 days in seconds
const EXPIRES_IN = 7 * 24 * 60 * 60

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const url = new URL(req.url)
    const attachmentId = url.searchParams.get("id")
    if (!attachmentId) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 })
    }

    const { data: meta, error } = await supabase
      .from("attachments")
      .select("id, storage_path, file_name, mime_type, size")
      .eq("id", attachmentId)
      .maybeSingle()
    if (error || !meta) {
      return NextResponse.json({ success: false, error: error?.message || "Not found" }, { status: 404 })
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("attachments")
      .createSignedUrl(meta.storage_path, EXPIRES_IN, { download: meta.file_name })
    if (signErr || !signed) {
      return NextResponse.json({ success: false, error: signErr?.message || "Failed to sign" }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: signed.signedUrl })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Unknown" }, { status: 500 })
  }
}


