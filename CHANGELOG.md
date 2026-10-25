# Changelog

## 1.0.6 ? 2026-10-25

- Use English consistently for parser, readability, and track-comparison findings.
- Add a regression test that guards diagnostic language and key message output.
- Refresh app cache keys and displayed version.

## 1.0.5 — 2026-10-25

- Detect WebVTT from its file header only, so an SRT cue containing the word `WEBVTT` remains valid SRT.

## 1.0.4 — 2026-10-24

- Skip valid WebVTT metadata headers, including HLS `X-TIMESTAMP-MAP`, instead of reporting them as malformed cues.
- Preserve `WEBVTT` as a valid cue identifier after the actual file header.

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
