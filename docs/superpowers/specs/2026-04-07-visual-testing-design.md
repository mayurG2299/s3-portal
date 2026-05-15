# Visual Testing + Claude Integration — Design Spec

**Date:** 2026-04-07
**Status:** Approved

---

## Overview

A manual, on-demand visual testing workflow for the S3 Portal web app. The user triggers a test via a `/visual-test` slash command, specifying a URL and an optional plain-English flow description. Claude drives the browser using the Playwright MCP tools already available in the Claude Code session, captures screenshots, audits the page, and produces a structured report. Claude then proposes targeted fixes and applies only those the user approves. After applying fixes, Claude re-screenshots the page to verify each issue is resolved.

---

## Goals

- Test any page or user flow on demand, without a fixed test suite
- Catch visual bugs, JS errors, broken flows, accessibility violations, and performance hints
- Produce a report with screenshot evidence and exact file references
- Fix approved issues and verify them in the same session
- Zero extra tooling — uses Playwright MCP already wired into Claude Code

---

## Non-Goals

- Automated CI/CD integration (manual only)
- Baseline/diff screenshot comparison (no stored baselines)
- Cross-browser testing (Playwright MCP runs Chromium)
- Sharing reports with teammates outside Claude Code

---

## Command Interface

```
/visual-test <url> [flow description]
```

### Arguments

| Argument | Required | Description |
|---|---|---|
| `<url>` | Yes | Full URL including base and route (e.g. `https://myapp.com/dashboard/files`) |
| `[flow description]` | No | Plain-English description of an interactive flow to execute |

### Examples

```bash
# Static page audit
/visual-test https://myapp.com/dashboard/files

# Specific route on staging
/visual-test https://staging.myapp.com/login

# Interactive flow — include login steps if the page requires auth
/visual-test https://myapp.com/login "log in with test@test.com / password123, then go to files, upload a file, and share it"

# Authenticated page — must describe login as the first step
/visual-test https://myapp.com/dashboard "log in first, then check the dashboard layout"
```

---

## What Claude Checks

### Visual / Layout
- Broken layouts, overflow, clipping
- Missing or broken images
- Incorrect colors, dark/light theme issues
- Mobile responsiveness (375px viewport screenshot)

### Functional
- JavaScript console errors and warnings
- Failed network requests (4xx, 5xx)
- Broken buttons, links, and form interactions
- Flow step failures (element not found, unexpected state)

### Accessibility
- Color contrast failures (WCAG AA: 4.5:1 normal, 3:1 large)
- Missing alt text and ARIA labels
- Keyboard navigation issues
- Missing focus indicators

### Performance Hints
- Slow API responses (>2s) detected via `browser_network_requests` response times
- Large assets flagged from network request sizes
- Blocking requests visible in the network waterfall

---

## Execution Steps

For each test run, Claude:

1. **Navigate** — Opens the URL in Playwright browser. Waits up to 10 seconds for `domcontentloaded`, then an additional 3 seconds for network activity to settle. If the page has persistent connections (WebSockets, SSE, long-polling), Claude proceeds after the 3-second settling window without waiting for full network idle.

   **Auth redirect check:** After navigation, Claude compares the final URL to the requested URL. If they differ (e.g. redirected to `/login`), Claude immediately warns the user and asks whether to proceed (by including login steps) or abort. It does not generate a report for a redirect page.

2. **Screenshot** — Full-page screenshot + 375px mobile viewport screenshot.

3. **Console + network audit** — Collects all JS errors, warnings, failed requests (4xx/5xx), and network response times via `browser_console_messages` and `browser_network_requests`. Flags any API response exceeding 2s as a performance hint.

4. **Flow execution** (if provided) — Interprets the plain-English flow description, interacts with the live DOM step by step using `browser_click`, `browser_type`, `browser_fill_form`. After each step, waits for the DOM to settle (up to 5s) before proceeding. If an expected element is not found, Claude logs a Critical issue ("flow step failed: could not find X") and continues with remaining steps where possible.

5. **Accessibility audit** — Injects axe-core via `browser_evaluate` using the axe-core CDN URL. If injection fails (e.g. blocked by Content Security Policy), Claude adds a Warning to the report: "Accessibility audit skipped — axe-core blocked by CSP. Manual review required." and continues without an a11y section.

6. **Report** — Outputs structured report (see format below).

7. **Fix + verify** — Applies approved fixes to source files, then re-navigates to the page and takes a new screenshot. For each fixed issue, Claude states whether it is visually resolved or still present. If an issue is still present after the fix, Claude flags it as "unresolved after fix" in the report and does not retry automatically — the user decides next steps.

---

## Report Format

Issues are grouped by severity. Each issue includes a screenshot reference, a file/line pointer where determinable, and a proposed fix.

```
## Visual Test Report — <url>

### 🔴 Critical (N)
1. <Issue title>
   📸 Screenshot: [attached]
   📁 Source: <file>:<line>
   Fix: <description of change>

### 🟡 Warning (N)
...

### 🔵 Info (N)
...

---
Proposed fixes — approve to apply:
[ ] Fix #1 — <short title>
[ ] Fix #2 — <short title>
...

Reply "fix all", "fix 1,2" or approve individually.
```

Severity definitions:
- 🔴 **Critical** — broken functionality, JS errors, failed requests, auth issues, flow failures
- 🟡 **Warning** — accessibility violations, layout issues on any viewport, CSP blocks
- 🔵 **Info** — performance hints, suggestions (non-breaking)

---

## Implementation

**One new file:**

```
~/.claude/commands/visual-test.md
```

A Claude Code slash command skill that instructs Claude to execute the above steps using the Playwright MCP tools: `browser_navigate`, `browser_take_screenshot`, `browser_snapshot`, `browser_console_messages`, `browser_network_requests`, `browser_evaluate`, `browser_click`, `browser_fill_form`, `browser_type`, `browser_wait_for`.

No changes to the S3 Portal project itself. No npm installs. No config files.

---

## Constraints

- The app must already be running and accessible at the provided URL
- No auth state is persisted between runs — include login steps in the flow description for any authenticated page
- Axe-core accessibility audit requires internet access (CDN injection); CSP-blocked pages will skip a11y with a Warning
- Fix verification is visual only — Claude re-screenshots and assesses, it does not re-run automated checks after fixing
