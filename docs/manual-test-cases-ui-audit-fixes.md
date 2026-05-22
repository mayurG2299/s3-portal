# UI/UX Audit Fixes - Manual Test Cases

Test Date: ___________  
Tester: ___________  
Environment: http://localhost:3000

---

## Test Suite 1: Dashboard Page

### Test 1.1 - Color Contrast (Happy Path)
**What to test:** Dashboard stats card text readability

**Steps:**
1. Navigate to `http://localhost:3000/dashboard`
2. Locate the stats cards (Storage buckets, Files stored, etc.)
3. Look at the small gray text under each stat number (e.g., "Storage buckets connected")

**Expected Result:**
- Text should be clearly readable without straining
- Gray text should have sufficient contrast against the dark background
- No `/70` opacity blur on description text

**Visual Check:**
- Text appears crisp and clear ✅ / ❌
- Can read comfortably from 2 feet away ✅ / ❌

---

### Test 1.2 - Color Contrast (Edge Case - Different Lighting)
**What to test:** Readability in different lighting conditions

**Steps:**
1. View dashboard in bright room lighting
2. View dashboard with screen brightness at 50%
3. View dashboard with screen brightness at 100%

**Expected Result:**
- Text remains readable in all lighting conditions
- No information is lost due to low contrast

**Pass Criteria:**
- Readable at 50% brightness ✅ / ❌
- Readable at 100% brightness ✅ / ❌
- Readable in bright lighting ✅ / ❌

---

### Test 1.3 - Mobile Responsiveness
**What to test:** Dashboard on mobile viewport

