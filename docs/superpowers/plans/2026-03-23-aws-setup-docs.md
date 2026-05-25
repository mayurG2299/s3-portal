# AWS Setup Documentation Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a publicly accessible `/help/aws-setup` documentation page with desktop sidebar navigation and mobile responsive drawer, featuring step-by-step AWS IAM setup, S3 bucket creation, and S3 Portal connection flows.

**Architecture:** Hybrid responsive layout with sticky desktop sidebar (240px) for "Getting Started" and "On This Page" navigation, auto-collapsing to mobile hamburger menu (<1024px). Main content renders numbered steps with callouts, tables, and troubleshooting Q&A cards. Public route with no authentication required.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui components, Lucide React icons

---

## File Structure

**New Files to Create:**
- `app/help/` — new help section root
  - `layout.tsx` — optional shared layout wrapper
  - `aws-setup/`
    - `page.tsx` — main page component (entry point)
- `components/help/` — new help component folder
  - `AwsSetupSidebar.tsx` — desktop sticky sidebar with navigation
  - `AwsSetupMobileNav.tsx` — mobile header + hamburger + drawer
  - `AwsSetupContent.tsx` — main content area with steps/troubleshooting
  - `AwsSetupStep.tsx` — reusable step component with number + line + body
  - `AwsSetupCallout.tsx` — reusable callout box (tip/warning)
  - `AwsSetupTroubleshooting.tsx` — troubleshooting section with Q&A cards

**Files to Modify:**
- `lib/error-translator.ts` — verify 8 references to `/docs/aws-setup` point to `/help/aws-setup`
- `components/onboarding/FirstTimeWizard.tsx` — verify 1 reference to `/docs/aws-setup` points to `/help/aws-setup`

---

## Task Breakdown

### Task 1: Create Help Directory Structure

**Files:**
- Create: `app/help/aws-setup/page.tsx`
- Create: `app/help/layout.tsx`

- [ ] **Step 1: Create help folder structure**

```bash
mkdir -p app/help/aws-setup
```

- [ ] **Step 2: Create minimal layout wrapper**

In `app/help/layout.tsx`:
```typescript
export default function HelpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
```

- [ ] **Step 3: Create aws-setup page entry point**

In `app/help/aws-setup/page.tsx`:
```typescript
'use client'

import AwsSetupSidebar from '@/components/help/AwsSetupSidebar'
import AwsSetupMobileNav from '@/components/help/AwsSetupMobileNav'
import AwsSetupContent from '@/components/help/AwsSetupContent'
import { useState } from 'react'

export default function AwsSetupPage() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AwsSetupSidebar />
      </div>

      {/* Mobile Header + Drawer */}
      <div className="lg:hidden">
        <AwsSetupMobileNav 
          isOpen={mobileDrawerOpen} 
          onToggle={() => setMobileDrawerOpen(!mobileDrawerOpen)} 
        />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="lg:ml-60">
        <AwsSetupContent />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify page renders**

Run: `npm run dev` → navigate to `http://localhost:3000/help/aws-setup`
Expected: Page loads, components imported but not yet built

- [ ] **Step 5: Commit**

```bash
git add app/help/
git commit -m "feat: create help structure for aws-setup page"
```

---

### Task 2: Build AwsSetupSidebar Component

**Files:**
- Create: `components/help/AwsSetupSidebar.tsx`

- [ ] **Step 1: Create sidebar component**

```typescript
'use client'

export default function AwsSetupSidebar() {
  const sections = [
    {
      label: 'Getting Started',
      items: [
        { label: 'Overview', href: '/help', active: false },
        { label: 'AWS S3 Setup', href: '/help/aws-setup', active: true }
      ]
    },
    {
      label: 'On This Page',
      items: [
        { label: 'Create IAM user', href: '#step1' },
        { label: 'Generate access keys', href: '#step2' },
        { label: 'Create S3 bucket', href: '#step3' },
        { label: 'Connect to portal', href: '#step4' },
        { label: 'Troubleshooting', href: '#troubleshoot' }
      ]
    }
  ]

  return (
    <aside className="fixed left-0 top-0 w-60 h-screen overflow-y-auto border-r border-border bg-background p-10">
      {/* Logo */}
      <a href="/" className="flex items-center gap-2 mb-10 hover:opacity-80 transition">
        <div className="w-8 h-8 bg-accent/10 border border-accent/25 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg 
            className="w-4 h-4 text-accent" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">S3 Portal</div>
          <div className="text-xs text-muted-foreground">Documentation</div>
        </div>
      </a>

      {/* Navigation Sections */}
      {sections.map((section) => (
        <div key={section.label} className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground opacity-70 mb-3 px-2">
            {section.label}
          </div>
          <nav className="space-y-1">
            {section.items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  item.active 
                    ? 'bg-accent/10 text-accent font-medium' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span className="w-1 h-1 rounded-full flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  )
}
```

