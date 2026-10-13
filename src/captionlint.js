export const DEFAULT_RULES = Object.freeze({ maxCps: 20, maxLineChars: 42, maxLines: 2, minDurationMs: 700, maxDurationMs: 7000 });

const ISSUE = (severity, code, message, cue, line) => ({ severity, code, message, cue, line });
const timestamp = (raw, format) => {
  if (format === "vtt") {
    const vtt = raw.trim().match(/^(?:(\d{2,}):)?([0-5]?\d):([0-5]\d)\.(\d{3})$/);
    if (!vtt) return null;
    return Number(vtt[1] || 0) * 3600000 + Number(vtt[2]) * 60000 + Number(vtt[3]) * 1000 + Number(vtt[4]);
  }
  const re = /^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/;
  const m = raw.trim().match(re);
  if (!m || Number(m[2]) > 59 || Number(m[3]) > 59) return null;
  return Number(m[1]) * 3600000 + Number(m[2]) * 60000 + Number(m[3]) * 1000 + Number(m[4]);
};

export function parseSubtitle(source, name = "subtitles.srt") {
  const text = String(source).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const format = /\.vtt$/i.test(name) || /^WEBVTT(?:\s|$)/m.test(text) ? "vtt" : "srt";
  const cues = [], issues = [];
  if (format === "vtt" && !/^WEBVTT(?:\s|$)/.test(text.trimStart())) {
    issues.push(ISSUE("error", "vtt-header", "WebVTT-файл должен начинаться с WEBVTT.", null, 1));
  }
  const lines = text.split("\n");
  let i = 0, cueNumber = 0;
  while (i < lines.length) {
    const raw = lines[i], trimmed = raw.trim();
    if (!trimmed || (format === "vtt" && /^(WEBVTT|NOTE(?:\s|$)|STYLE$|REGION$)/.test(trimmed))) {
      const block = format === "vtt" && /^(NOTE(?:\s|$)|STYLE$|REGION$)/.test(trimmed);
      i++;
      if (block) while (i < lines.length && lines[i].trim()) i++;
      continue;
    }
    const startLine = i + 1;
    let id = null, timing = trimmed;
    if (!timing.includes("-->")) {
      if (format === "srt" && /^\d+$/.test(trimmed)) { id = Number(trimmed); i++; timing = (lines[i] || "").trim(); }
      else if (format === "vtt") { id = trimmed; i++; timing = (lines[i] || "").trim(); }
      else { issues.push(ISSUE("error", "unexpected-line", "Ожидалась строка тайминга SRT.", null, startLine)); i++; continue; }
    }
    const match = timing.match(/^(.+?)\s+-->\s+(.+?)(?:\s+.*)?$/);
    if (!match) { issues.push(ISSUE("error", "invalid-timing", "Не удалось прочитать строку тайминга.", null, i + 1)); i++; continue; }
    const start = timestamp(match[1], format), end = timestamp(match[2], format);
    i++;
    const body = [];
    while (i < lines.length && lines[i].trim() !== "") body.push(lines[i++]);
    cueNumber++;
    if (start === null || end === null) { issues.push(ISSUE("error", "invalid-timestamp", `Неверный формат таймкода: ${match[1]} --> ${match[2]}.`, cueNumber, startLine)); continue; }
    cues.push({ id: id ?? cueNumber, start, end, text: body.join("\n"), line: startLine, cue: cueNumber });
    if (!body.some(line => line.trim())) issues.push(ISSUE("error", "empty-cue", "Пустой субтитр.", cueNumber, startLine));
    if (end <= start) issues.push(ISSUE("error", "nonpositive-duration", "Конец должен быть позже начала.", cueNumber, startLine));
  }
  return { format, cues, issues, lineCount: lines.length };
}

