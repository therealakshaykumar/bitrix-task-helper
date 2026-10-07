// Thin Bitrix24 REST client using an inbound webhook URL.
// BITRIX_WEBHOOK_URL example: https://yourcompany.bitrix24.com/rest/1/xxxxxxxxxxxx/

export const STATUS = {
  1: "New",
  2: "Pending",
  3: "In progress",
  4: "Awaiting control",
  5: "Completed",
  6: "Deferred",
};

async function call(method, params = {}) {
  const base = process.env.BITRIX_WEBHOOK_URL;
  if (!base) throw new Error("BITRIX_WEBHOOK_URL is not set in .env.local");
  const res = await fetch(base.replace(/\/+$/, "") + "/" + method + ".json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!json || json.error) {
    throw new Error(
      `Bitrix ${method}: ${json?.error_description || json?.error || "HTTP " + res.status}`
    );
  }
  return json;
}

// Bitrix descriptions are BBCode/HTML; reduce to readable plain text.
export function clean(text) {
  return String(text || "")
    .replace(/\[(url|URL)=([^\]]+)\]([^\[]*)\[\/(url|URL)\]/g, "$3 ($2)")
    .replace(/\[\/?[a-zA-Z*]+(=[^\]]*)?\]/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function listTasks({ status, search } = {}) {
  const me = await call("user.current");
  const filter = { RESPONSIBLE_ID: me.result.ID };
  if (status === "open") filter["<REAL_STATUS"] = 4;
  else if (status) filter.REAL_STATUS = status;
  if (search) filter["%TITLE"] = search;
  const json = await call("tasks.task.list", {
    filter,
    order: { ID: "desc" },
    select: ["ID", "TITLE", "STATUS", "DEADLINE", "PRIORITY", "CHANGED_DATE"],
  });
  return json.result.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: STATUS[t.status] || t.status,
    deadline: t.deadline,
    priority: t.priority,
    changed: t.changedDate,
  }));
}

const IMAGE_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const mimeFor = (name) => IMAGE_MIME[String(name).split(".").pop().toLowerCase()];

// Files attached to the task (needs the "disk" scope on the webhook). Failures are non-fatal.
async function getAttachments(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  for (const id of ids.slice(0, 20)) {
    try {
      const f = (await call("disk.attachedObject.get", { id })).result;
      out.push({
        id: String(f.ID),
        name: f.NAME,
        size: Number(f.SIZE || 0),
        mime: mimeFor(f.NAME) || null,
        url: f.DOWNLOAD_URL, // server-side only; stripped before sending to the browser
      });
    } catch {
      // missing disk scope or deleted file: skip
    }
  }
  return out;
}

// Download an attachment as base64 for sending to the model.
export async function downloadImage(att) {
  if (!att.mime) throw new Error(`${att.name} is not a supported image type`);
  if (att.size > MAX_IMAGE_BYTES) throw new Error(`${att.name} is larger than 4 MB`);
  let url = att.url;
  if (url.startsWith("/")) url = new URL(process.env.BITRIX_WEBHOOK_URL).origin + url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${att.name}: download failed (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error(`${att.name} is larger than 4 MB`);
  return { name: att.name, mime: att.mime, data: buf.toString("base64") };
}

const asList = (r) => (Array.isArray(r) ? r : r && typeof r === "object" ? Object.values(r) : []);

// Comments: try the classic task API first, then the forum API as a fallback.
// Errors are reported (not swallowed) so the UI can tell the user what is wrong.
async function getComments(id, t) {
  const debug = [];
  let list = [];

  try {
    const r = await call("task.commentitem.getlist", { TASKID: id, ORDER: { POST_DATE: "asc" } });
    list = asList(r.result).map((c) => ({
      id: String(c.ID),
      author: c.AUTHOR_NAME,
      date: c.POST_DATE,
      text: clean(c.POST_MESSAGE),
    }));
    debug.push(`task.commentitem.getlist: ${list.length}`);
  } catch (e) {
    debug.push(e.message);
  }

  if (list.length === 0 && t.forumTopicId) {
    try {
      const r = await call("forum.message.list", { FILTER: { TOPIC_ID: t.forumTopicId }, ORDER: { ID: "asc" } });
      list = asList(r.result).map((c) => ({
        id: "f" + c.ID,
        author: c.AUTHOR_NAME,
        date: c.POST_DATE,
        text: clean(c.POST_MESSAGE),
      }));
      debug.push(`forum.message.list: ${list.length}`);
    } catch (e) {
      debug.push(e.message);
    }
  }

  list = list.filter((c) => c.text); // drop empty/system-only entries
  return { list, debug, reported: Number(t.commentsCount || 0) };
}

export async function getTask(id) {
  const task = await call("tasks.task.get", { taskId: id, select: ["*", "CHECKLIST", "UF_TASK_WEBDAV_FILES"] });
  const t = task.result.task;
  const [attachments, comments] = await Promise.all([getAttachments(t.ufTaskWebdavFiles), getComments(id, t)]);
  return {
    attachments,
    id: t.id,
    title: t.title,
    status: STATUS[t.status] || t.status,
    deadline: t.deadline,
    creator: t.creator?.name,
    responsible: t.responsible?.name,
    description: clean(t.description),
    comments: comments.list,
    commentsReported: comments.reported,
    commentsDebug: comments.debug,
  };
}
