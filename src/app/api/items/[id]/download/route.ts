import { auth } from "@/auth";
import { getStoredItem, getStorageRecord } from "@/lib/db/items";
import { storageResponse } from "@/lib/storage-uploads";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const session = await auth();
    if (!session?.user.id) return Response.json({ error: "Please sign in again." }, { status: 401, headers });
    const { id } = await params;
    const item = await getStoredItem(session.user.id, id);
    if (!item?.fileKey) return Response.json({ error: "File not found." }, { status: 404, headers });
    const record = await getStorageRecord(session.user.id, item.fileKey);
    if (!record) return Response.json({ error: "File unavailable." }, { status: 404, headers });
    const response = await storageResponse(record.bucket, item.fileKey, request.signal);
    const preview = new URL(request.url).searchParams.get("preview") === "1" && ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(item.fileMimeType ?? "");
    const filename = encodeURIComponent(item.fileName ?? "download").replace(/['()*]/g, (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(response.body, { headers: {
      ...headers, "Content-Type": preview ? item.fileMimeType! : "application/octet-stream",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${filename}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch {
    return Response.json({ error: "Unable to download file. Please try again." }, { status: 502, headers });
  }
}
