"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEMPLATES } from "@/lib/templates";

const MAX_IMG_BYTES = 4 * 1024 * 1024;
const MAX_MANUAL_IMAGES = 5;
const store = {
  get: (k, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const readImage = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name || "pasted-image.png", mime: file.type, data: String(r.result).split(",")[1], preview: r.result });
    r.onerror = reject;
    r.readAsDataURL(file);
  });

async function api(url, opts) {
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const isOverdue = (t) => t.deadline && t.status !== "Completed" && new Date(t.deadline) < new Date();
const badgeClass = (s) => "badge s-" + String(s).toLowerCase().replace(/\s+/g, "-");

function Skeleton({ lines = 3 }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skel" style={{ width: `${95 - i * 12}%` }} />
      ))}
    </div>
  );
}

function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [listErr, setListErr] = useState("");

  const [task, setTask] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [taskErr, setTaskErr] = useState("");

  const [context, setContext] = useState("");
  const [result, setResult] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);

  const [template, setTemplate] = useState("general");
  const [projectContext, setProjectContext] = useState("");
  const [settingsDraft, setSettingsDraft] = useState("");
  const [images, setImages] = useState([]); // manually added screenshots
  const [selectedAtt, setSelectedAtt] = useState([]); // Bitrix attachment ids to send
  const [selectedComments, setSelectedComments] = useState([]); // comment ids to include
  const [includeDesc, setIncludeDesc] = useState(true);
  const [dragging, setDragging] = useState(false);

  const [modal, setModal] = useState(null); // "result" | "confirm" | "settings" | null
  const [tab, setTab] = useState("prompt");
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((message, type = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListErr("");
    try {
      setTasks(await api(`/api/tasks?status=${status}&q=${encodeURIComponent(q)}`));
    } catch (e) {
      setListErr(e.message);
      toast(e.message, "err");
    }
    setLoadingList(false);
  }, [status, q, toast]);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const t = store.get("bth.template", "general");
    setTemplate(TEMPLATES[t] ? t : "general");
    setProjectContext(store.get("bth.projectContext"));
  }, []);

  const addImages = useCallback(async (files) => {
    const imgs = [...files].filter((f) => /^image\/(png|jpeg|gif|webp)$/.test(f.type));
    if (!imgs.length) return toast("Only PNG, JPG, GIF or WebP images are supported", "err");
    const tooBig = imgs.filter((f) => f.size > MAX_IMG_BYTES);
    const ok = imgs.filter((f) => f.size <= MAX_IMG_BYTES);
    if (tooBig.length) toast(`${tooBig.length} image(s) skipped: over 4 MB`, "err");
    const read = await Promise.all(ok.map(readImage));
    setImages((cur) => {
      const next = [...cur, ...read].slice(0, MAX_MANUAL_IMAGES);
      if (cur.length + read.length > MAX_MANUAL_IMAGES) toast(`Max ${MAX_MANUAL_IMAGES} screenshots`, "err");
      return next;
    });
  }, [toast]);

  // paste screenshots anywhere while a task is open (ignore pastes of plain text)
  useEffect(() => {
    if (!activeId) return;
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); addImages(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [activeId, addImages]);

  async function openTask(id) {
    setActiveId(id);
    setTask(null);
    setResult(null);
    setPrompt("");
    setEdited(false);
    setTaskErr("");
    setImages([]);
    setSelectedAtt([]);
    setSelectedComments([]);
    setIncludeDesc(true);
    try {
      const t = await api(`/api/tasks/${id}`);
      setTask(t);
      setSelectedComments(t.comments.map((c) => c.id));
      setSelectedAtt(t.attachments.filter((a) => a.isImage).map((a) => a.id));
    } catch (e) {
      setTaskErr(e.message);
      toast(e.message, "err");
    }
  }

  async function runSummarize() {
    setModal(null);
    setBusy(true);
    setTaskErr("");
    try {
      const r = await api("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: activeId,
          context,
          projectContext,
          template,
          attachmentIds: selectedAtt,
          commentIds: selectedComments,
          includeDescription: includeDesc,
          images: images.map(({ name, mime, data }) => ({ name, mime, data })),
        }),
      });
      setResult(r);
      setPrompt(r.prompt || "");
      setEdited(false);
      setTab("prompt");
      setModal("result");
      toast(r.imagesSent?.length ? `Prompt generated from ${r.imagesSent.length} image(s) + text` : "Prompt generated");
      (r.warnings || []).forEach((w) => toast(w, "err"));
    } catch (e) {
      setTaskErr(e.message);
      toast(e.message, "err");
    }
    setBusy(false);
  }

  function onGenerate() {
    // don't silently discard hand-edited prompt
    if (result && edited) setModal("confirm");
    else runSummarize();
  }

  async function copy(text, label = "Prompt copied to clipboard") {
    try {
      await navigator.clipboard.writeText(text);
      toast(label);
    } catch {
      toast("Copy failed — select the text and copy manually", "err");
    }
  }

  const summaryMarkdown = result
    ? `## Summary\n${result.summary}\n\n## Requirements\n${(result.requirements || []).map((r) => "- " + r).join("\n")}` +
      ((result.open_questions || []).length ? `\n\n## Open questions\n${result.open_questions.map((r) => "- " + r).join("\n")}` : "")
    : "";

  return (
    <div className="app">
      <aside className="side">
        <header>
          <div className="brand">
            <span className="logo">B</span>
            <strong>Task Helper</strong>
            <button className="icon" title="Project context" aria-label="Project context"
              onClick={() => { setSettingsDraft(projectContext); setModal("settings"); }}>⚙</button>
            <button className="icon" onClick={loadList} disabled={loadingList} title="Refresh" aria-label="Refresh">
              <span className={loadingList ? "spin" : ""}>⟳</span>
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); loadList(); }}>
            <input placeholder="Search title and press Enter…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="seg">
            {[["open", "Open"], ["5", "Done"], ["", "All"]].map(([v, l]) => (
              <button key={l} className={status === v ? "on" : ""} onClick={() => setStatus(v)}>{l}</button>
            ))}
          </div>
        </header>
        <div className="list">
          {loadingList && tasks.length === 0 && [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="item"><Skeleton lines={2} /></div>
          ))}
          {listErr && <div className="item err">{listErr}</div>}
          {tasks.map((t) => (
            <div key={t.id} className={"item" + (t.id === activeId ? " active" : "")} onClick={() => openTask(t.id)}>
              <div className="t">{t.title}</div>
              <div className="meta row">
                <span>#{t.id}</span>
                <span className={badgeClass(t.status)}>{t.status}</span>
                {t.deadline && <span className={isOverdue(t) ? "due over" : "due"}>⏰ {fmtDate(t.deadline)}</span>}
              </div>
            </div>
          ))}
          {!loadingList && !listErr && tasks.length === 0 && <div className="empty">No tasks found.</div>}
        </div>
      </aside>

      <main className="main">
        {!activeId && (
          <div className="hero">
            <div className="hero-ic">📝</div>
            <h2>Pick a task</h2>
            <p className="meta">Select a task on the left to review it, summarize the requirement and copy a ready-to-use prompt.</p>
          </div>
        )}
        {taskErr && <div className="banner err">{taskErr}</div>}
        {activeId && !task && !taskErr && (
          <div className="card"><Skeleton lines={5} /></div>
        )}
        {task && (
          <>
            <div className="head">
              <div>
                <h1>{task.title}</h1>
                <div className="meta row">
                  <span>#{task.id}</span>
                  <span className={badgeClass(task.status)}>{task.status}</span>
                  <span>{task.creator || "?"} → {task.responsible || "?"}</span>
                  {task.deadline && <span className={isOverdue(task) ? "due over" : "due"}>⏰ Due {fmtDate(task.deadline)}</span>}
                </div>
              </div>
              <div className="row">
                {result && <button className="secondary" onClick={() => setModal("result")}>View result</button>}
                <button onClick={onGenerate} disabled={busy}>
                  {busy ? <><span className="spin">⟳</span> Generating…</> : result ? "Regenerate" : "✨ Summarize & build prompt"}
                </button>
              </div>
            </div>

            <div className={"card pick" + (includeDesc ? " sel" : "")}>
              <label className="pick-head">
                <input type="checkbox" checked={includeDesc} onChange={(e) => setIncludeDesc(e.target.checked)} />
                <h3>Description {includeDesc ? "" : "(excluded)"}</h3>
              </label>
              <div className="pre">{task.description || <span className="meta">(empty)</span>}</div>
            </div>

            <div className="card">
              <div className="row between">
                <h3 style={{ margin: 0 }}>
                  Comments ({selectedComments.length} of {task.comments.length} selected)
                </h3>
                {task.comments.length > 0 && (
                  <div className="row">
                    <button className="secondary sm" onClick={() => setSelectedComments(task.comments.map((c) => c.id))}>All</button>
                    <button className="secondary sm" onClick={() => setSelectedComments([])}>None</button>
                    <button className="secondary sm" onClick={() => setSelectedComments(task.comments.slice(-3).map((c) => c.id))}>Last 3</button>
                  </div>
                )}
              </div>
              {task.comments.length === 0 && (
                <div className="meta" style={{ marginTop: 8 }}>
                  No comments loaded.
                  {task.commentsReported > 0 && ` Bitrix reports ${task.commentsReported} comment(s), but the API returned none.`}
                  {task.commentsDebug?.length > 0 && <> Details: {task.commentsDebug.join(" | ")}</>}
                </div>
              )}
              {task.comments.map((c) => {
                const on = selectedComments.includes(c.id);
                return (
                  <label key={c.id} className={"comment pick" + (on ? " sel" : "")}>
                    <input type="checkbox" checked={on}
                      onChange={(e) => setSelectedComments((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))} />
                    <div className="avatar">{(c.author || "?")[0]}</div>
                    <div className="grow">
                      <div className="meta"><b>{c.author}</b> · {fmtDateTime(c.date)}</div>
                      <div className="pre">{c.text}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div
              className={"card drop" + (dragging ? " over" : "")}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addImages(e.dataTransfer.files); }}
            >
              <h3>Attachments &amp; screenshots</h3>
              {task.attachments.length > 0 && (
                <div className="chips">
                  {task.attachments.map((a) => (
                    <label key={a.id} className={"chip" + (a.isImage ? "" : " off")} title={a.isImage ? "Send to Gemini" : "Not an image — not sent"}>
                      <input type="checkbox" disabled={!a.isImage} checked={selectedAtt.includes(a.id)}
                        onChange={(e) => setSelectedAtt((s) => e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id))} />
                      {a.isImage ? "🖼" : "📄"} {a.name}
                    </label>
                  ))}
                </div>
              )}
              {images.length > 0 && (
                <div className="thumbs">
                  {images.map((im, i) => (
                    <div key={i} className="thumb">
                      <img src={im.preview} alt={im.name} />
                      <button className="x" aria-label="Remove" onClick={() => setImages((c) => c.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="meta">
                Drop images here, paste with Ctrl+V, or{" "}
                <label className="link">browse
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden
                    onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
                </label>. PNG/JPG/GIF/WebP, up to 4 MB each.
                {task.attachments.length === 0 && " No files found on the Bitrix task (the webhook also needs the “disk” scope to list them)."}
              </div>
            </div>

            <div className="card">
              <h3>Prompt options</h3>
              <div className="seg tpl">
                {Object.entries(TEMPLATES).map(([k, t]) => (
                  <button key={k} className={template === k ? "on" : ""}
                    onClick={() => { setTemplate(k); store.set("bth.template", k); }}>{t.label}</button>
                ))}
              </div>
              <textarea rows={3} style={{ marginTop: 10 }} value={context} onChange={(e) => setContext(e.target.value)}
                placeholder="Extra context for this task only: files, branch, anything the prompt should mention…" />
              <div className="meta" style={{ marginTop: 6 }}>
                {projectContext
                  ? "Your saved project context (⚙) is included automatically."
                  : "Tip: save your stack and conventions once with ⚙ so every prompt includes them."}
              </div>
            </div>
          </>
        )}
      </main>

      {modal === "result" && result && (
        <Modal
          wide
          title="Task summary & prompt"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="secondary" onClick={() => copy(summaryMarkdown, "Summary copied")}>Copy summary</button>
              <button onClick={() => copy(prompt)}>📋 Copy prompt</button>
            </>
          }
        >
          <div className="tabs">
            <button className={tab === "prompt" ? "on" : ""} onClick={() => setTab("prompt")}>Prompt{edited ? " •" : ""}</button>
            <button className={tab === "summary" ? "on" : ""} onClick={() => setTab("summary")}>Summary</button>
          </div>
          {tab === "prompt" ? (
            <textarea className="big" rows={16} value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setEdited(true); }} />
          ) : (
            <div>
              <div className="pre">{result.summary}</div>
              {result.requirements?.length > 0 && (<><h3 className="mt">Requirements</h3><ul>{result.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul></>)}
              {result.open_questions?.length > 0 && (<><h3 className="mt">Open questions</h3><ul>{result.open_questions.map((r, i) => <li key={i}>{r}</li>)}</ul></>)}
            </div>
          )}
        </Modal>
      )}

      {modal === "settings" && (
        <Modal
          title="Project context"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="secondary" onClick={() => setModal(null)}>Cancel</button>
              <button onClick={() => {
                setProjectContext(settingsDraft);
                store.set("bth.projectContext", settingsDraft);
                setModal(null);
                toast("Project context saved");
              }}>Save</button>
            </>
          }
        >
          <p className="meta" style={{ marginTop: 0 }}>
            Standing info added to every generated prompt: stack, repo layout, naming and coding conventions.
            Stored only in this browser.
          </p>
          <textarea rows={9} value={settingsDraft} onChange={(e) => setSettingsDraft(e.target.value)}
            placeholder={"e.g. Polymer 3 web app (footprints-web), GraphQL clients in src/restclient, branch names feature/<id>_<slug>, match surrounding code style, no new dependencies."} />
        </Modal>
      )}

      {modal === "confirm" && (
        <Modal
          title="Replace your edited prompt?"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="secondary" onClick={() => setModal("result")}>Keep my edits</button>
              <button onClick={runSummarize}>Regenerate</button>
            </>
          }
        >
          <p>You've edited the generated prompt. Regenerating will overwrite your changes.</p>
        </Modal>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + t.type}>{t.type === "err" ? "⚠ " : "✓ "}{t.message}</div>
        ))}
      </div>
    </div>
  );
}
