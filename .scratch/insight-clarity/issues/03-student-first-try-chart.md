# 03: Student first-try chart

**What to build:** The student score chart shows one point per activity: its first-try score, in the order done. A filled dot means passed and a hollow dot means not passed yet, explained in the legend and tooltip. The takeaway is the chart title (for example "6 of your last 8 first tries passed. Your first-try scores are rising."), with fewer than 5 points showing "Not enough data yet — based on N". The shared line chart gains passed markers, faded points and a takeaway title for reuse.

**Blocked by:** 02

**Status:** ready-for-agent
GitHub: #18

- [ ] API test: analytics returns the per-activity first-try series (activity, language, score, passed) in order
- [ ] Component test: filled and hollow markers have a text equivalent; the takeaway leads the title, summary and table
- [ ] Fewer than 5 points shows the not-enough-data message