export function analyzeSubtitles(parsed, rules = DEFAULT_RULES) {
  const issues = [...parsed.issues];
  const overlapByCue = new Map();
  const timeOrdered = parsed.cues.filter(cue => cue.end > cue.start).slice().sort((a, b) => a.start - b.start || a.cue - b.cue);
  let widestOverlap = null;
  for (const cue of timeOrdered) {
    if (widestOverlap && cue.start < widestOverlap.end) overlapByCue.set(cue.cue, { withCue: widestOverlap.cue, duration: widestOverlap.end - cue.start });
    if (!widestOverlap || cue.end > widestOverlap.end) widestOverlap = cue;
  }
  let previous = null;
  for (const cue of parsed.cues) {
    const duration = cue.end - cue.start;
    const text = cue.text.trim();
    const visibleChars = [...text.replace(/<[^>]*>/g, "").replace(/\{[^}]*\}/g, "")].filter(c => !/\s/.test(c)).length;
    if (duration > 0 && visibleChars / (duration / 1000) > rules.maxCps)
      issues.push(ISSUE("warning", "reading-speed", `${(visibleChars / (duration / 1000)).toFixed(1)} знака/с — выше лимита ${rules.maxCps}.`, cue.cue, cue.line));
    if (duration > 0 && duration < rules.minDurationMs)
      issues.push(ISSUE("warning", "short-duration", `Показ ${duration} мс — короче минимума ${rules.minDurationMs} мс.`, cue.cue, cue.line));
    if (duration > rules.maxDurationMs)
      issues.push(ISSUE("notice", "long-duration", `Показ ${(duration / 1000).toFixed(1)} с — дольше ориентира ${rules.maxDurationMs / 1000} с.`, cue.cue, cue.line));
    const rows = cue.text.split("\n");
    if (rows.length > rules.maxLines) issues.push(ISSUE("warning", "too-many-lines", `${rows.length} строк при лимите ${rules.maxLines}.`, cue.cue, cue.line));
    rows.forEach((row, idx) => {
      const n = [...row].length;
      if (n > rules.maxLineChars) issues.push(ISSUE("warning", "line-too-long", `Строка ${idx + 1}: ${n} символов при лимите ${rules.maxLineChars}.`, cue.cue, cue.line + 1 + idx));
    });
    if (text.includes("\uFFFD")) issues.push(ISSUE("warning", "replacement-character", "Найден символ замены �; проверь кодировку исходного файла.", cue.cue, cue.line));
    const overlap = overlapByCue.get(cue.cue);
    if (overlap) issues.push(ISSUE("warning", "overlap", `Пересекается с cue ${overlap.withCue} на ${overlap.duration} мс.`, cue.cue, cue.line));
    if (previous && text && text.toLocaleLowerCase() === previous.text.trim().toLocaleLowerCase()) issues.push(ISSUE("notice", "duplicate-text", `Текст повторяет cue ${previous.cue}.`, cue.cue, cue.line));
    previous = cue;
  }
  return issues;
}

export function compareTracks(a, b) {
  const issues = [];
  if (a.cues.length !== b.cues.length) issues.push(ISSUE("warning", "cue-count-mismatch", `Число cue различается: ${a.cues.length} и ${b.cues.length}.`, null, null));
  for (let i = 0; i < Math.min(a.cues.length, b.cues.length); i++) {
    const left = a.cues[i], right = b.cues[i];
    const ds = Math.abs(left.start - right.start), de = Math.abs(left.end - right.end);
    if (ds > 500 || de > 500) issues.push(ISSUE("notice", "timing-drift", `Cue ${i + 1}: начало отличается на ${ds} мс, конец — на ${de} мс.`, i + 1, left.line));
    if (!left.text.trim() || !right.text.trim()) issues.push(ISSUE("warning", "missing-translation", `Cue ${i + 1}: пустой текст хотя бы в одной дорожке.`, i + 1, left.line));
  }
  return issues;
}

export function makeMarkdownReport(name, cues, issues, comparison = []) {
  const tally = ["error", "warning", "notice"].map(level => `${level}: ${issues.filter(x => x.severity === level).length}`).join(" · ");
  const rows = issues.map(x => `| ${x.severity} | ${x.code} | ${x.cue ?? "—"} | ${x.line ?? "—"} | ${x.message.replaceAll("|", "\\|")} |`);
  const compareRows = comparison.map(x => `| ${x.severity} | ${x.cue ?? "—"} | ${x.message.replaceAll("|", "\\|")} |`);
  return `# Subtitle QA report\n\n- File: ${name}\n- Cues parsed: ${cues.length}\n- Findings: ${tally}\n\n| Severity | Rule | Cue | Source line | Finding |\n|---|---|---:|---:|---|\n${rows.join("\n") || "| — | — | — | — | No findings |"}${comparison.length ? `\n\n## Track comparison\n\n| Severity | Cue | Finding |\n|---|---:|---|\n${compareRows.join("\n")}` : ""}\n`;
}
