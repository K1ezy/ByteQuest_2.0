# Spec: Charts and metrics a student or instructor understands at a glance

Status: ready-for-agent
GitHub: #15

Vocabulary: `GLOSSARY.md` (Pass mark, Activities passed, First-try pass, Takeaway, Workshop language). Design reference: the throwaway prototype on branch `prototype/insight-clarity` (route `/prototype-insight-clarity`), where **Variant A, "sentence first"** was chosen on 28 November 2026.

## Problem Statement

Students and instructors see numbers and charts they can't read quickly. "62%" or "Not started: 4" doesn't say what is counted, out of how many, or whether it's good. Definitions sit in a collapsed list at the bottom of the page. The student score chart mixes different activities, so one hard activity looks like a collapse. The instructor class trend averages every repeated attempt per day, so it swings on tiny samples. "Attempts passed" penalises normal retrying. Since students now take several languages, "Average score by topic" also merges the same topic across languages (Loops in Python and Loops in Java become one row).

## Solution

Every metric and chart says what it means in plain words. A metric card leads with a sentence giving the value, its total and what is left, with the number, label and an (i) definition underneath. A chart's title is its **Takeaway**, a sentence written by fixed rules from the data. Every number shows its total or sample size and a point of comparison. Students compare only with their own earlier period and each activity's **Pass mark**. Instructors compare with last week and totals. Charts that mix activities mark each point passed or not passed instead of drawing one pass-mark line. Below 5 data points, the screen says "Not enough data yet — based on N".

## User Stories

1. As a student, I want each number on my Progress page to start with a plain sentence, such as "You passed 13 of 21 activities. 8 more are open.", so that I understand it without reading definitions.
2. As a student, I want to see **Activities passed** ("13 of 21 activities your workshops shared") instead of "Attempts passed", so that retrying isn't counted against me.
3. As a student, I want to see how many activities I passed on the first try ("8 of the 13 you passed"), so that I can see what I already knew.
4. As a student, I want my score chart to show one point per activity, its first-try score, in the order I did them, so that a hard activity's retries don't look like a collapse.
5. As a student, I want each point to show filled when that first try passed and hollow when it hasn't yet, so that I see results without knowing each pass mark.
6. As a student, I want the chart's title to tell me what it shows, such as "6 of your last 8 first tries passed. Your first-try scores are rising.", so that I get the point immediately.
7. As a student, I want trends judged against my own earlier work, never against classmates, so that the page encourages rather than ranks me.
8. As a student, I want "Not enough data yet — based on 3" instead of a confident trend from three points, so that I'm not misled.
9. As a student, I want an (i) next to every metric label that explains it on hover, tap or keyboard focus, so that I can check a definition without scrolling.
10. As a student, I want "Average score by topic" to separate Loops in Python from Loops in Java, so that each class's topics are accurate.
11. As a student, I want each topic or concept to show its language and a language filter when I take more than one, so that I can focus on one class.
12. As a student, I want the 30-day activity grid to have a legend for its shades (0, 1, 2, 3, 4+ attempts), so that I can read it.
13. As a student, I want the Mastery ring labelled as the share of a concept's activities I've passed, so that "mastery" isn't vague.
14. As a student, I want the Dashboard recap to use the same sentence-first cards, so that the whole app reads the same way.
15. As a student, I want wording that never says "failed", such as "not passed yet", so that the page stays encouraging.
16. As an instructor, I want each summary number to lead with a sentence giving its total, such as "4 of 21 learners haven't started.", so that I understand the class at a glance.
17. As an instructor, I want each summary number to show its change since last week in words with an arrow, such as "↓ 3 since last week", so that I see direction without relying on colour.
18. As an instructor, I want each summary sentence to link to the matching roster filter, such as "Show them →", so that I can act immediately.
19. As an instructor, I want the class score trend to show weekly first-try averages per activity type by default, so that repeated attempts and single days don't distort it.
20. As an instructor, I want a Weekly/Daily switch on that trend, so that I can look closer when I need to.
21. As an instructor, I want points based on fewer than 5 results faded, with the tooltip saying so, so that I don't act on noise.
22. As an instructor, I want the trend's title to be its takeaway, such as "First-try challenge scores are rising (up about 8 points).", so that I get the point immediately.
23. As an instructor, I want a legend above the Outlook column explaining the bands (Likely to pass 60% or higher, Continue practicing 40–60%, May need support below 40%) and that predictions are advisory only, so that I read outlooks correctly.
24. As an instructor, I want an (i) on each outlook badge showing that student's estimated chance and the target activity, so that I see why the badge was given.
25. As an instructor, I want Activity analysis to show, beside pass rate and first-try pass rate, how many attempts a pass usually takes and a link from "Stuck" to those learners, so that I can find who needs help.
26. As an instructor, I want Gamification insights to use the same sentence-first cards and takeaway titles, so that every instructor screen reads the same way.
27. As an instructor, I want an (i) definition next to every metric label as well as the full definitions list, so that I can check any measure quickly.
28. As an instructor, I want language labels and a language filter where my Workshops span several languages, so that I can look at one class.
29. As a screen-reader user, I want every chart to keep its text summary and "View as table", now with the takeaway first, so that I get the same meaning without the picture.
30. As a researcher, I want takeaways produced by fixed, testable rules rather than an AI model, so that the same data always gives the same sentence.

