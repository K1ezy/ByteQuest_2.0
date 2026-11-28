# Spec: Workshops decide what students see (remove the language track)

Status: ready-for-agent
GitHub: #6

Decision record: `docs/adr/0001-workshops-decide-what-students-see.md`. Vocabulary: `GLOSSARY.md` (Workshop language, Workshop activity, Class leaderboard).

## Problem Statement

A ByteQuest student must choose one programming language ("track") and can only join Workshops and open activities in that language. Instructors teach Python, C++ and Java at the same time, and students take more than one of those classes. A student in a C++ class and a Java class cannot use both, the "Choose your programming language" step confuses them, and an account with no track sees no activities at all.

## Solution

Workshops decide what a student sees. A student joins any Workshop with its code, whatever its Workshop language, and sees every Workshop activity from every Workshop they belong to. Nobody chooses a language. XP and level are one total per student, each Workshop has its own Class leaderboard, and every page that showed "your track" shows the student's Workshop languages instead.

## User Stories

1. As a student, I want to join a Workshop with only its join code, so that I never have to choose a programming language first.
2. As a student, I want to join a Python Workshop and a Java Workshop at the same time, so that I can take both of my classes in ByteQuest.
3. As a student, I want joining a Workshop in another language never to be refused, so that a second class is no harder to join than the first.
4. As a student, I want no separate language step after sign-up, so that onboarding asks only what it needs.
5. As a student, I want the Quest Map to list the Workshop activities from all my Workshops, so that I see all my work in one place.
6. As a student, I want each Quest Map card to show its Workshop language, so that I know whether a challenge is Python, C++ or Java before opening it.
7. As a student, I want to filter the Quest Map by language, so that I can focus on one class at a time.
8. As a student, I want "All languages" selected by default, so that nothing is hidden when I arrive.
9. As a student, I want the "All track practice" view gone, so that there is no second, confusing list of activities.
10. As a student, I want to open any coding challenge or quiz shared by one of my Workshops, whatever its language, so that every assigned activity works.
11. As a student, I want my code submissions graded in the activity's language, so that Java code goes to the Java grader even though I also take Python.
12. As a student, I want activities from Workshops I don't belong to to stay closed to me, so that I only see what my instructors assigned.
13. As a student, I want course-only activities to keep working when I'm in that course, so that course work is unaffected.
14. As a student, I want one XP total and one level from all my languages, so that every class counts toward my progress.
15. As a student, I want a Class leaderboard for each of my Workshops, so that I compare myself with my real classmates.
16. As a student, I want to switch between my Workshops' leaderboards, so that I can see my rank in each class.
17. As a student, I want one "Next up" recommendation across all my Workshops, picked by the soonest deadline and then the lowest number, so that I always know the one thing to do next.
18. As a student, I want the Dashboard and Quest Map to show the same "Next up", so that the recommendation is consistent.
19. As a student, I want the Mastery map to show concepts from all my languages with a language label and filter, so that I see my strengths in each language.
20. As a student, I want "Loops in Python" and "Loops in Java" to be separate concepts, so that mastering one doesn't claim mastery of the other.
21. As a student, I want Memory Check to show reviews due in every language, each labelled, so that I don't miss a review for my other class.
22. As a student, I want the progress recap and Debugger's Codex to include every language, labelled, so that my history is complete.
23. As a student, I want the AI tutor to answer in the language of the activity I'm working on, so that a Java question gets Java help.
24. As a student, I want the AI tutor, when no activity is open, to follow the language of the code I paste or to ask which language I mean, so that it never assumes the wrong one.
25. As a student, I want the profile header and account menu to show my Workshop languages, like "Python · Java", instead of a track, so that my profile matches my classes.
26. As a student in no Workshop yet, I want the Quest Map to say "Join a Workshop to see its activities" with a button to Workshops, so that I know what to do next.
27. As a student whose Workshop was archived, I want my past attempts, XP, stars and badges kept, so that finishing a class never costs me progress.
28. As a student whose Workshop was archived, I want its activities to stop accepting new attempts, so that a finished class is clearly closed.
29. As a student who leaves a Workshop, I want my history kept and new attempts closed, the same as when a Workshop is archived.
30. As a student who leaves one Workshop but stays in another that shares the same activity, I want to keep access through the remaining Workshop.
31. As an instructor, I want students in my Python, C++ and Java Workshops to be the same accounts, so that I don't ask them to make one account per language.
32. As an instructor, I want the student performance pages to show each student's Workshop languages instead of a track, so that the data matches how students enrol.
33. As an instructor, I want my Workshop's Class leaderboard to rank only my Workshop's members, so that ranks are fair within the class.
34. As an instructor, I want ML predictions for a student to be scoped to my Workshop, so that their work in another class doesn't distort my class's predictions.
35. As an instructor, I want newly provisioned student accounts to start with no language, so that the system doesn't assume Python.
36. As a researcher, I want the stored per-student language kept in the database for now, so that existing research exports still run.
37. As a researcher, I want the synthetic ML scenario students to keep working through their courses, so that the scenario's data stays valid.

