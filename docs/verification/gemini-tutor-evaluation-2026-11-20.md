# ByteQuest Gemini tutor pilot evaluation

November 20, 2026

## What was tested

Gemini 3.5 Flash-Lite answered the same 20 synthetic questions with the previous and updated tutor prompts. The comparison used five fictional course excerpts and a fictional graded activity. The two variants used the same question history. The provider returned token counts for all 40 replies in the final comparison. Local API integration tests checked saved and temporary chat, course access, exam restrictions, and the solution guard separately.

## Token use and estimated Gemini cost

Token columns show the mean input, visible output, and thinking tokens per reply. Costs use the standard Gemini 3.5 Flash-Lite paid rates of $0.30 per million input tokens and $2.50 per million output tokens, including thinking. The estimate covers generation and excludes query embeddings and PDF ingestion. [Gemini API pricing](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite)

| Type | Questions | Before tokens (input / output / thinking) | After tokens (input / output / thinking) | Before per 1,000 | After per 1,000 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Quick facts | 4 | 761 / 94 / 0 | 269 / 59 / 0 | $0.46 | $0.23 |
| General explanations | 6 | 766 / 198 / 0 | 331 / 174 / 0 | $0.72 | $0.53 |
| Course questions and follow-ups | 5 | 770 / 121 / 0 | 558 / 200 / 0 | $0.53 | $0.67 |
| Standalone debugging | 3 | 777 / 157 / 0 | 314 / 147 / 0 | $0.63 | $0.46 |
| Graded challenge hints | 2 | 886 / 184 / 0 | 759 / 59 / 0 | $0.73 | $0.38 |
| **Overall** | **20** | **780 / 150 / 0** | **416 / 142 / 0** | **$0.61** | **$0.48** |

The updated tutor made 7 query embedding calls versus 20 before. The sample's estimated generation cost fell by **21% overall**. Course replies cost more on average because they used more output tokens. The updated tutor recorded 8,310 input tokens and 2,841 output tokens across the 20 turns. The provider reported zero thinking tokens on these turns, including the three debugging examples sent with low thinking. Future usage depends on the mix and length of student chats.

## Reply quality

- Both Python overview questions gave a definition, concrete uses, and a small example with its output. Both skipped PDF lookup. The general follow-up continued the `range(3)` example.
- All four in-scope course questions, including a follow-up, cited the expected fixture page. The fifth asked about a topic absent from the fixtures. The tutor acknowledged the gap and answered without a citation. Its prose had one typo in the name of the `async with` block. The code example used the correct syntax.
- The three debugging replies identified the cause and gave a check the learner could use to verify the fix.
- One intermediate graded reply exposed the algorithm in an alternate example. The final prompt requires prose-only hints, and a backend guard withholds code blocks. In the rerun, both graded replies gave a next step in prose, and the direct request for the full solution was declined.
- All 20 final replies ended normally without hitting the token ceiling.

Google returned a 15-requests-per-minute free-tier limit for the configured test project. The run resumed at a lower rate. This is a small local pilot sample. The live VPS and classroom concurrency remain unverified. [Gemini rate limits](https://aistudio.google.com/docs/rate-limits)

The detailed synthetic comparison records are retained in the local rehearsal workspace.
