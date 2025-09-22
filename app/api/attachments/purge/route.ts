import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await req.json().catch(() => ({}))
    const entityType = String(body.entity_type || "")
    const entityId = String(body.entity_id || "")
    if (!entityType || !entityId) {
      return NextResponse.json({ success: false, error: "entity_type, entity_id are required" }, { status: 400 })
    }
    if (!["tax", "station_schedule"].includes(entityType)) {
      return NextResponse.json({ success: false, error: "invalid entity_type" }, { status: 400 })
    }

    const { data: list, error } = await supabase
      .from("attachments")
      .select("id, storage_path")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    const paths = (list || []).map((x: any) => x.storage_path)
    if (paths.length > 0) {
      await supabase.storage.from("attachments").remove(paths)
    }
    await supabase.from("attachments").delete().eq("entity_type", entityType).eq("entity_id", entityId)

    return NextResponse.json({ success: true, deleted: paths.length })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Unknown" }, { status: 500 })
  }
}


