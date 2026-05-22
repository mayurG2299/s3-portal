# Session Recovery Checklist

**Use this when context is lost or starting a new session**

## 1️⃣ Quick Orient (2 minutes)

```bash
# Read the quick start
Read: docs/QUICK-START-IMPLEMENTATION.md

# Check git status - what's uncommitted?
Bash: git status

# Check recent commits - what's been done?
Bash: git log --oneline -10

# Check current branch
Bash: git branch --show-current
```

**Questions to answer:**
- [ ] What phase are we in? (1, 2, 3, or 4)
- [ ] What task is current? (e.g., Task 1.1)
- [ ] What's the task status? (⬜ ⬜ ✅ ❌)
- [ ] Are there uncommitted changes?

---

## 2️⃣ Check Implementation Guide (3 minutes)

```bash
# Read the main guide
Read: docs/UX-CONSOLIDATION-IMPLEMENTATION-GUIDE.md

# Navigate to current task section
# Look for the status emoji for your task
```

**Questions to answer:**
- [ ] What step number am I on?
- [ ] What files need to be modified?
- [ ] What's the testing checklist?
- [ ] Were there any issues logged?

---

## 3️⃣ Verify Nothing Broke (2 minutes)

```bash
# Check if app is running
Bash: ps aux | grep "next dev" || echo "App not running"

# If not running, start it
# Bash: npm run dev

# Check for build errors
Bash: npm run build 2>&1 | head -20
```

**Questions to answer:**
- [ ] Does the app build?
- [ ] Are there TypeScript errors?
- [ ] Are there any console errors?

---

## 4️⃣ Resume Work

### If Task Not Started (⬜)
1. Read the full task section in implementation guide
2. Follow "Step 1: Read and analyze current implementation"
3. Proceed step-by-step

### If Task In Progress (🔄)
1. Check git diff to see what changed
   ```bash
   Bash: git diff
   ```
2. Check if there are uncommitted changes
3. Review "Issues Encountered" section for this task
4. Determine which step you're on
5. Continue from that step

### If Previous Task Failed (❌)
1. Read the issue log entry
2. Understand what broke and why
3. Fix the issue before proceeding
4. Re-test thoroughly
5. Update status to 🔄 or ✅

---

## 5️⃣ Before Making Changes

**Checklist before modifying ANY file:**

```bash
# 1. Read the file first
Read: [file-path]

# 2. Understand the code
# - What does it do?
# - What depends on it?
# - Where is it imported?

# 3. Search for usage
Bash: grep -r "component-name" app components --include="*.tsx" --include="*.ts"

# 4. Check for existing tests
Bash: find . -name "*.test.tsx" -o -name "*.test.ts" | xargs grep -l "component-name" || echo "No tests found"
```

- [ ] File read ✅
- [ ] Dependencies identified ✅
- [ ] Usage locations found ✅
- [ ] Tests checked ✅

---

## 6️⃣ After Making Changes

**Checklist after modifying ANY file:**

```bash
# 1. Check TypeScript errors
Bash: npx tsc --noEmit 2>&1 | grep "error TS"

# 2. Test the change manually
# Follow testing checklist in task section

# 3. Verify no console errors
# Open browser console and check

# 4. Test on mobile
# Resize browser to 375px width

# 5. Test edge cases
# Empty states, loading, errors, etc.
```

- [ ] TypeScript clean ✅
- [ ] Manual testing done ✅
- [ ] No console errors ✅
- [ ] Mobile tested ✅
- [ ] Edge cases tested ✅

---

## 7️⃣ Completing a Task

**When a task is fully done:**

```bash
# 1. Run full testing checklist from task section
# 2. Update implementation guide:
#    - Change status emoji to ✅
#    - Fill in "Completion Date"
#    - Fill in "Tested By"
#    - List any issues found

# 3. Update changelog
#    Add entry with format:
#    YYYY-MM-DD HH:MM - [Task ID] - [Component] - [Action]

# 4. Update metrics table
#    Update "Current" column values

# 5. Commit changes
Bash: git add .
Bash: git commit -m "feat: [Task 1.1] Consolidate Files page actions

- Created FilesActionBar component
- Created MobileFilesFAB component  
- Removed 3 duplicate action button locations
- Reduced interactions from 128 to 85 (-33%)

Tested: Desktop ✅ Mobile ✅ All roles ✅ Edge cases ✅"

# 6. Push to remote (if ready)
# Bash: git push origin [branch-name]
```

---

## 8️⃣ Moving to Next Task

```bash
# 1. Update status of current task to ✅ in guide
# 2. Update status of next task to 🔄 in guide
# 3. Read next task section completely
# 4. Start with Step 1 of next task
```

---

## 🆘 Emergency Recovery

### If Everything Seems Broken

```bash
# 1. Check git status
Bash: git status

# 2. See what changed
Bash: git diff HEAD

# 3. See recent commits
Bash: git log --oneline -5

# 4. If needed, rollback last commit
# Bash: git reset --soft HEAD~1

# 5. Or discard all changes (CAUTION!)
# Bash: git checkout .

# 6. Restart dev server
# Bash: pkill -f "next dev"
# Bash: npm run dev
```

### If You Forgot What You Were Doing

```bash
# 1. Read the quick start
Read: docs/QUICK-START-IMPLEMENTATION.md

# 2. Check uncommitted changes
Bash: git status

# 3. Check last commit message
Bash: git log -1 --pretty=format:"%s%n%n%b"

# 4. Read issues log in main guide
Read: docs/UX-CONSOLIDATION-IMPLEMENTATION-GUIDE.md
# Search for "ISSUES ENCOUNTERED" section
```

### If You Need to Context Switch

**Before switching away:**
```bash
# 1. Commit or stash current work
Bash: git add .
Bash: git commit -m "WIP: [Task X.X] [what you were doing]"
# OR
Bash: git stash save "WIP: [Task X.X] [what you were doing]"

# 2. Update guide with current status and notes
# Add to "Issues Encountered" section:
# "WIP: Stopped at step X because [reason]"
```

**When returning:**
```bash
# 1. Run this checklist from step 1
# 2. Check git log for your WIP commit
# 3. Read the issue/note you left yourself
# 4. Continue from where you left off
```

---

## 📋 Quick Command Reference

```bash
# Current status
git status
git log --oneline -10

# Read docs
Read: docs/QUICK-START-IMPLEMENTATION.md
Read: docs/UX-CONSOLIDATION-IMPLEMENTATION-GUIDE.md

# Find files
find . -name "*component-name*"
grep -r "search-term" app components

# Test
npm run build
npm run dev
npx tsc --noEmit

# Commit
git add .
git commit -m "feat: [Task ID] Brief description"
git push origin branch-name
```

---

**Last Updated:** 2026-05-22  
**Version:** 1.0
