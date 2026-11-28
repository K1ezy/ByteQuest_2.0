# Manuscript and system alignment, 28 November 2026

Compared: `ByteQuest_Manuscript_final-BaganJudNiUnta.docx` (user's Downloads folder, about 16,400 words) against the system at commit `5706c39` on `feat/pilot-readiness-quick-fixes`, after the language-track removal ([ADR 0001](../adr/0001-workshops-decide-what-students-see.md)). Paragraph numbers [n] count the manuscript's non-empty paragraphs from the start of the document.

**Overall:** the manuscript already describes a Workshop-centred system and never mentions a per-student "language track", a track leaderboard or a language-selection step. Only one sentence states behaviour the system no longer has. The other items are features the system has that the manuscript does not name, plus one library version.

## Must fix: the manuscript states behaviour the system no longer has

| Where | Manuscript says | System now | Suggested wording |
| --- | --- | --- | --- |
| Algorithm 2, ACCEPT_SUBMISSION [347] | "CHECK active role, activity visibility, language and availability." | A submission is accepted when the student can see the challenge (an active Workshop they belong to shares it, or it is a course-only activity of their course) and it is open. Nothing compares the student's language with the challenge's. | "CHECK active role, activity visibility through the learner's Workshop or course, and availability." |
| Tools table [576] | "Scikit-Learn 1.9, Pandas 2.2" | The backend runs scikit-learn 1.9.1 and **pandas 3.1.0** (`requirements.txt` allows pandas ≥ 2.2). | "Scikit-Learn 1.9, Pandas 3.1". **Decided 28 November 2026: the manuscript changes to Pandas 3.1; the system stays on 3.1.** |

## Should add: system features the manuscript does not describe

| Feature in the system | Where the manuscript could mention it | Suggested wording |
| --- | --- | --- |
| One account can join Workshops in different languages; joining needs only the join code. | Workshop definition [199]; Development of the Learning Platform [284] | Add to [199]: "Each Workshop uses one programming language, and a student may belong to Workshops in different languages." Add to [284]: "Students join Workshops with a join code." |
| Class leaderboard per Workshop (XP ranking of one Workshop's members, public @handles only) | Gamification lists in [128], [151], [253] ("points, badges, levels, and quests") | Add "Workshop leaderboards" to those lists, **or** say why leaderboards are excluded from the evaluation. Your own review [205] reports that leaderboards showed no significant effect, so a short justification helps either way. |
| Mastery map, Memory Check (spaced recall) and Debugger's Codex | [253]; the student flowchart (Figure 10) already says "Review results, attempts, XP, badges, and Mastery." | Optional: "…progress dashboard with a Mastery map and spaced Memory Checks…". Concepts are tracked per language (Loops in Python and Loops in Java are separate). |
| Rule-based "Next up" | [106] and [159] ("deterministic rule-based task progression") match the system. | Optional detail: "Next up recommends the open, unfinished Workshop activity due soonest, except that after an unmastered attempt it first suggests practice on the same concept." |

## Already aligned (no change needed)

- **Prediction features** use "earlier same-course, same-language history" ([386]). The system keeps history and features per language.
- **Live prediction eligibility** "in the course and, if applicable, Workshop" ([415]) matches the code, which now also requires that the learner can see the challenge.
- **Advisory bands**: advance at 0.60 or higher, standard practice 0.40 to below 0.60, remedial below 0.40 ([298], [426]–[428]) match `thresholds.py`. The 0.50 prediction cutoff also matches.
- **Stack**: Next.js 16.4, React 19.3 and TypeScript 5.9 ([555]) match `package.json`. `gemini-3.5-flash-lite` and `gemini-embedding-2` ([613]) match the backend configuration.
- The **Workshop** definition [199] and the separation of course enrollment from Workshop membership match the system.

## Not checked

- Figures (flowcharts, ERD, DFD) are images. Only their captions and embedded text labels were read. The ERD still correctly shows `profiles.enrolled_language`, because the column remains in the database.
- Chapter 4 results and the appendices were scanned only for the terms above.
