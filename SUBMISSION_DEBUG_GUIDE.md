# Submission Detection Debugging Guide

## 🐛 Issue: Submission Not Detected

You submitted "Permutations II" (permutations-ii) but it's not showing up in the war.

---

## 📋 Debugging Steps

### Step 1: Check War Problem Slug

Open browser console (F12) and look for:
```
[War Check] War problem slug: "..."
```

**Expected**: Should match "permutations-ii"

**If different**: You solved the wrong problem! The war is for a different problem.

---

### Step 2: Check Submission Timestamp

Your submission:
- **Timestamp**: 1766583254 (Unix seconds)
- **Date**: December 24, 2025 at 13:37:34 GMT (7:07 PM IST)

Look for in console:
```
[War Check] War start time: 2025-12-24T...
```

**Expected**: War start time should be BEFORE 2025-12-24T13:37:34Z

**If war started after**: Submission was before the war, so it doesn't count.

---

### Step 3: Check Slug Comparison

Look for:
```
[War Check] Comparing: "..." vs "permutationsii"
```

After normalization, "permutations-ii" becomes "permutationsii" (no hyphens).

**Expected**: Both slugs should match exactly.

---

### Step 4: Check for Match Result

Look for either:
```
[War Check] ✅ MATCH FOUND for yourusername!
```
or
```
[War Check] ❌ No match (different problem)
```

---

## 🔍 Common Issues

### Issue 1: Wrong Problem
**Symptom**:
```
[War Check] War problem slug: "two-sum"
[War Check] Comparing: "twosum" vs "permutationsii"
[War Check] ❌ No match (different problem)
```

**Solution**: Solve the correct problem! Check the war card for the problem link.

---

### Issue 2: Submission Before War Started
**Symptom**:
```
[War Check] War start time: 2025-12-24T14:00:00.000Z
[War Check] yourusername submission: { time: "2025-12-24T13:37:34.000Z" ... }
```
(Submission time is BEFORE war start time)

**Solution**: Submit again AFTER the war started.

---

### Issue 3: No Submissions Fetched
**Symptom**:
```
[War Check] Total submissions fetched: 0
```

**Solution**: 
- Wait a few minutes for LeetCode API to update
- Click "Check Submissions" again
- Verify your LeetCode username is correct

---

### Issue 4: API Rate Limiting
**Symptom**:
```
[War Check] Rate limited, waiting...
```

**Solution**: Wait 15 minutes, then click "Check Submissions" again.

---

## 🧪 Manual Test

### Test Your Submission Detection

1. **Start a war** with a specific problem
2. **Note the problem slug** from console
3. **Solve that exact problem** on LeetCode
4. **Wait 30 seconds** for API to update
5. **Click "Check Submissions"**
6. **Check console logs**:

```
[War Check] ========== Checking yourusername ==========
[War Check] War problem slug: "permutations-ii"
[War Check] War start time: 2025-12-24T13:30:00.000Z
[War Check] Total submissions fetched: 20

[War Check] yourusername submission: {
  time: "2025-12-24T13:37:34.000Z",
  title: "Permutations II",
  titleSlug: "permutations-ii",
  status: "Accepted",
  statusCode: 10
}

[War Check] Comparing: "permutationsii" vs "permutationsii"
[War Check] ✅ MATCH FOUND for yourusername!
[War Check] Problem: Permutations II
[War Check] Status: Accepted
[War Check] Time: 2025-12-24T13:37:34.000Z
[War Check] Updated latest submission for yourusername
[War Check] yourusername total matching submissions: 1
```

---

## 🔧 Quick Fix: Add More Logging

If you're still not seeing matches, add this temporary code to see ALL submissions:

In browser console, run:
```javascript
// See all recent submissions
console.log('All submissions:', warState?.submissions);
console.log('Submission counts:', warState?.submissionCounts);
```

---

## ✅ Verification Checklist

- [ ] War problem slug matches your submission
- [ ] Submission timestamp is AFTER war start time
- [ ] Normalized slugs match exactly
- [ ] Console shows "✅ MATCH FOUND"
- [ ] Submission count increments
- [ ] Status shows in war card

---

## 📝 Your Specific Case

**Your Submission**:
```json
{
  "title": "Permutations II",
  "titleSlug": "permutations-ii",
  "timestamp": "1766583254",
  "statusDisplay": "Accepted",
  "lang": "cpp"
}
```

**Normalized slug**: "permutationsii"

**Timestamp**: December 24, 2025 at 13:37:34 GMT (7:07 PM IST)

**Questions to check**:
1. What is the war problem slug? (Check console)
2. When did the war start? (Check console)
3. Is the war still active?
4. Did you click "Check Submissions" button?

---

## 🎯 Next Steps

1. **Open browser console** (F12)
2. **Click "Check Submissions"** button
3. **Copy ALL logs** that start with `[War Check]`
4. **Share the logs** so we can see exactly what's happening

The logs will show us:
- What problem the war is for
- When the war started
- What submissions were fetched
- Why your submission matched or didn't match

---

**Status**: 🔍 **DEBUGGING**  
**Date**: December 24, 2025  
**Need**: Console logs from "Check Submissions" click