- [ ] **Step 2: Verify sidebar renders**

Run: `npm run dev` → navigate to `http://localhost:3000/help/aws-setup` on desktop/wide screen
Expected: Sidebar appears on left with S3 Portal branding, two sections visible

- [ ] **Step 3: Commit**

```bash
git add components/help/AwsSetupSidebar.tsx
git commit -m "feat: add desktop sidebar navigation"
```

---

### Task 3: Build AwsSetupMobileNav Component

**Files:**
- Create: `components/help/AwsSetupMobileNav.tsx`

- [ ] **Step 1: Create mobile header + drawer**

```typescript
'use client'

import { Menu, X } from 'lucide-react'

interface AwsSetupMobileNavProps {
  isOpen: boolean
  onToggle: () => void
}

export default function AwsSetupMobileNav({ isOpen, onToggle }: AwsSetupMobileNavProps) {
  const sections = [
    {
      label: 'Getting Started',
      items: [
        { label: 'Overview', href: '/help' },
        { label: 'AWS S3 Setup', href: '/help/aws-setup', active: true }
      ]
    },
    {
      label: 'On This Page',
      items: [
        { label: 'Create IAM user', href: '#step1' },
        { label: 'Generate access keys', href: '#step2' },
        { label: 'Create S3 bucket', href: '#step3' },
        { label: 'Connect to portal', href: '#step4' },
        { label: 'Troubleshooting', href: '#troubleshoot' }
      ]
    }
  ]

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={onToggle}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="font-semibold text-sm flex-1 text-center mx-4">AWS S3 Setup</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Mobile Drawer */}
      {isOpen && (
        <nav className="fixed top-14 left-0 right-0 z-40 bg-background border-b border-border overflow-y-auto max-h-[calc(100vh-56px)]">
          <div className="p-6 space-y-8">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground opacity-70 mb-3">
                  {section.label}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => onToggle()} // Close drawer on link click
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors block ${
                        item.active 
                          ? 'bg-accent/10 text-accent font-medium' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="w-1 h-1 rounded-full flex-shrink-0" />
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify mobile nav renders**

Run: `npm run dev` → resize browser to <1024px width
Expected: Hamburger menu appears in top-left, clicking toggles drawer

- [ ] **Step 3: Commit**

```bash
git add components/help/AwsSetupMobileNav.tsx
git commit -m "feat: add mobile hamburger menu and drawer"
```

---

### Task 4: Build Reusable Components (Callout, Step, Troubleshooting)

**Files:**
- Create: `components/help/AwsSetupCallout.tsx`
- Create: `components/help/AwsSetupStep.tsx`
- Create: `components/help/AwsSetupTroubleshooting.tsx`

- [ ] **Step 1: Create Callout component**

```typescript
// components/help/AwsSetupCallout.tsx
'use client'

import { AlertCircle, Lightbulb } from 'lucide-react'

interface CalloutProps {
  type: 'tip' | 'warning'
  children: React.ReactNode
}

