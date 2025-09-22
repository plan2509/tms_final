import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { randomUUID } from "crypto"

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
])

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ success: false, error: "multipart/form-data required" }, { status: 400 })
    }

    const form = await req.formData()
    const entityType = String(form.get("entity_type") || "")
    const entityId = String(form.get("entity_id") || "")
    const file = form.get("file") as File | null

    if (!entityType || !entityId || !file) {
      return NextResponse.json({ success: false, error: "entity_type, entity_id, file are required" }, { status: 400 })
    }

    if (!["tax", "station_schedule"].includes(entityType)) {
      return NextResponse.json({ success: false, error: "invalid entity_type" }, { status: 400 })
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: "File too large (max 10MB)" }, { status: 413 })
    }

    const mime = file.type || "application/octet-stream"
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json({ success: false, error: "Only PDF/PNG/JPG/WEBP allowed" }, { status: 415 })
    }

    const arrayBuffer = await file.arrayBuffer()
    // Edge runtimes may not have Node Buffer; ensure using global Buffer
    const buffer = Buffer.from(arrayBuffer)
    const safeName = (file.name || "file").replace(/[^A-Za-z0-9._-]/g, "_")
    const ext = safeName.includes(".") ? safeName.split(".").pop() : undefined
    const fileId = randomUUID()
    const storagePath = `${entityType}/${entityId}/${fileId}${ext ? `.${ext}` : ""}`

    // Ensure bucket exists (idempotent)
    try {
      const { data: existing } = await supabase.storage.getBucket("attachments")
      if (!existing) {
        await supabase.storage.createBucket("attachments", { public: false })
      }
    } catch {}

    // Upload to storage (private bucket: attachments)
    const { data: uploadRes, error: uploadErr } = await supabase.storage
      .from("attachments")
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false,
      })

    if (uploadErr) {
      return NextResponse.json({ success: false, error: uploadErr.message }, { status: 500 })
    }

    // Insert metadata
    const { data: meta, error: metaErr } = await supabase
      .from("attachments")
      .insert([{
        entity_type: entityType,
        entity_id: entityId,
        file_name: safeName,
        mime_type: mime,
        size: file.size,
        storage_path: storagePath,
      }])
      .select()
      .single()

    if (metaErr) {
      // rollback storage
      await supabase.storage.from("attachments").remove([storagePath])
      return NextResponse.json({ success: false, error: metaErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, attachment: meta })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Unknown" }, { status: 500 })
  }
}


