# TEST CASE COMMAND

You are a Senior QA Architect.
Using the provided feature code and the test-case-template.md,
generate a Markdown test-case file containing:
- happy path
- edge cases
- error cases
- concurrency and failure cases
- boundary conditions
- integration points
- security and auth validations
- dummy data examples for each field
- execution flow
- expected outputs and DB/event assertions

Output one Markdown file per feature, grouped by category.
Each test block must follow the structure defined in this template.


# Test Case Template

This template should be used for planning and documenting test cases for new features or changes.

**Feature Name:** [Feature Name]
**Date Created:** [Date]
**Created By:** [Name]
**Status:** 🟥 Planning / 🟨 In Progress / 🟩 Complete

---

## Test Case Planning Checklist

Before implementation:
- [ ] All happy path scenarios identified
- [ ] All edge cases identified
- [ ] All error cases identified
- [ ] All boundary conditions identified
- [ ] All integration points identified
- [ ] Dummy data created for each test case
- [ ] Expected results documented for each test case
- [ ] Execution flow traced for each test case

---

## Test Cases

### Category: Validation Tests

#### Test Case 1: [Test Case Name]

**Priority:** Critical / Important / Nice-to-Have
**Category:** Validation / Business Logic / Edge Case / Error Handling

**Input:**
```json
{
  // Dummy input data
}
```

**Expected Output:**
```json
{
  // Expected response
}
```

**Expected Error (if applicable):**
```
Error message or exception type
```

**Execution Flow:**
1. Step 1: [Description]
   - Input: [value]
   - Processing: [logic]
   - Output: [value]
2. Step 2: [Description]
   - Input: [value]
   - Processing: [logic]
   - Output: [value]

**Expected Result:** ✅ PASS / ❌ FAIL

**Actual Result (After Implementation):**
- ✅ PASS / ❌ FAIL
- Notes: [Any observations]
- Duration: [ms]

---

### Category: Business Logic Tests

#### Test Case X: [Test Case Name]

[Same format as above]

---

### Category: Edge Cases

#### Test Case X: [Test Case Name]

[Same format as above]

---

### Category: Error Handling

#### Test Case X: [Test Case Name]

[Same format as above]

---

### Category: Integration Tests

#### Test Case X: [Test Case Name]

[Same format as above]

---

## Test Case Verification Report

**Verification Date:** [Date]
**Verified By:** [Name]

### Summary

- **Total Test Cases:** [Number]
- **Passed:** [Number] ✅
- **Failed:** [Number] ❌
- **Skipped:** [Number] ⚠️
- **Pass Rate:** [Percentage]%

### Detailed Results

| Test Case | Category | Status | Notes |
|-----------|----------|--------|-------|
| TC-1 | Validation | ✅ PASS | - |
| TC-2 | Business Logic | ❌ FAIL | [Reason] |
| TC-3 | Edge Case | ✅ PASS | - |

### Failed Test Cases

#### Test Case X: [Name]
- **Expected:** [Expected result]
- **Actual:** [Actual result]
- **Root Cause:** [Analysis]
- **Fix Required:** [Description]
- **Priority:** Critical / Important / Nice-to-Have

### Skipped Test Cases

#### Test Case X: [Name]
- **Reason:** [Why skipped]
- **Planned Fix:** [When/how to fix]

---

## Edge Cases Discovered During Testing

1. **Edge Case 1:**
   - Description: [What was discovered]
   - Impact: [How it affects the feature]
   - Fix: [How it was handled]

---

## Notes

- [Any additional observations]
- [Performance considerations]
- [Security considerations]
- [Future improvements]

---

## References

- Related PR: [Link]
- Related Issue: [Link]
- Related Documentation: [Link]