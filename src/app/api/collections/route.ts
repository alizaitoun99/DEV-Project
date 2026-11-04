import { auth } from "@/auth";
import { collectionCreateSchema } from "@/lib/collection-validation";
import { createCollection, getCollectionOptions } from "@/lib/db/collections";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return Response.json({ success: false, error: "Invalid request origin." }, { status: 403, headers });
    }
    const session = await auth();
    if (!session?.user.id) {
      return Response.json({ success: false, error: "Please sign in again." }, { status: 401, headers });
    }
    const text = await request.text();
    if (text.length > 100000) {
      return Response.json({ success: false, error: "Request too large." }, { status: 413, headers });
    }
    let input: unknown;
    try { input = JSON.parse(text); } catch {
      return Response.json({ success: false, error: "Invalid request body." }, { status: 400, headers });
    }
    const parsed = collectionCreateSchema.safeParse(input);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") }, { status: 400, headers });
    }
    const data = await createCollection(session.user.id, parsed.data);
    return Response.json({ success: true, data }, { status: 201, headers });
  } catch {
    return Response.json({ success: false, error: "Unable to create collection. Please try again." }, { status: 500, headers });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.id) return Response.json({ success: false, error: "Please sign in again." }, { status: 401, headers });
    const data = await getCollectionOptions(session.user.id);
    return Response.json({ success: true, data }, { headers });
  } catch {
    return Response.json({ success: false, error: "Unable to load collections. Please try again." }, { status: 500, headers });
  }
}
