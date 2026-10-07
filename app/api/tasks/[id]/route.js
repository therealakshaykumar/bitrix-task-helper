import { getTask } from "@/lib/bitrix";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    const task = await getTask(id);
    // never expose Bitrix download URLs to the browser
    task.attachments = task.attachments.map(({ url, ...rest }) => ({ ...rest, isImage: !!rest.mime }));
    return Response.json(task);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
