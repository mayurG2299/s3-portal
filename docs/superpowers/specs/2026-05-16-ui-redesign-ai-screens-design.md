# UI Redesign — AI Screens & Navigation Design Spec

## Goal

Redesign the sidebar navigation and add four new AI-powered screens (Credential Setup, AI Search palette, Search Results page, Indexing Pipeline Dashboard) while enforcing consistent design language, keyboard shortcuts, and symmetric RBAC across every surface.

---

## Design Principles (apply to every screen)

### Visual consistency
- Icon library: **Lucide** exclusively — no emojis, no other icon packs
- Typography scale unchanged from existing app

### Theme system — mandatory constraint
The app ships with **6 themes × 2 modes = 12 combinations**: Nebula (default), Catppuccin, Tokyo Night, Dracula, Nord, Rosé Pine — each with dark and light variants. Themes are applied via `data-theme="[id]"` + `.dark` class on `<html>`, controlled by `next-themes`.

**Every new component must use CSS variables, never hardcoded colours.** The visual companion mockups showed Nebula-dark hex values for illustration only — do not copy those into code.

| What you want | Use this — not a hex |
|---|---|
| Page background | `hsl(var(--background))` |
| Card / panel background | `hsl(var(--card))` |
| Primary / brand colour | `hsl(var(--primary))` or `hsl(var(--brand))` |
| Muted text | `hsl(var(--muted-foreground))` |
| Subtle border | `hsl(var(--border))` |
| Gradient button | `.btn-primary-gradient` utility class |
| Glass card | `.glass-card` or `.glass-panel` utility class |
| Brand gradient text | `.gradient-text` utility class |
| Destructive red | `hsl(var(--destructive))` |

The existing utility classes in `app/globals.css` (`.glass-card`, `.glass-panel`, `.btn-primary-gradient`, `.gradient-text`, `.glass-morphic`) already adapt to all themes — use them as the first option before writing new styles. Only write new CSS custom-property-based styles when none of the existing utilities fit.

### Keyboard shortcuts (symmetric — all pages)
Every page that lists files or navigable rows must respond to these shortcuts. They are registered via the existing global keyboard handler pattern.

| Key | Action |
|---|---|
| `↑` `↓` | Move row focus |
| `Space` | Open file preview modal |
| `↵` | Open / confirm |
| `F` | Favorite selected file |
| `⌘L` | Copy direct link |
| `⌘⇧S` | Share selected file |
| `Del` | Delete (Owner/Admin only) |
| `⌘A` | Select all visible rows |
| `⇧↑` `⇧↓` | Extend selection |
| `Esc` | Clear selection / close overlay |
| `⌘K` | Jump to AI Search input |

Page-specific additions are documented per screen below and must also be added to the keyboard shortcuts modal (`KeyboardShortcutsModal`) under an appropriate section heading.

### RBAC — symmetric enforcement
- Every client UI element hidden for a role must **also** be blocked server-side (403 / redirect)
- Never rely solely on hiding links — admin routes enforce auth on the server regardless of nav visibility
- Bucket-scoped access applies everywhere: Explorer, Search Results, Recents, Shared Links, Indexing Dashboard — results are silently filtered to permitted buckets; no "access denied" noise shown to end users
- The same action permissions that apply in the Explorer apply identically in Search Results, Recents, and anywhere else files are rendered
- Inline component descriptions in this spec use "(Owner/Admin only)" notation to mark gated elements so engineers do not need to cross-reference the summary table

---

## 1. Sidebar Navigation Redesign

### Structure
Three collapsible groups replacing the flat nav list. Group expand/collapse state is persisted in `localStorage` keyed by user ID.

**Pinned (above groups)**
- Dashboard (`LayoutDashboard`) — always visible, no group

**AI Search bar** — persistent below the logo/team header, above the groups. Clicking triggers ⌘K palette.

**FILES group** (purple `#6366f1` Lucide icon tint)
- Explorer (`FolderOpen`)
- Shared Links (`Link2`)
- Recents (`Clock`)

**WORKSPACE group** (amber `#f59e0b` Lucide icon tint)
- Team (`Users`)
- Invitations (`Mail`) — red badge shows pending count

