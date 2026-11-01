import { auth } from "@/auth";
import { getItemDetail } from "@/lib/db/items";

interface ItemRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: ItemRouteContext) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const session = await auth();
    if (!session?.user.id) return Response.json({ error: "Sign in to view this item." }, { status: 401, headers });
    const { id } = await params;
    const item = await getItemDetail(session.user.id, id);
    if (!item) return Response.json({ error: "Item not found." }, { status: 404, headers });
    return Response.json({ data: item }, { headers });
  } catch {
    return Response.json({ error: "Unable to load item. Please try again." }, { status: 500, headers });
  }
}
