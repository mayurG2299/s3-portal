# Quick Test Reference - UI Audit Fixes

## 🚨 Critical Tests (Must Run First)

### 1️⃣ Teams Page - Role Dropdown (2 mins)
```
1. Go to: http://localhost:3000/dashboard/teams
2. Right-click role dropdown (shows OWNER/ADMIN/VIEWER)
3. Inspect → Check for aria-label="Change role for [email]"
✅ PASS: aria-label exists and is descriptive
❌ FAIL: No aria-label or empty
```

### 2️⃣ Teams Page - Team Name Input (1 min)
```
1. Scroll to "Manage Team" section (right sidebar)
2. Look for "Team Name" label above input
3. Click on "Team Name" text
✅ PASS: Clicking label focuses the input field
❌ FAIL: Nothing happens when clicking label
```

### 3️⃣ Admin Page - H1 Heading (30 sec)
```
1. Go to: http://localhost:3000/dashboard/admin/permissions
2. Right-click "Access Permissions" title
3. Inspect → Should be <h1> not <h2>
✅ PASS: Element is <h1>
❌ FAIL: Element is <h2> or other
```

---

## 🎯 Quick Visual Checks (5 mins)

### Dashboard
- **What:** Stats card text readability
- **Where:** "Storage buckets connected", "Files stored" text
- **Check:** Text should be clearly readable, not too faded
- **Pass:** Can read comfortably without straining

### Teams  
- **What:** "YOU" badge next to your email
- **Where:** Active Members section
- **Check:** Purple badge with "YOU" text is crisp and readable
- **Pass:** Text is clear, not blurry

### Admin
- **What:** Role description text
- **Where:** Under OWNER/ADMIN/VIEWER roles
- **Check:** Italic text like "Full access to all features and settings"
- **Pass:** Text is clearly readable

---

## 🔧 Files Changed (For Your Reference)

### Modified Files:
1. `app/dashboard/page.tsx` - Stats text contrast fix
2. `app/dashboard/teams/page.tsx` - Label component + heading fix
3. `app/dashboard/admin/permissions/page.tsx` - H1 heading (via component)
4. `components/admin/permission-management.tsx` - H1 heading
5. `components/admin/user-role-management.tsx` - Role dropdown aria-label + contrast
6. `components/admin/invite-user-form.tsx` - Role dropdown aria-label
7. `components/admin/role-management.tsx` - Description text contrast

### What Changed:
- ✅ Added `aria-label` to 2 dropdowns
- ✅ Added `<label>` to team name input
- ✅ Fixed Label component (span → label)
- ✅ Changed h2 → h1 (Admin page)
- ✅ Changed h3 → h2 (Teams page)
- ✅ Removed `/70` and `/80` opacity from text (better contrast)
- ✅ Increased badge opacity (primary/20 → primary/25)

---

## 🚀 Quick Test Run (10 mins)

### Step 1: Start Dev Server
```bash
cd /Users/mayur/Personal/projects/s3-portal
npm run dev
```

### Step 2: Test Critical Fixes
1. Open http://localhost:3000/dashboard/teams
2. Inspect role dropdown → Check aria-label ✅
3. Check team name has label ✅
4. Open http://localhost:3000/dashboard/admin/permissions
5. Inspect heading → Verify it's h1 ✅

### Step 3: Visual Verification
1. Dashboard → Read stats text (should be clear) ✅
2. Teams → Check "YOU" badge (should be readable) ✅
3. Admin → Check role descriptions (should be clear) ✅

### Step 4: Axe DevTools Scan
```
1. Install: chrome.google.com/webstore → Search "axe DevTools"
2. Open DevTools (F12) → axe DevTools tab
3. Click "Scan ALL of my page"
4. Check results:
   - 0 Critical issues (button-name, label)
   - 0 Serious issues (for fixes we made)
```

---

## ✅ Success Criteria

**All Critical Tests Pass:**
- [ ] Role dropdown has aria-label
- [ ] Team name input has label
- [ ] Admin page has h1 heading

**Visual Checks Pass:**
- [ ] Dashboard text readable
- [ ] "YOU" badge readable
- [ ] Role descriptions readable

**Axe Scan:**
- [ ] 0 Critical issues related to our fixes
- [ ] Improvements in Serious issues count

---

## 🐛 Found an Issue?

**Quick Report:**
```
Page: [Dashboard/Teams/Admin]
Test: [Test name]
Issue: [What's wrong]
Screenshot: [Optional]
```

**Post in:** Project chat or create GitHub issue

---

## 🎓 Keyboard Test (Bonus - 3 mins)

```
1. Go to Teams page
2. Close your mouse/trackpad
3. Press Tab repeatedly
4. Check:
   - Can reach role dropdown? ✅
   - Can reach team name input? ✅
   - Can reach invite form? ✅
   - Focus indicator visible? ✅
```

---

## 📱 Mobile Test (Bonus - 2 mins)

```
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12 Pro"
4. Navigate to each page
5. Check:
   - Text readable on small screen? ✅
   - Dropdowns work? ✅
   - No horizontal scroll? ✅
```

---

## Summary

- **Total files changed:** 7
- **Critical fixes:** 3 (aria-labels, label, h1)
- **UX improvements:** 4 (contrast fixes)
- **Testing time:** ~20 minutes (full suite) or ~10 minutes (quick run)

**Need detailed test cases?** See `manual-test-cases-ui-audit-fixes.md`

**Ready to ship when:**
- All critical tests pass ✅
- No accessibility regressions ✅
- Visual polish verified ✅