**ADMIN group** (zinc `#3f3f46` icons, collapsed by default)
- Permissions (`Shield`)
- Audit Logs (`FileText`)
- Indexing Pipeline (`Cpu`)

### Single-item group rule
If a role can only see one item within a group, the group label and chevron are **not** rendered — the single item is shown flat (no collapsible wrapper). This applies to Viewer role in the WORKSPACE group (Invitations only).

### Role visibility
| Role | FILES | WORKSPACE | ADMIN group |
|---|---|---|---|
| Owner | All items | Team + Invitations | Expanded, all items |
| Admin | All items | Team + Invitations | Expanded, all items |
| Viewer | Explorer, Shared Links, Recents | Invitations only (flat, no group wrapper) | Hidden |

### Profile context menu (3-dots / `MoreHorizontal`)
Opens a popover anchored to the profile footer. Contains:

- Profile header (avatar, name, email — not clickable, informational)
- **Account** — navigates to `/dashboard/account` (profile photo, display name, email)
- **AI & Indexing** — navigates to `/dashboard/settings?tab=ai` (shortcut into the AI credential tab)
- **Appearance** — theme toggle (Light / Dark), stored in `localStorage`
- Help & Support
- Keyboard shortcuts
- Divider
- **Sign out** (destructive red, `LogOut` icon)

Note: "Settings" does not appear as a nav item — it is accessed via the **Account** or **AI & Indexing** shortcuts in this menu.

---

## 2. Credential Setup Wizard

**Route:** `/dashboard/settings?tab=ai` (rendered as a tab within the existing Settings page)
**Page file:** `app/dashboard/settings/page.tsx` — add "AI & Indexing" tab
**Access:** Owner + Admin only. Tab UI hidden for Viewer. Server-side enforcement: all credential API routes call `requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'EDIT')`.

**API routes (new):**
- `GET /api/admin/ai-credentials` — returns `{ openai: { configured: boolean, lastFour: string | null }, anthropic: { configured: boolean, lastFour: string | null } }`. Enforces `ADMIN_SETTINGS` / `VIEW`.
- `POST /api/admin/ai-credentials` — body `{ provider: 'openai' | 'anthropic', key: string }`. Saves encrypted key server-side. Enforces `ADMIN_SETTINGS` / `EDIT`.
- `POST /api/admin/ai-credentials/test` — fires a live check against both providers, returns `{ openai: { ok: boolean, latencyMs: number, error?: string }, anthropic: { ok: boolean, latencyMs: number, error?: string } }`. Enforces `ADMIN_SETTINGS` / `VIEW`.

### States

**State A — Not configured (empty)**
- Centered empty state card inside the tab body
- `KeyRound` icon, heading "AI features not configured", description of what AI unlocks
- Single CTA: "Configure AI Keys" (`Wand2` icon, gradient button) — opens the wizard inline

**State B — Setup wizard (3 steps)**
Step indicator at top of the tab section showing: OpenAI → Anthropic → Test

Step 1 — **OpenAI**
- Description: "Used for file embeddings and audio/video transcription (Whisper)"
- Masked input (`type="password"`) with eye-toggle
- Inline format validation: detects `sk-` prefix, shows "Valid key format detected" (`Check` icon, indigo)
- Info callout: "Keys are stored encrypted server-side and never re-exposed to the browser"
- CTA: Save & Continue → calls `POST /api/admin/ai-credentials`

Step 2 — **Anthropic**
- Description: "Used for image captioning and AI agent result ranking (Claude Haiku)"
- Same masked input pattern as Step 1
- Detects `sk-ant-` prefix for format validation
- CTA: Save & Continue → calls `POST /api/admin/ai-credentials` with `{ provider: 'anthropic', key }`

Step 3 — **Test connection**
- Calls `POST /api/admin/ai-credentials/test`
- Loading state: spinner with "Testing connections..."
- **Success path:** Green check row per provider showing name + "Connected" + latency (e.g., "142 ms")
- **Failure path (one or both fail):**
  - Red `XCircle` row per failed provider with plain-language error (e.g., "Invalid API key")
  - Amber info callout: "AI features will not work until this is resolved"
  - Two CTAs: "Skip & Save anyway" (outlined, amber) and "Retry test" (gradient)
  - "Skip & Save anyway" saves with a `DEGRADED` config flag and transitions to State C with an amber warning badge instead of green Active badge

