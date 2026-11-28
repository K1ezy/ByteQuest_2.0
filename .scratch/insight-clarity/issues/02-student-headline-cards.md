# 02: Student headline cards, sentence first

**What to build:** Builds the shared pieces and uses them first on Profile → Progress: a pure Takeaway rules module, a shared metric card (sentence first, then value, label and an (i) definition), and the accessible (i) definition button. The student's headline cards read "You passed 13 of 21 activities. 8 more are open." and "8 of the 13 you passed went through on the first try." "Attempts passed" leaves the student page.

**Blocked by:** None (can start immediately)

**Status:** done
GitHub: #17

- [x] Unit tests for the takeaway rules: rising, falling, steady, the 5-point boundary, fewer than 5 values, counting takeaways
- [x] Component test: the metric card shows the sentence first, the total, and an (i) definition that opens on click and keyboard and closes on Escape
- [x] API test: analytics returns activities passed, activities open and first-try passes over activities the student can open
- [x] Profile → Progress no longer shows "Attempts passed"