export default function AwsSetupCallout({ type, children }: CalloutProps) {
  const styles = {
    tip: 'bg-accent/10 border-accent/25 text-accent',
    warning: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-600 dark:text-yellow-500'
  }
  const icons = {
    tip: <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />,
    warning: <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
  }

  return (
    <div className={`flex gap-3 p-3.5 rounded-lg border ${styles[type]} text-sm my-4`}>
      {icons[type]}
      <div className="text-muted-foreground">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create Step component**

```typescript
// components/help/AwsSetupStep.tsx
'use client'

interface StepProps {
  number: number
  title: string
  isLast?: boolean
  children: React.ReactNode
}

export default function AwsSetupStep({ number, title, isLast = false, children }: StepProps) {
  return (
    <div className="flex gap-5 relative">
      {/* Left Column: Number & Line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0 z-10">
          {number}
        </div>
        {!isLast && (
          <div className="w-0.5 bg-border flex-1 my-1 min-h-8" />
        )}
      </div>

      {/* Right Column: Content */}
      <div className="pb-10 flex-1 pt-1">
        <h3 className="text-base font-semibold mb-3">{title}</h3>
        <div className="text-muted-foreground text-sm space-y-3">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Troubleshooting component**

```typescript
// components/help/AwsSetupTroubleshooting.tsx
'use client'

interface TroubleItem {
  q: string
  a: string
}

interface TroubleshootingProps {
  items: TroubleItem[]
}

export default function AwsSetupTroubleshooting({ items }: TroubleshootingProps) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div 
          key={idx}
          className="p-4 border border-border rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
        >
          <div className="flex items-start gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
            <p className="text-sm font-medium text-foreground">{item.q}</p>
          </div>
          <p className="text-sm text-muted-foreground ml-4">{item.a}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit reusable components**

```bash
git add components/help/AwsSetupCallout.tsx components/help/AwsSetupStep.tsx components/help/AwsSetupTroubleshooting.tsx
git commit -m "feat: add reusable callout, step, and troubleshooting components"
```

---

### Task 5: Build AwsSetupContent Component (Main Content)

**Files:**
- Create: `components/help/AwsSetupContent.tsx`

- [ ] **Step 1: Create main content component**

```typescript
// components/help/AwsSetupContent.tsx
'use client'

import { Zap } from 'lucide-react'
import AwsSetupStep from './AwsSetupStep'
import AwsSetupCallout from './AwsSetupCallout'
import AwsSetupTroubleshooting from './AwsSetupTroubleshooting'

export default function AwsSetupContent() {
  const troubleshootItems = [
    {
      q: 'Invalid credentials error',
      a: 'Double check your Access Key ID and Secret Access Key. Make sure you copied them correctly without extra spaces. Verify the IAM user has AmazonS3FullAccess policy attached.'
    },
    {
      q: 'Bucket not showing up',
      a: 'Make sure the bucket exists in your AWS account and the IAM user has access to it. Check that you selected the correct region.'
    },
    {
      q: 'Access Denied when uploading',
      a: 'The IAM user may have insufficient permissions. Go to IAM → your user → Permissions and verify AmazonS3FullAccess is attached.'
    },
    {
      q: 'Cannot retrieve Secret Access Key',
      a: 'AWS only shows the Secret Access Key once. If you lost it, go to IAM → your user → Security credentials → delete the old access key → create a new one.'
    }
  ]

  return (
    <main className="p-6 lg:p-12 max-w-2xl">
      {/* Header */}
      <div className="mb-12 pb-8 border-b border-border">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/25 rounded-full mb-4 text-xs font-semibold text-accent">
          <Zap className="w-3 h-3" />
          Setup Guide
        </div>
        <h1 className="text-3xl font-bold mb-3 text-foreground">Connect Your AWS S3 Storage</h1>
        <p className="text-muted-foreground text-base">
          Follow these steps to create an IAM user, generate access keys, set up an S3 bucket, 
          and connect it to your S3 Portal instance.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <AwsSetupStep number={1} title="Create an IAM User" isLast={false}>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Go to <a href="https://console.aws.amazon.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">AWS Console</a> → search <strong>IAM</strong> → open it</li>
            <li>Click <strong>Users</strong> in the left sidebar → <strong>Create user</strong></li>
            <li>Set a username e.g. <code className="bg-muted px-1 py-0.5 rounded text-xs">s3-portal-user</code></li>
            <li>Click <strong>Next</strong></li>
            <li>Select <strong>Attach policies directly</strong></li>
            <li>Search <code className="bg-muted px-1 py-0.5 rounded text-xs">AmazonS3FullAccess</code> → check it</li>
            <li>Click <strong>Next</strong> → <strong>Create user</strong></li>
          </ol>
          <AwsSetupCallout type="tip">
            <strong>Production tip:</strong> For better security, create a custom IAM policy that restricts access to only your specific bucket instead of using AmazonS3FullAccess.
          </AwsSetupCallout>
        </AwsSetupStep>

        <AwsSetupStep number={2} title="Generate Access Keys" isLast={false}>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click the user you just created</li>
            <li>Go to the <strong>Security credentials</strong> tab</li>
            <li>Scroll to <strong>Access keys</strong> → click <strong>Create access key</strong></li>
            <li>Select <strong>Application running outside AWS</strong> → click <strong>Next</strong></li>
            <li>Click <strong>Create access key</strong></li>
            <li><strong>Copy and save both keys now</strong> — the Secret Access Key is only shown once</li>
          </ol>
          <div className="my-4 border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-2 text-left font-semibold text-xs uppercase text-muted-foreground">Key</th>
                  <th className="px-4 py-2 text-left font-semibold text-xs uppercase text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-accent">Access Key ID</td>
                  <td className="px-4 py-3 text-muted-foreground">Starts with <code className="bg-muted px-1 py-0.5 rounded text-xs">AKIA...</code></td>
                </tr>
                <tr className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-accent">Secret Access Key</td>
                  <td className="px-4 py-3 text-muted-foreground">Long random string — save this immediately</td>
                </tr>
              </tbody>
            </table>
          </div>
          <AwsSetupCallout type="warning">
            <strong>Important:</strong> You cannot retrieve the Secret Access Key after closing this screen. If you lose it, you'll need to delete and create a new access key.
          </AwsSetupCallout>
        </AwsSetupStep>

        <AwsSetupStep number={3} title="Create an S3 Bucket" isLast={false}>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Go to <a href="https://s3.console.aws.amazon.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">S3 Console</a> → <strong>Create bucket</strong></li>
            <li>Enter a unique <strong>bucket name</strong> e.g. <code className="bg-muted px-1 py-0.5 rounded text-xs">mycompany-s3-portal</code></li>
            <li>Select your <strong>AWS Region</strong> closest to your users</li>
            <li>Leave <strong>Block all public access</strong> turned ON</li>
            <li>Leave all other settings as default</li>
            <li>Click <strong>Create bucket</strong></li>
          </ol>
          <AwsSetupCallout type="tip">
            <strong>Note:</strong> Bucket names must be globally unique across all AWS accounts. If your name is taken, try adding a prefix like your company name.
          </AwsSetupCallout>
        </AwsSetupStep>

        <AwsSetupStep number={4} title="Connect to S3 Portal" isLast={true}>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Open S3 Portal → click <strong>Get Started</strong> on the welcome screen</li>
            <li>On the <strong>Connect Your AWS Storage</strong> step, fill in your credentials</li>
            <li>Click <strong>Next</strong> → select your bucket → click <strong>Finish</strong></li>
          </ol>
          <div className="my-4 border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-2 text-left font-semibold text-xs uppercase text-muted-foreground">Field</th>
                  <th className="px-4 py-2 text-left font-semibold text-xs uppercase text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-accent">Credential Name</td>
                  <td className="px-4 py-3 text-muted-foreground">Any label e.g. <code className="bg-muted px-1 py-0.5 rounded text-xs">My AWS Account</code></td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-accent">Access Key ID</td>
                  <td className="px-4 py-3 text-muted-foreground">From Step 2</td>
                </tr>
                <tr className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-accent">Secret Access Key</td>
                  <td className="px-4 py-3 text-muted-foreground">From Step 2</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            You can also add more credentials anytime via <strong>Settings → Credentials → Add Credential</strong>.
          </p>
        </AwsSetupStep>
      </div>

      {/* Divider */}
      <hr className="my-12 border-border" />

      {/* Troubleshooting */}
      <section id="troubleshoot">
        <h2 className="text-2xl font-semibold mb-6 text-foreground">Troubleshooting</h2>
        <AwsSetupTroubleshooting items={troubleshootItems} />
      </section>

      {/* Footer CTA */}
      <div className="mt-12 pt-8 border-t border-border">
        <a 
          href="/help"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
        >
          ← Back to Help
        </a>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify content renders**

Run: `npm run dev` → navigate to `http://localhost:3000/help/aws-setup`
Expected: Full page with header, 4 steps, troubleshooting, all styled correctly

- [ ] **Step 3: Commit**

```bash
git add components/help/AwsSetupContent.tsx
git commit -m "feat: add main content with steps and troubleshooting"
```

---

### Task 6: Update Reference Links

**Files:**
- Modify: `lib/error-translator.ts` (8 references)
- Modify: `components/onboarding/FirstTimeWizard.tsx` (1 reference)

- [ ] **Step 1: Update error-translator.ts**

Run: `grep -n "/docs/aws-setup" lib/error-translator.ts`
Expected: 8 matches

Edit each occurrence in `lib/error-translator.ts` from `/docs/aws-setup` to `/help/aws-setup`

```typescript
// Example: change
// redirect('/docs/aws-setup')
// to
// redirect('/help/aws-setup')
```

- [ ] **Step 2: Update FirstTimeWizard.tsx**

Run: `grep -n "/docs/aws-setup" components/onboarding/FirstTimeWizard.tsx`
Expected: 1 match

Change from `/docs/aws-setup` to `/help/aws-setup`

- [ ] **Step 3: Verify no broken references remain**

Run: `grep -r "/docs/aws-setup" app/ components/`
Expected: No results

- [ ] **Step 4: Commit reference updates**

```bash
git add lib/error-translator.ts components/onboarding/FirstTimeWizard.tsx
git commit -m "refactor: update docs-aws-setup references to help-aws-setup"
```

---

### Task 7: Test Responsive Behavior & Build

**Files:**
- No files modified

- [ ] **Step 1: Test desktop layout**

Run: `npm run dev` → open DevTools (F12) → set viewport to 1400x900
- Verify sidebar appears on left with logo, nav items, "On this page" links
- Verify main content loads with all 4 steps visible
- Verify sidebar is sticky while scrolling

- [ ] **Step 2: Test mobile layout**

Run: `npm run dev` → shrink viewport to 375x667
- Verify hamburger menu (☰) appears in header
- Click ☰ → drawer slides in with same nav items
- Click on nav item → drawer closes automatically
- Click backdrop (black area) → drawer closes

- [ ] **Step 3: Test anchor links**

- Desktop: click "Create IAM user" in "On this page" → scrolls to #step1
- Mobile: click "Create IAM user" in drawer → drawer closes, page scrolls to #step1

- [ ] **Step 4: Test production build**

Run: 
```bash
npm run build
npm run start
```
Expected: Build succeeds, page accessible at `http://localhost:3000/help/aws-setup`

- [ ] **Step 5: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 6: Commit test verification**

```bash
git add -A
git commit -m "test: verify responsive layout and build"
```

---

### Task 8: Create Help Index Page (Optional Enhancement)

**Files:**
- Create: `app/help/page.tsx`

- [ ] **Step 1: Create help index**

```typescript
// app/help/page.tsx
'use client'

import Link from 'next/link'

export default function HelpPage() {
  const topics = [
    {
      title: 'AWS S3 Setup',
      description: 'Step-by-step guide to create IAM user, generate keys, set up S3 bucket, and connect to S3 Portal',
      href: '/help/aws-setup'
    },
    {
      title: 'Self-hosting',
      description: 'Deploy S3 Portal on your own server with Docker Compose',
      href: '/help/self-hosting'
    }
  ]

  return (
    <main className="p-8 lg:p-12 max-w-2xl mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-3 text-foreground">Help & Documentation</h1>
        <p className="text-muted-foreground">Guides to set up and self-host S3 Portal</p>
      </div>

      <div className="grid gap-4">
        {topics.map((topic) => (
          <Link 
            key={topic.href}
            href={topic.href}
            className="p-6 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <h2 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
              {topic.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">{topic.description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit help index**

```bash
git add app/help/page.tsx
git commit -m "feat: add help documentation index page"
```

---

## Summary

**Total Tasks:** 8
**Files Created:** 8 new files
**Files Modified:** 2 existing files
**Estimated Time:** ~45 minutes
**Commits:** 8 atomic commits (one per task)

**Key Deliverables:**
- ✅ Fully responsive AWS setup page with desktop sidebar + mobile drawer
- ✅ 4 numbered walkthrough steps with tables, lists, callouts
- ✅ Troubleshooting Q&A section with 4 common issues
- ✅ All error handlers + onboarding wizard updated to point to `/help/aws-setup`
- ✅ Production build verified
