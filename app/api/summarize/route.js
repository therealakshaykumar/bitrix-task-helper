import { getTask, downloadImage } from "@/lib/bitrix";
import { summarizeTask } from "@/lib/gemini";

export const dynamic = "force-dynamic";

const MAX_IMAGES = 6;

export async function POST(req) {
  try {
    const { taskId, context, projectContext, template, attachmentIds = [], images = [], commentIds, includeDescription = true } = await req.json();
    if (!taskId) throw new Error("taskId is required");

    const task = await getTask(taskId);
    // user-chosen subset of comments (undefined = all) and optional description
    if (Array.isArray(commentIds)) task.comments = task.comments.filter((c) => commentIds.includes(c.id));
    if (!includeDescription) task.description = "";
    const warnings = [];
    const sendImages = [];

    for (const att of task.attachments.filter((a) => attachmentIds.includes(a.id))) {
      try {
        sendImages.push(await downloadImage(att));
      } catch (e) {
        warnings.push(e.message);
      }
    }
    for (const img of images) {
      if (img?.data && /^image\/(png|jpeg|gif|webp)$/.test(img.mime)) sendImages.push(img);
    }
    if (sendImages.length > MAX_IMAGES) {
      warnings.push(`Only the first ${MAX_IMAGES} images were sent.`);
      sendImages.length = MAX_IMAGES;
    }

    const result = await summarizeTask(task, {
      extraContext: context,
      projectContext,
      template,
      images: sendImages,
    });
    return Response.json({ ...result, imagesSent: sendImages.map((i) => i.name), warnings });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
