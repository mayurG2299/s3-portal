# Visual Test Slash Command — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/visual-test` Claude Code slash command that navigates to a URL, audits the page visually and functionally, produces a structured report, and applies approved fixes.

**Architecture:** A single markdown file at `~/.claude/commands/visual-test.md` acts as a Claude Code slash command skill. When invoked, it instructs Claude to drive the browser via the Playwright MCP tools already available in the session — no code, no npm packages, no project changes.

**Tech Stack:** Claude Code slash commands, Playwright MCP tools (`browser_navigate`, `browser_take_screenshot`, `browser_snapshot`, `browser_console_messages`, `browser_network_requests`, `browser_evaluate`, `browser_click`, `browser_fill_form`, `browser_type`, `browser_wait_for`), axe-core (CDN, injected at runtime)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `~/.claude/commands/visual-test.md` | The slash command skill — full instructions for Claude to run a visual audit |
| Modify | `.gitignore` | Add `.superpowers/` so brainstorm mockups aren't committed |

---

## Task 1: Add `.superpowers/` to `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Open `.gitignore` and append the entry**

Add at the end of `.gitignore`:

```
# superpowers brainstorm mockups
.superpowers/
```

- [ ] **Step 2: Verify it's ignored**

```bash
git check-ignore -v .superpowers/brainstorm/
```

Expected output: `.gitignore:N:.superpowers/	.superpowers/brainstorm/`

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers/ brainstorm directory"
```

---

## Task 2: Create the `/visual-test` slash command

**Files:**
- Create: `~/.claude/commands/visual-test.md`

This is a Claude Code user-level command (global, not project-scoped). It lives in `~/.claude/commands/` and is available in any project.

- [ ] **Step 1: Create the commands directory if it doesn't exist**

```bash
mkdir -p ~/.claude/commands
```

- [ ] **Step 2: Write the slash command file**

Create `~/.claude/commands/visual-test.md` with the following content:

````markdown
---
description: Visually audit a web page or user flow, generate a structured report with screenshots, and apply approved fixes
argument-hint: <url> [flow description]
---

You are running a visual audit of a web page using the Playwright MCP browser tools.

## Arguments

The user invoked this command as: `/visual-test $ARGUMENTS`

Parse `$ARGUMENTS` as:
- **URL** (required): the first token — a full URL including scheme and route (e.g. `https://myapp.com/dashboard/files`)
- **Flow description** (optional): everything after the URL — a plain-English description of an interactive flow to execute

If no URL is provided, reply: "Usage: `/visual-test <url> [flow description]`" and stop.

---

## Execution Steps

Work through these steps in order. Announce each step as you begin it.

### Step 1 — Navigate

Use `browser_navigate` to open the URL. Wait for the page to load (target: `domcontentloaded`).

**Auth redirect check:** After navigation, use `browser_snapshot` to read the current URL. If the current URL differs from the requested URL (e.g. redirected to `/login`), stop and warn the user:

> "⚠️ Redirected to `<actual-url>` — the page requires authentication. Include login steps in the flow description, e.g.: `/visual-test <url> \"log in with user@example.com / password, then <action>\"`"

Do not proceed with the audit unless the user confirms or provides a flow with login steps.

### Step 2 — Screenshots

Take two screenshots using `browser_take_screenshot`:
1. Full-page screenshot at default (desktop) viewport
2. Resize to 375px width using `browser_resize`, take a second screenshot (mobile), then resize back to desktop

Attach both screenshots inline.

### Step 3 — Console & Network Audit

- Use `browser_console_messages` to collect all console output. Note any errors or warnings.
- Use `browser_network_requests` to collect all network requests. Note:
  - Any requests with status 4xx or 5xx (Critical)
  - Any requests with response time > 2000ms (Info — performance hint)
  - Any unusually large response sizes > 500KB (Info — performance hint)

### Step 4 — Flow Execution (if flow description provided)