**Steps:**
1. Open Chrome DevTools (F12)
2. Click "Toggle device toolbar" (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" (390x844)
4. Refresh the page

**Expected Result:**
- Stats cards stack vertically
- All text remains readable
- No horizontal scrolling
- Touch targets are at least 44x44px

**Visual Check:**
- Cards stack properly ✅ / ❌
- Text readable on mobile ✅ / ❌
- No overflow ✅ / ❌

---

## Test Suite 2: Teams Page

### Test 2.1 - Role Dropdown Accessibility (CRITICAL FIX)
**What to test:** Screen reader can identify role dropdown

**Steps:**
1. Navigate to `http://localhost:3000/dashboard/teams`
2. Right-click on the role dropdown (shows "OWNER", "ADMIN", or "VIEWER")
3. Select "Inspect" from context menu
4. Look for `aria-label` attribute in the `<button>` element

**Expected Result:**
```html
<button ... aria-label="Change role for [email]">
  <span>VIEWER</span>
</button>
```

**Verification:**
- `aria-label` attribute exists ✅ / ❌
- Contains descriptive text ✅ / ❌
- Email address is included ✅ / ❌

**Screen Reader Test (if available):**
1. Enable screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
2. Tab to the role dropdown
3. Screen reader should announce: "Change role for [email], VIEWER, button"

**Pass Criteria:**
- Screen reader announces purpose ✅ / ❌

---

### Test 2.2 - Team Name Input Label (CRITICAL FIX)
**What to test:** Team name input has accessible label

**Steps:**
1. Scroll to "Manage Team" section in right sidebar
2. Look for the team name input field (shows current team name, e.g., "Fitpage")
3. Right-click on input and select "Inspect"
4. Check for:
   - `<label>` element with `for` attribute
   - Matching `id` on the `<input>`

**Expected Result:**
```html
<label for="team-name-[teamId]" ...>Team Name</label>
<input id="team-name-[teamId]" name="name" value="Fitpage" />
```

**Visual Check:**
- "Team Name" label visible above input ✅ / ❌
- Label in small uppercase gray text ✅ / ❌

**Accessibility Check:**
- Click on "Team Name" label → should focus the input ✅ / ❌

---

### Test 2.3 - Invite Form Role Dropdown (CRITICAL FIX)
**What to test:** Role selector in invite form has accessible label

**Steps:**
1. Scroll to "Invite Team Members" section
2. Enter an email: `test@example.com`
3. Click "Check" button
4. Look at the "Role" dropdown
5. Right-click dropdown and inspect

**Expected Result:**
- Dropdown has `aria-label="Select role for new team member"`
- "Role" label is visible above dropdown
- Placeholder text "Assign role" appears when no selection

**Pass Criteria:**
- Visual label present ✅ / ❌
- `aria-label` present ✅ / ❌
- Descriptive text clear ✅ / ❌

---

### Test 2.4 - "YOU" Badge Contrast
**What to test:** Badge readability next to your email

**Steps:**
1. Find your own email in "Active Members" list
2. Look for purple "YOU" badge next to your email
3. Verify text is clearly readable

**Expected Result:**
- Badge background: `bg-primary/25` (lighter than before)
- Border: `border-primary/40` (stronger than before)
- Text should be clearly readable

**Visual Check:**
- "YOU" text is crisp and readable ✅ / ❌
- Badge stands out from background ✅ / ❌

---

### Test 2.5 - Role Description Text Contrast
**What to test:** Italic role descriptions are readable

**Steps:**
1. Look at "Active Members" section
2. Find the italic text under each role (e.g., "Full access to all features and settings")
3. Check if text is clearly readable

**Expected Result:**
- Text uses `text-muted-foreground` (no `/80` opacity)
- Clearly readable without straining

**Visual Check:**
- Description text readable ✅ / ❌
- No blur or fade effect ✅ / ❌

---

### Test 2.6 - Heading Hierarchy (CRITICAL FIX)
**What to test:** Semantic HTML structure

**Steps:**
1. Right-click "Active Members" heading
2. Select "Inspect"
3. Verify it's an `<h2>` element (not `<h3>`)

**Expected Result:**
```html
<h2 class="font-bold text-foreground tracking-tight">Active Members</h2>
```

**Verification:**
- Element is `<h2>` ✅ / ❌
- Not `<h3>` ✅ / ❌

---

### Test 2.7 - Edge Case: Update Team Name
**What to test:** Label association works during interaction

**Steps:**
1. Go to "Manage Team" section
2. Click on the "Team Name" label text
3. Input should receive focus
4. Type a new name: "Test Team 123"
5. Click "Update Team Name"
6. Verify update succeeds

**Expected Result:**
- Clicking label focuses input ✅ / ❌
- Can type new name ✅ / ❌
- Update succeeds ✅ / ❌
- Page refreshes with new name ✅ / ❌

---

### Test 2.8 - Edge Case: Role Change Flow
**What to test:** Complete role change with accessible controls

**Steps:**
1. Have at least 2 members in team (invite someone if needed)
2. Click role dropdown for another member
3. Screen reader should announce the control
4. Select a different role (e.g., ADMIN → VIEWER)
5. Confirm the change

**Expected Result:**
- Dropdown opens smoothly ✅ / ❌
- Role options are clearly listed ✅ / ❌
- Selection updates immediately ✅ / ❌
- Page refreshes to apply change ✅ / ❌

---

### Test 2.9 - Edge Case: Invite Flow with Role Selection
**What to test:** Complete invite flow with accessible role selector

**Steps:**
1. Enter email: `newuser@example.com`
2. Click "Check" → should show "New User" banner
3. Click on "Role" dropdown
4. Should see role options with icons and descriptions
5. Select "VIEWER"
6. Click "Send Invite"

**Expected Result:**
- Email lookup works ✅ / ❌
- Role dropdown opens ✅ / ❌
- Each role shows icon + name + description ✅ / ❌
- Can select a role ✅ / ❌
- Invite sends successfully ✅ / ❌
- Form resets after sending ✅ / ❌

---

### Test 2.10 - Mobile Viewport
**What to test:** Teams page on mobile devices

**Steps:**
1. Open DevTools → Toggle device toolbar
2. Select "iPhone 12 Pro" (390x844)
3. Navigate to Teams page
4. Test all interactions

**Expected Result:**
- Layout adapts to mobile ✅ / ❌
- Dropdowns work on mobile ✅ / ❌
- Labels remain visible ✅ / ❌
- Touch targets adequate (44x44px minimum) ✅ / ❌

---

## Test Suite 3: Admin Permissions Page

### Test 3.1 - H1 Heading (CRITICAL FIX)
**What to test:** Page has proper H1 heading

**Steps:**
1. Navigate to `http://localhost:3000/dashboard/admin/permissions`
2. Right-click "Access Permissions" heading
3. Select "Inspect"
4. Verify it's an `<h1>` element

**Expected Result:**
```html
<h1 class="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
  Access <span class="gradient-text">Permissions</span>
</h1>
```

**Verification:**
- Element is `<h1>` (not `<h2>`) ✅ / ❌
- Text says "Access Permissions" ✅ / ❌

**Screen Reader Test:**
- Navigate to page
- Screen reader should announce H1 first ✅ / ❌

---

### Test 3.2 - Role Description Contrast
**What to test:** Italic descriptions under each role

**Steps:**
1. Look at OWNER role card
2. Find italic text: "Full access to all features and settings"
3. Check readability

**Expected Result:**
- Text uses `text-muted-foreground` (no opacity modifier)
- Clearly readable
- Same for ADMIN and VIEWER descriptions

**Visual Check:**
- OWNER description readable ✅ / ❌
- ADMIN description readable ✅ / ❌
- VIEWER description readable ✅ / ❌

---

### Test 3.3 - Edge Case: Create New Role
**What to test:** Full role creation flow

**Steps:**
1. Click "+ Engineer Role" button (top right)
2. Dialog should open
3. Check all text is readable
4. Fill in role details:
   - Name: "TEST_ROLE"
   - Description: "Test role for verification"
   - Level: 30
5. Select some permissions
6. Click "Create"

**Expected Result:**
- Dialog opens smoothly ✅ / ❌
- All form fields have labels ✅ / ❌
- Role description input is readable ✅ / ❌
- Can create role successfully ✅ / ❌

---

### Test 3.4 - Edge Case: View Role Details
**What to test:** Role detail modal readability

**Steps:**
1. Click eye icon on VIEWER role
2. Modal should open with role details
3. Check all text is readable
4. Close modal

**Expected Result:**
- Modal opens ✅ / ❌
- Role name clearly visible ✅ / ❌
- Description clearly readable ✅ / ❌
- Permission list readable ✅ / ❌
- No contrast issues ✅ / ❌

---

### Test 3.5 - Mobile Viewport
**What to test:** Admin page on mobile

**Steps:**
1. Open DevTools → Device toolbar
2. Select "iPhone 12 Pro"
3. Navigate to Admin Permissions
4. Check layout and readability

**Expected Result:**
- H1 heading visible on mobile ✅ / ❌
- Role cards stack vertically ✅ / ❌
- "+ Engineer Role" button accessible ✅ / ❌
- All text readable ✅ / ❌

---

## Test Suite 4: Files Page (Baseline - No Changes)

### Test 4.1 - Files Page Baseline
**What to test:** Verify no regressions

**Steps:**
1. Navigate to `http://localhost:3000/dashboard/files`
2. Check empty state (if no files)
3. Upload a file if possible
4. Check file list rendering

**Expected Result:**
- Page loads without errors ✅ / ❌
- Empty state is clear ✅ / ❌
- Upload button works ✅ / ❌
- No accessibility regressions ✅ / ❌

---

## Test Suite 5: Accessibility Tools Testing

### Test 5.1 - Axe DevTools Extension
**What to test:** Automated accessibility scan

**Steps:**
1. Install "axe DevTools" Chrome extension
2. Navigate to each page:
   - Dashboard
   - Teams
   - Admin Permissions
3. Open DevTools → "axe DevTools" tab
4. Click "Scan ALL of my page"
5. Review results

**Expected Results:**

**Dashboard:**
- 0 Critical issues ✅ / ❌
- 0 Serious issues (for stats text) ✅ / ❌

**Teams:**
- 0 Critical issues (button-name, label) ✅ / ❌
- 0 Serious issues (heading-order) ✅ / ❌
- May have minor color-contrast warnings (acceptable) ✅ / ❌

**Admin Permissions:**
- 0 Critical issues ✅ / ❌
- Has H1 heading ✅ / ❌
- 0 Serious color-contrast issues (for role descriptions) ✅ / ❌

---

### Test 5.2 - Keyboard Navigation
**What to test:** Can navigate entire app with keyboard only

**Steps:**
1. Navigate to Teams page
2. Close all mouse/trackpad input
3. Use only keyboard:
   - Tab: Move forward
   - Shift+Tab: Move backward
   - Enter/Space: Activate buttons/links
   - Arrows: Navigate dropdowns

**Expected Result:**

**Teams Page:**
- Can tab to role dropdown ✅ / ❌
- Can open dropdown with Enter/Space ✅ / ❌
- Can select role with arrows + Enter ✅ / ❌
- Can tab to team name input ✅ / ❌
- Can tab to "Update Team Name" button ✅ / ❌
- Can tab to invite form fields ✅ / ❌
- Can tab to role dropdown in invite form ✅ / ❌

**Pass Criteria:**
- No keyboard traps ✅ / ❌
- Focus indicator visible ✅ / ❌
- All interactive elements reachable ✅ / ❌

---

### Test 5.3 - Screen Reader Testing (Optional but Recommended)

**Windows (NVDA - Free):**
1. Download NVDA: https://www.nvaccess.org/download/
2. Install and launch
3. Navigate to Teams page
4. Press Tab to move through elements
5. Listen to announcements

**Expected Announcements:**
- "Change role for [email], VIEWER, button" when focusing role dropdown
- "Team Name, edit, Fitpage" when focusing team name input
- "Select role for new team member, Role, VIEWER, button" for invite role dropdown

**Mac (VoiceOver - Built-in):**
1. Press Cmd+F5 to enable VoiceOver
2. Use Ctrl+Option+Arrow keys to navigate
3. Test same elements as above

**Pass Criteria:**
- All controls announced with purpose ✅ / ❌
- No "unlabeled button" announcements ✅ / ❌
- Form fields announce their labels ✅ / ❌

---

## Test Suite 6: Edge Cases & Stress Testing

### Test 6.1 - Long Team Name
**What to test:** Layout with extreme inputs

**Steps:**
1. Go to Manage Team section
2. Enter a very long team name: `This is an extremely long team name that should test the boundaries of our input validation and layout`
3. Try to update
4. Check how UI handles it

**Expected Result:**
- Input truncates or scrolls horizontally ✅ / ❌
- No layout breaking ✅ / ❌
- Label remains associated ✅ / ❌

---

### Test 6.2 - Many Team Members
**What to test:** Role dropdown with many members

**Steps:**
1. Invite 5+ members to your team (if possible)
2. Check "Active Members" section
3. Verify all role dropdowns have aria-labels
4. Check performance and layout

**Expected Result:**
- All dropdowns functional ✅ / ❌
- No performance lag ✅ / ❌
- Layout doesn't break ✅ / ❌

---

### Test 6.3 - Browser Compatibility

**Chrome:**
- All tests pass ✅ / ❌

**Firefox:**
- All tests pass ✅ / ❌

**Safari (Mac only):**
- All tests pass ✅ / ❌

**Edge:**
- All tests pass ✅ / ❌

---

## Test Suite 7: Regression Testing

### Test 7.1 - Verify No Breaking Changes
**What to test:** Existing functionality still works

**Steps:**
1. Complete a full user flow:
   - Log in
   - View dashboard
   - Navigate to Teams
   - Update team name
   - Change a member's role
   - Send an invite
   - Navigate to Admin
   - View role details
2. Verify no errors in console

**Expected Result:**
- All flows complete successfully ✅ / ❌
- No console errors ✅ / ❌
- No broken layouts ✅ / ❌

---

## Summary Checklist

### Critical Fixes (Must Pass):
- [ ] Dashboard stats text has good contrast
- [ ] Teams role dropdown has `aria-label`
- [ ] Team name input has visible `<label>`
- [ ] Invite role dropdown has `aria-label`
- [ ] Admin page has `<h1>` heading
- [ ] All form fields are keyboard accessible

### Important Fixes (Should Pass):
- [ ] "YOU" badge is readable
- [ ] Role descriptions have good contrast
- [ ] Heading hierarchy is semantic
- [ ] No keyboard traps
- [ ] Mobile responsive

### Nice to Have (Good to Pass):
- [ ] Screen reader announces all controls correctly
- [ ] Passes axe DevTools with 0 critical issues
- [ ] Works in all major browsers

---

## Issue Reporting Template

If you find any issues, use this template:

```
**Issue:** [Brief description]
**Page:** [Dashboard/Teams/Admin/Files]
**Test Case:** [Test number, e.g., 2.1]
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected:** [What should happen]
**Actual:** [What actually happened]
**Screenshot:** [Attach if possible]
**Browser:** [Chrome/Firefox/Safari/Edge + version]
**Severity:** [Critical/High/Medium/Low]
```

---

## Notes for Tester

- Test with a clean browser profile to avoid extension interference
- Clear browser cache before starting tests
- Use actual assistive technologies if available (screen readers)
- Test at different screen sizes (desktop, tablet, mobile)
- Check both light and dark modes if your app supports theme switching
- Pay attention to contrast in different lighting conditions
- Verify fixes don't break existing functionality

**Good luck with testing!** 🧪
