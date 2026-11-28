# 01: One workshop-based access rule, including the AI tutor

**What to build:** A student sees and opens a coding challenge or quiz only when an active Workshop they belong to shares it, in any Workshop language; course-only activities keep their course-membership rule. This replaces the per-student language check in every place a student lists, opens, submits, is graded on or previews an activity, including the pilot checks. The AI tutor's chat about an activity uses that activity's language; chat with no activity has no fixed language and the tutor infers it from pasted code or asks.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent
GitHub: #7

- [ ] A student in a Python and a Java Workshop can open, submit and be graded on an activity from each (API integration test)
- [ ] An activity shared only by a Workshop the student isn't in is refused
- [ ] An archived Workshop, or one the student left, refuses new attempts while past attempts, XP, stars and badges stay visible
- [ ] An activity shared by another Workshop the student still belongs to stays open after leaving one Workshop
- [ ] Chat about a Java activity uses Java for a student who is also in a Python Workshop
- [ ] Old track-based access tests are rewritten to assert the new rule; backend suite passes