**State C — Configured (read view)**
- Two provider rows: icon + name + masked key (last 4 chars) + status badge
  - Status badge: green "Active" (both tests passed last time) or amber "Degraded" (saved with test failure)
- "Last tested X ago" timestamp + "Test connection" inline link
- Edit button top-right: re-opens wizard with current keys masked, allows replacement

**DEGRADED → Active resolution:**
When the user clicks "Test connection" from State C and `POST /api/admin/ai-credentials/test` returns all providers `ok: true`, the config flag is cleared server-side (the endpoint writes the test timestamp and removes the DEGRADED flag) and the UI re-fetches `GET /api/admin/ai-credentials`. The badge updates from amber "Degraded" to green "Active" in place — no page navigation required. If the test still fails, the badge stays amber and the error message updates inline.

---

## 3. AI Search — Command Palette (⌘K)

**Trigger:** `⌘K` global shortcut or clicking the AI Search bar in the sidebar
**Access:** All roles. Results silently scoped to permitted buckets — no error shown for scoping.

### States

**State A — Empty (no query)**
- Search input with `Sparkles` icon, placeholder "Search files with AI..."
- If recent searches exist: list of last 5 queries (clickable to re-run), each with a `Clock` icon
- If **no recent searches** (first-time user): show 3 hardcoded example prompts to guide the user:
  - "Show me product demo videos"
  - "Find the latest financial reports"
  - "Images with charts or dashboards"
  - Label: "Try asking..." above the suggestions
- Keyboard hint footer: `↑↓` navigate · `↵` run · `Esc` close

**State B — Loading**
- Input shows typed query; `Sparkles` icon pulses (CSS animation)
- Three pulsing dots with "AI is searching your files..." label
- `Esc` still closes immediately

**State C — Results**
- AI summary banner (indigo-tinted bg, left border): plain-language summary of what was found and where
- Result rows (up to 8 in palette): file type icon · name · parent path · match % badge
- Active/focused row: left accent border `#6366f1` + subtle background `#6366f10a`
- Footer: keyboard hints + result count + **"See all results →"** link (navigates to `/dashboard/search?q=<query>`)

**State D — No results**
- AI summary banner: "No files matched your query. Try rephrasing or using different keywords."
- Suggestions: related terms or broader phrasing (returned from the agent if available, else hidden)

### File type icon colors
| Type | Lucide Icon | Stroke color |
|---|---|---|
| Video | `Video` | `#a78bfa` (violet) |
| Image | `Image` | `#4ade80` (green) |
| PDF / Doc | `FileText` | `#f87171` (red) |
| Audio | `Music` | `#60a5fa` (blue) |
| Generic | `File` | `#71717a` (zinc) |

### Keyboard shortcuts (palette-scoped)
These are active only while the palette is open and must be listed in the keyboard shortcuts modal under a "Search Palette" section.

| Key | Action |
|---|---|
| `↑` `↓` | Navigate results |
| `↵` | Open selected file |
| `Space` | Preview selected file (opens existing preview modal) |
| `⌘↵` | Open selected file in new tab (palette-scoped; does not apply outside palette) |
| `Esc` | Close palette |
| `⌘K` | Refocus search input if a result row is focused |

---

## 4. AI Search — Full Results Page (`/dashboard/search`)

**Route:** `/dashboard/search?q=<query>`
**Page file:** `app/dashboard/search/page.tsx` (within the dashboard layout, which provides `RBACProvider` and the sidebar)
**Access:** All roles. File actions in the preview pane are RBAC-gated identically to the Explorer.

The "Back" breadcrumb navigates to `/dashboard/files`.

### Layout (three-panel)

**Top bar**
- Back breadcrumb: `← Files`
- Persistent search input (refine query inline, re-runs search on `↵`)
- View toggle: List (`List` icon) / Grid (`Grid2x2` icon) — grid view is a future enhancement, toggle is shown but grid is v2
- Result count

