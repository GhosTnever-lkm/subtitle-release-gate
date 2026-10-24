import { analyzeSubtitles, compareTracks, DEFAULT_RULES, makeMarkdownReport, parseSubtitle } from "./captionlint.js?v=1.0.4";

const $ = selector => document.querySelector(selector);
const state = { primary: null, secondary: null, report: null };
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function readFile(file) {
  if (!file) return null;
  if (!/\.(srt|vtt)$/i.test(file.name)) throw new Error("Choose a .srt or .vtt subtitle file.");
  return { name: file.name, parsed: parseSubtitle(await file.text(), file.name) };
}
function showFile(which, value) {
  const meta = $(`#${which}-meta`);
  if (!value) { meta.classList.add("hidden"); meta.textContent = ""; return; }
  meta.classList.remove("hidden"); meta.textContent = `${value.name} · ${value.parsed.cues.length} cues · ${value.parsed.format.toUpperCase()}`;
}
async function setFile(which, file) {
  try { state[which] = await readFile(file); showFile(which, state[which]); state.report = null; renderEmpty(); }
  catch (error) { state[which] = null; showFile(which, null); renderError(error.message); }
  $("#run-check").disabled = !state.primary;
}
function renderEmpty(message = "Add a subtitle file to see cue-level findings, readability checks and an exportable Markdown report.") {
  $("#results").innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><p class="eyebrow">READY WHEN YOU ARE</p><h2>Your report will appear here</h2><p>${escapeHtml(message)}</p><div class="empty-stats"><span><b>SRT</b> supported</span><span><b>VTT</b> supported</span><span><b>0</b> uploads</span></div></div>`;
}
function renderError(message) {
  $("#results").innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><p class="eyebrow">FILE NOT LOADED</p><h2>Could not read this subtitle</h2><p>${escapeHtml(message)}</p></div>`;
}
function renderReport() {
  const { primary, issues, comparison } = state.report;
  const count = level => issues.filter(x => x.severity === level).length;
  const entries = [...issues.map(x => ({ ...x, source: "Track QA" })), ...comparison.map(x => ({ ...x, source: "Track compare" }))];
  const cards = entries.map(x => `<article class="issue ${escapeHtml(x.severity)}"><div class="issue-top"><span>${escapeHtml(x.source)} · ${escapeHtml(x.code)}</span><span>${x.cue ? `CUE ${x.cue}` : "FILE"}${x.line ? ` · LINE ${x.line}` : ""}</span></div><p>${escapeHtml(x.message)}</p></article>`).join("");
  $("#results").innerHTML = `<div class="report-head"><div><p class="eyebrow">RELEASE CHECK</p><h2>${escapeHtml(primary.name)}</h2><div class="report-sub">${primary.parsed.cues.length} cues · ${primary.parsed.format.toUpperCase()}${state.secondary ? ` · compared with ${escapeHtml(state.secondary.name)}` : ""}</div></div><div class="report-actions"><button id="copy-report">Copy report</button><button id="download-report">Download .md</button></div></div><div class="summary"><span>${primary.parsed.cues.length} cues</span><span class="error">${count("error")} errors</span><span class="warning">${count("warning")} warnings</span><span>${count("notice")} notes</span><span>${comparison.length} comparison</span></div>${entries.length ? `<div class="issue-list">${cards}</div>` : `<div class="good-state">✓ No findings under the selected limits.</div>`}`;
  const markdown = makeMarkdownReport(primary.name, primary.parsed.cues, issues, comparison);
  $("#copy-report").addEventListener("click", async () => { await navigator.clipboard.writeText(markdown); $("#copy-report").textContent = "Copied"; });
  $("#download-report").addEventListener("click", () => { const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" }); const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `${primary.name.replace(/\.[^.]+$/, "")}-qa-report.md`; link.click(); URL.revokeObjectURL(url); });
}
function runCheck() {
  if (!state.primary) return;
  const rules = { ...DEFAULT_RULES, maxCps: Number($("#max-cps").value), maxLineChars: Number($("#max-line").value) };
  if (!Number.isFinite(rules.maxCps) || rules.maxCps < 1 || rules.maxCps > 60 || !Number.isInteger(rules.maxLineChars) || rules.maxLineChars < 10 || rules.maxLineChars > 100) { renderError("Reading speed must be 1–60 chars/s and line length must be an integer from 10 to 100."); return; }
  const issues = analyzeSubtitles(state.primary.parsed, rules), comparison = state.secondary ? compareTracks(state.primary.parsed, state.secondary.parsed) : [];
  state.report = { primary: state.primary, issues, comparison }; renderReport();
}
$("#primary-file").addEventListener("change", event => setFile("primary", event.target.files[0]));
$("#secondary-file").addEventListener("change", event => setFile("secondary", event.target.files[0]));
$("#run-check").addEventListener("click", runCheck);
for (const [zoneId, which] of [["drop-primary", "primary"], ["drop-secondary", "secondary"]]) {
  const zone = $(`#${zoneId}`);
  for (const eventName of ["dragenter", "dragover"]) zone.addEventListener(eventName, event => { event.preventDefault(); zone.classList.add("dragging"); });
  for (const eventName of ["dragleave", "drop"]) zone.addEventListener(eventName, event => { event.preventDefault(); zone.classList.remove("dragging"); });
  zone.addEventListener("drop", event => setFile(which, event.dataTransfer.files[0]));
}
