import { listTasks } from "@/lib/bitrix";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  try {
    return Response.json(await listTasks({ status: p.get("status") || "open", search: p.get("q") || "" }));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