**AI summary bar** — same indigo banner as palette, full sentence explaining results and top folder location

**Left panel — Filters (180px fixed)**
- **File Type** — checkboxes with counts computed from the full result set returned by the agent (not a separate facet API call). If the result set is small enough to fit in one response, counts are exact. No counts are shown if the result set is paginated in future.
- **Bucket** — shows only buckets the user has access to (silently omits inaccessible ones)
- **Match Score** — High (80%+), Medium (50–79%), Low (<50%) — filters client-side
- "Clear filters" button at bottom

**Center panel — Results list**
Each row:
- File type icon (color-coded per table above)
- Name + parent path + modified date
- AI-extracted content snippet (italic, muted) — why the file matched
- Match % badge: `≥80%` = indigo badge, `<80%` = zinc badge
- Selected row: left accent border + background tint
- Selected row shows expanded snippet (2 lines instead of 1)

**Right panel — Preview pane (240px fixed)**
Visible when a result row is selected. Collapses to hidden when selection is cleared (`Esc`).
- File type icon + name + parent path
- **"Why this matched"** block (indigo border-left card) — AI reasoning for this specific file
- File metadata: size, MIME type, modified date, indexed status
- **Actions:**
  - "Open file" (gradient button, `ExternalLink` icon)
  - "Download" (outlined button, `Download` icon)
  - "Share link" (`Share2` icon) — **(Owner/Admin only; hidden for Viewer)**
  - "Delete" (`Trash2` icon, destructive red outlined) — **(Owner/Admin only; hidden for Viewer)**

### Keyboard shortcuts (page-scoped)
All global file shortcuts apply. Additionally:

| Key | Action |
|---|---|
| `R` | Retry indexing for selected file (Owner/Admin only) |
| `⌘K` | Focus the search input to refine query |

---

## 5. Indexing Pipeline Dashboard

**Route:** `/dashboard/admin/indexing`
**Page file:** `app/dashboard/admin/indexing/page.tsx`
**Access:** Owner + Admin only. Server returns 403 for all other roles — the route is not rendered in the nav for Viewer.

### Worker status & controls

**Live state (worker running)**
- Header badge: pulsing green dot + "Live" label (`bg: #14291f, border: #22c55e30`)
- "Pause worker" button (outlined, `PauseCircle` icon) — calls `POST /api/admin/indexing/pause`

**Paused state (worker paused)**
- Header badge changes to: static amber dot + "Paused" label (`bg: #1c1400, border: #f59e0b30`)
- Button toggles to "Resume worker" (outlined, amber `PlayCircle` icon) — calls `POST /api/admin/indexing/resume`
- Stat cards remain visible; queue is not processing but counts still reflect current DB state

**Retry All Failed**
- Calls `POST /api/admin/indexing/retry-failed` with **no request body** — re-queues all FAILED files
- **Requires confirmation dialog** before firing: "Retry X failed files? This will re-queue them for AI processing and consume API credits." — with "Retry X files" (destructive gradient) and "Cancel" buttons
- X is the current FAILED count pulled from the stat cards

### Stat cards (4-column grid)

| Card | Value | Sub-label |
|---|---|---|
| Total Files | `total` from status API | "across all buckets" |
| Indexed | `indexed` count + progress bar + percentage | Progress bar: `indexed / total * 100%` |
| Processing | `processing` count | "in queue" (no ETA — not enough data for reliable estimate) |
| Failed | `failed` count | "needs attention" |

### Tab bar
Tabs: **Failed** (default) · Processing · Done · All
Each tab label shows count in parentheses. Inline filter input (right-aligned) filters by filename within the current tab client-side.

### Table columns
`Name + path + error` · `MIME type` · `Attempts` · `Last tried` · `Action`

**Failed tab row detail:**
- File name (truncated with ellipsis, full name on hover via `title` attr) + parent path
- Error message inline below path in red `#f87171` — plain language (e.g., "Whisper API timeout after 3 retries")
- Attempts badge: `3/3` in red = max retries hit, needs investigation beyond just retry
- Per-row "Retry" button — fires immediately with no confirmation (single-file, low cost impact)
- Selected row: left `#6366f1` border

