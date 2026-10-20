# Changelog

## 1.0.3 — 2026-10-20

- Escapes untrusted subtitle filenames and malformed timestamp text in exported Markdown reports.

## 1.0.2 — 2026-10-13

- Adds versioned URLs for browser modules so hosted pages fetch the current analysis logic after an update.

## 1.0.1 — 2026-10-13

- Detects overlaps with an earlier long cue even when a shorter cue appears between them.

## 1.0.0 — 2026-10-10

- First public release of the offline SRT/WebVTT preflight checker.
- Detects malformed timestamps, non-positive durations, overlaps, reading-speed outliers, line-length and line-count issues, unusual display duration, duplicate text, and replacement characters.
- Compares two subtitle tracks by cue count and timing drift; exports a Markdown QA report.
- Includes five Node.js tests and a GitHub Pages deployment workflow.