## Implementation Decisions

- **One access rule.** A single student-access rule replaces the track rule everywhere: the activity is published, open and shared by an active Workshop the student belongs to, or it is a course-only activity of a course the student belongs to. Quest lists, quest details, quiz grading, submissions, submission jobs, activity previews, the pilot checks, mastery, progression and the tutor's activity lookup all use it. No call site compares an activity's language with a student's language.
- **Joining.** Joining takes only the join code. The language field on the join request, the "different language track" refusal and the first-join language assignment are removed. Joining still records Workshop-scoped assignment predictions as it does today.
- **Onboarding.** The student onboarding endpoint stops accepting and storing a language. The onboarding screen and the "Choose your programming language" empty state are removed.
- **Archived and left Workshops.** Membership in an archived Workshop, or a membership that was left, no longer grants access for new attempts. Attempt history, XP, stars and badges are read without the access rule, so they stay visible.
- **XP and level** are computed from all of a student's visible attempts, with no language filter.
- **Class leaderboard.** The leaderboard endpoint takes a Workshop and ranks that Workshop's members. A student may only view leaderboards of their own Workshops; instructors view their own Workshops'.
- **Next up.** The sequencer picks one recommendation across all of the student's Workshop activities: soonest deadline first, then the lowest position. It returns nothing when the student is in no Workshop.
- **Concept reviews** (Memory Check, progress recap, Mastery map, Codex) keep their per-language key and drop the student-language filter. Responses carry each item's language; the frontend groups, labels and filters by it. The Mastery map response replaces its single `track` field with the student's Workshop languages.
- **AI tutor.** Chat about an activity uses the activity's language. Chat with no activity has no fixed language, and the tutor prompt is told to infer it from pasted code or ask.
- **ML predictions.** Targets and shadow predictions are scoped to a student and a Workshop, using that Workshop's activities and language, instead of comparing students on the same track.
- **Profile and instructor views.** API responses that exposed `enrolled_language` expose `workshop_languages` (a list, possibly empty) instead. Frontend types, the account menu, the profile header, the workspace shell and the instructor student pages switch to it.
- **Account provisioning** no longer sets a default language for new students.
- **Schema.** No schema change. The `enrolled_language` and `track_selected_at` columns stay but are no longer read or written by the app. Dropping them is a later cleanup.
- **Quest Map UI.** Remove the "Workshop activities" / "All track practice" toggle. Add a language badge to each card and a language filter row (All languages, then the student's Workshop languages) beside the challenge/quiz filter.

## Testing Decisions

- Test behaviour from the outside only: what a student or instructor gets back from the API or sees on the page, never which helper was called.
- **Backend API integration tests**, following the existing learning-flow integration suite that already creates Workshops, joins students and opens activities over HTTP. They cover a student joining a Python and a Java Workshop with no language step and opening an activity from each; a student opening an activity from a Workshop they're not in (refused); archived and left Workshops (history visible, new attempts refused); XP summed across languages; the Class leaderboard ranking only its members; "Next up" ordered by deadline across Workshops; and concept reviews kept separate per language.
- The old track tests (refusing a different-language join, "choose a language" onboarding) are rewritten to assert the new behaviour, not deleted silently.
- **Frontend component tests**, following the existing Quest Map page and workshop activities tests: the Quest Map lists cards from several Workshop languages with language badges; the language filter narrows them; the old toggle is gone; a student in no Workshop sees the join prompt.
- The existing Playwright Quest Map layout test must keep passing at desktop, narrow and large-text sizes.
- Every ticket runs the backend tests and the frontend tests it touches. The full backend and frontend suites run before merge.

## Out of Scope

- Dropping the `enrolled_language` and `track_selected_at` columns (a later cleanup).
- An open catalogue of practice activities outside Workshops.
- A global leaderboard across all students.
- Per-language XP or levels.
- Changing instructor authoring, beyond no longer falling back to a student language.
- Changes to exams, which are already retired.

## Further Notes

- The local demo data already fits this model. `seed_local_fundamentals_bank.py` put every shareable activity into instructor@gmail.com's CS 112, CS 122 and CS 212 Workshops, and kieser@gmail.com is a member of all three with no track. That account is the natural manual check once this ships.
- 194 of 275 local student accounts are in no active Workshop, mostly synthetic ML students who use course-only activities. That's expected under this model.