### Keyboard hint bar (bottom of page)
`↑↓` select row · `R` retry selected · `⌘A` select all · `Space` open file preview · `Esc` clear selection

### Auto-refresh
Polls `GET /api/admin/indexing/status` every 30 seconds. Timestamp shown: "Last refreshed: X seconds ago". Updates all stat cards and the current tab table in place.

---

## 6. File Indexing Status Badge (Explorer)

**Location:** Additional column in the Explorer file list, between "Modified" and "Actions"
**Column header:** "AI Index"
**Access:** Owner + Admin only. Column hidden entirely for Viewer role — no layout shift, grid columns reflow.

### Four badge states

| DB Status | Lucide Icon | Label | Badge colors |
|---|---|---|---|
| `DONE` | `Check` | "Indexed" | bg `#14291f`, border `#22c55e25`, text `#22c55e` |
| `PROCESSING` | `RotateCw` (spinning) | "Indexing" | bg `#1a1430`, border `#6366f125`, text `#818cf8` |
| `FAILED` | `AlertCircle` | "Failed" | bg `#1a0808`, border `#ef444425`, text `#f87171` — clickable |
| `PENDING` / null | `Clock` | "Queued" | bg `#1c1c1f`, border `#ffffff0d`, text `#52525b` |

The `PROCESSING` badge uses a CSS `spin` animation on the `RotateCw` icon (same as existing upload spinner pattern in the codebase).

### Failed badge interaction
Clicking the red "Failed" badge opens a tooltip/popover anchored to the badge:
- `AlertCircle` icon + "Indexing failed" heading
- Plain-language error message (from `FileEmbedding.errorMessage`)
- "Retry indexing" button — calls `POST /api/admin/indexing/retry-failed` with body `{ fileId: string }` to retry only that specific file. Button fires immediately (no confirmation — single file, low cost). Closes popover on success and transitions badge to `PENDING` optimistically.

**API contract for `POST /api/admin/indexing/retry-failed`:**
- No body (or `{}`) → re-queues **all** FAILED files (used by the dashboard "Retry All Failed" button)
- Body `{ fileId: string }` → re-queues only that specific file (used by the explorer badge retry and the per-row retry in the dashboard)

### Update cadence
Badges update via the existing `/api/events/files` SSE stream. **This requires adding a new event type** to the SSE infrastructure:
- Add `indexing-status-changed` to the `FileChangedAction` union in `lib/events/types.ts`
- Emit this event from the indexing worker (`lib/workers/indexing-worker.ts`) when a file transitions to `DONE` or `FAILED`
- The Explorer's existing SSE subscriber receives the event and updates the relevant badge in place without a full page refresh

Cross-reference: see `2026-05-16-semantic-file-indexing-design.md` for the worker implementation. As a fallback, the Explorer already refetches on its standard polling interval — so badges degrade gracefully to ~30s polling if the SSE event is not yet implemented.

---

## Role Visibility Summary

| Screen / Feature | Owner | Admin | Viewer |
|---|---|---|---|
| Sidebar ADMIN group | Visible | Visible | Hidden |
| Sidebar WORKSPACE group | Team + Invitations | Team + Invitations | Invitations only (flat, no group wrapper) |
| Settings → AI & Indexing tab | Full access | Full access | Hidden |
| Credential API routes | Accessible | Accessible | 403 server-side |
| AI Search palette (⌘K) | All results in scope | All results in scope | Results scoped to permitted buckets |
| Search Results page | All actions | All actions | Open + Download only (Share, Delete hidden) |
| Indexing Dashboard route | Full | Full | 403 server-side |
| Explorer indexing badge column | Visible | Visible | Column hidden entirely |
| Failed badge retry button | Available | Available | N/A (badge hidden) |

---

## Out of Scope

- Mobile / responsive layout (desktop-first B2B)
- Dark/light theme toggle implementation (design supports it via CSS variables; toggle is a placeholder in this iteration)
- Grid view on Search Results page (toggle shown but renders list; grid is v2)
- Notification center / toast history
- WebSocket-based real-time updates (SSE via existing `/api/events/files` is sufficient; WebSockets are not introduced)
- Per-file indexing cost tracking or API usage reporting