## Implementation Decisions

- **Screens in scope.** Students: Dashboard recap, Profile → Progress, Profile → Mastery. Instructors: Dashboard, Performance, Activity analysis, Gamification insights. Out of scope: Admin pages, the ML model-evaluation page, the Gradebook.
- **One takeaway module.** A pure function takes a series of values (and a subject) and returns a Takeaway. It needs at least 5 values, otherwise it returns "Not enough data yet — based on N". It compares the mean of the latest half with the earliest half: "rising" at +5 points or more, "falling" at −5 or less, otherwise "steady". Counting takeaways, such as "6 of your last 8 first tries passed", come from the same module. No AI.
- **One metric card.** A shared component takes a sentence, a value, a label, a definition key, an optional total and an optional change. It renders the sentence first, then value, label and the (i) definition. It replaces the existing StatCard and StatStrip items on the in-scope screens. Definitions stay in the existing metric dictionary, extended with student-facing entries, and the "How these measures are defined" list stays.
- **(i) definition.** An accessible disclosure button next to each label, opening on hover, tap or keyboard focus and closing on Escape.
- **Charts.** The existing line chart gains: a takeaway title (the descriptive name becomes the subtitle), per-point passed/not-passed markers (filled or hollow, explained in the legend and tooltip), faded points below the minimum sample, and an optional reference line used only on a chart for a single activity. "View as table" and the screen-reader summary stay, with the takeaway first.
- **Student data.** The analytics endpoint adds: activities passed and activities open (counted over activities the student can open), first-try passes, a per-activity first-try series in order (activity, language, first-try score, passed), and per-language topic breakdowns grouped by (language, topic). "Attempts passed" leaves the student page.
- **Instructor data.** The performance summary adds last week's values for its counts. The class trend becomes first-try averages per activity type, bucketed weekly by default or daily on request, with a result count per point.
- **Comparisons.** Students: own earlier period and pass marks only, never class averages or ranks. Instructors: last week, pass marks and totals, never other classes.
- **Wording.** Students: second person, encouraging, "not passed yet" instead of "failed". Instructors: neutral and action-oriented, each sentence linking to the matching filter where one exists.
- **Languages.** Topic and concept items show their language. The "All languages / …" filter appears when the viewer has more than one language.
- **Activity grid legend** and the **Mastery ring label** as in stories 12 and 13.
- **No new chart library.** Extend the existing line chart, meter list and stat strip.

## Testing Decisions

- Test behaviour, not structure: what a person reads and can reach.
- **Takeaway rules:** unit tests of the pure function covering rising, falling, steady, the 5-point boundary, fewer than 5 values, and the counting takeaway.
- **Shared components:** the metric card and the line chart tested once each. The sentence comes first, the total or sample size is present, the (i) definition opens by click and keyboard and closes on Escape, passed/not-passed markers have a text equivalent, and the takeaway leads the summary and table.
- **Backend API tests** in the style of the existing learning-flow integration suite: activities passed and open, first-try series and passes, per-language topics (Loops in Python and Java separate), weekly and daily first-try trend with counts, last-week values.
- **Layout tests:** extend the existing Playwright layout tests for the changed student and instructor screens at desktop, narrow and large-text sizes.
- **Manual check before the pilot:** a 5-second test with 2–3 students and instructors: can they say what each card means and whether it's good?

## Out of Scope

- Admin pages, the ML model-evaluation page and the Gradebook.
- Class averages or ranks shown to students.
- AI-written takeaways.
- New chart types or libraries.
- Comparisons between different classes or instructors.

## Further Notes

- The "Average score by topic" language merge is a bug introduced by the 28 November multi-language change. It should be the first ticket.
- The prototype's sample data and variants are kept on `prototype/insight-clarity` as a primary source. Don't merge that branch.