Interpret the plain-English flow description and execute it step by step:
- Use `browser_click` to click elements (find by visible label, role, or text)
- Use `browser_type` or `browser_fill_form` to enter text
- After each action, use `browser_wait_for` to wait up to 5 seconds for the DOM to settle
- Take a screenshot after each significant step using `browser_take_screenshot`
- If an expected element cannot be found, log: "🔴 Flow step failed: could not find `<element>` — continuing with remaining steps"

### Step 5 — Accessibility Audit

Inject and run axe-core using `browser_evaluate`:

```javascript
// Step 5a: inject axe-core
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js';
document.head.appendChild(script);
await new Promise(resolve => script.onload = resolve);
```

```javascript
// Step 5b: run audit
const results = await axe.run();
return JSON.stringify(results.violations.map(v => ({
  id: v.id,
  impact: v.impact,
  description: v.description,
  nodes: v.nodes.map(n => n.html).slice(0, 2)
})));
```

If injection fails (e.g. CSP block, script.onload never fires within 5s), add to report:
> "🟡 Accessibility audit skipped — axe-core blocked by Content Security Policy. Manual review required."

And continue without an a11y section.

### Step 6 — Generate Report

Output the report using this exact format:

```
## Visual Test Report — <url>
Tested: <date and time>

### 🔴 Critical (N)
N. <Issue title>
   📸 See screenshot above / [screenshot label]
   📁 Source: <file>:<line if determinable, else "unknown">
   Fix: <concrete description of what to change>

### 🟡 Warning (N)
...

### 🔵 Info (N)
...

---
Severity key:
🔴 Critical — broken functionality, JS errors, failed requests, flow failures, auth issues
🟡 Warning — accessibility violations, layout problems, CSP blocks
🔵 Info — performance hints, non-breaking suggestions

---
Proposed fixes — approve to apply:
[ ] Fix #1 — <short title>
[ ] Fix #2 — <short title>
...

Reply "fix all", "fix 1,2", or name specific fixes to apply. Reply "done" to close without fixing.
```

If no issues were found, output:
```
## Visual Test Report — <url>
✅ No issues found. Page looks good.
```

### Step 7 — Apply Fixes & Verify

For each approved fix:
1. Read the relevant source file
2. Make the minimal change that addresses the issue
3. Confirm the change with a brief diff summary

After all fixes are applied:
- Use `browser_navigate` to reload the page
- Take a new full-page screenshot
- For each fixed issue, state: "✅ Resolved" or "⚠️ Still present after fix — manual review needed"
- Do not retry automatically if still present; surface it to the user

---

## Notes

- The app must already be running and accessible at the provided URL before you invoke this command
- No auth state is persisted between runs — always include login steps in the flow description for authenticated pages
- Axe-core injection requires internet access; it will fail silently on offline or CSP-restricted pages
- Fix verification is visual — Claude re-screenshots and assesses, it does not re-run the full audit
````

- [ ] **Step 3: Verify the command is available**

In a Claude Code session, type `/visual-test` and confirm it appears in the command autocomplete list.

- [ ] **Step 4: Smoke test — static page**

Run against any publicly accessible page (or your locally running dev server):

```
/visual-test https://example.com
```

Expected: Claude navigates, takes 2 screenshots (desktop + mobile), checks console and network, runs axe-core, outputs a report. No fix prompt needed if no issues found.

- [ ] **Step 5: Smoke test — flow**

```
/visual-test https://example.com "click the More information link"
```

Expected: Claude navigates, clicks the link, screenshots after the click, includes the step in the report.

- [ ] **Step 6: Smoke test — auth redirect**

Point at an authenticated route without providing login steps:

```
/visual-test http://localhost:3000/dashboard/files
```

Expected: Claude detects the redirect to `/login`, warns the user, and stops before running the audit.

---

## Done

At this point:
- `.superpowers/` is gitignored
- `/visual-test <url> [flow]` is available globally in any Claude Code session
- The command handles: static audits, interactive flows, auth redirect detection, axe-core CSP failures, structured reports, fix approval, and post-fix verification
