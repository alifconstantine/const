# Skill Quality Rubric

Score each dimension on a 1-10 scale. A production-quality skill should score 70+ overall; the best skills in this repo score in the 80s and 90s.

## Dimension 1: Trigger Quality (Description Field)

Does the description route the right requests to this skill — and only those?

| Score | Criteria |
|---|---|
| 1-3 | Generic ("analyze stocks"); misses whole categories of requests, or so broad it fires on everything |
| 4-5 | Covers the main use case only; expert jargon only, or a long list of near-synonym phrasings standing in for categories |
| 6-7 | Names what the skill does and most intent categories, with the tools and data types it uses |
| 8-9 | Every intent category, the distinctive vocabulary users will use, scoped sideways entries, and pointers to sibling skills; well under 1024 characters |
| 10 | A trigger check routes varied real requests correctly, including near-misses that belong to a sibling skill |

**Example:** sepa-strategy names the methodology and its distinctive terms (VCP, trend template, Stage 2, pivot entries), then adds a scoped sideways entry — "should I buy this stock" about a growth or momentum name.

## Dimension 2: Defaults Coverage

Does every parameter have an explicit default so the skill never stalls waiting for input?

| Score | Criteria |
|---|---|
| 1-3 | No defaults table, skill frequently asks user for missing info |
| 4-5 | Some defaults mentioned in prose, incomplete coverage |
| 6-7 | Defaults table exists, covers main parameters, missing a few edge cases |
| 8-9 | Comprehensive defaults table with rationale column, covers all parameters |
| 10 | Every conceivable parameter has a default, skill always produces output |

**Example:** options-payoff has a field / where-to-find-it / default row for every input, including how to resolve spot when a screenshot omits it.

## Dimension 3: Instruction Design

Are instructions matched to the work — exact where operations are fragile, goal-oriented where the work is judgment?

| Score | Criteria |
|---|---|
| 1-3 | Wall of undifferentiated text, or a rigid script for everything including the analysis |
| 4-5 | Structure exists but order-independent judgment work is choreographed step by step, or fragile operations are left vague |
| 6-7 | Numbered steps where order matters; exact commands for setup and calls; judgment mostly stated as criteria |
| 8-9 | Specificity matched to fragility throughout; judgment stated as goals, criteria, and domain heuristics with reasons; gates only where a failed check really ends the analysis |
| 10 | A capable model could run it cold and produce expert-quality work without guessing at the mechanics or being boxed in on the judgment |

**Example:** sepa-strategy gates on stage and the trend template, where failure really ends the analysis; earnings-preview states what the briefing must cover and leaves the "what to watch" judgment to the model.

## Dimension 4: Reference File Strategy

Is complexity properly deferred to reference files? Is SKILL.md lean?

| Score | Criteria |
|---|---|
| 1-3 | Everything inline, SKILL.md is 500+ lines, no reference files |
| 4-5 | Some references exist but SKILL.md still bloated, or references are trivial |
| 6-7 | Good split — SKILL.md under 300 lines, 1-3 reference files for deep content |
| 8-9 | Clean architecture — SKILL.md under 250 lines, reference files covering all depth, dated datasets kept out of SKILL.md |
| 10 | Perfect split — SKILL.md is pure workflow and judgment, all detail in well-organized references |

**Example:** sepa-strategy keeps the checklist in SKILL.md and the full rubric for each stage of the methodology in seven reference files.

## Dimension 5: Dynamic Calling & Runtime Adaptation

Does the skill detect available tools at runtime and adapt its behavior?

| Score | Criteria |
|---|---|
| 1-3 | No detection, hardcodes a single tool/library, fails if not installed |
| 4-5 | Has a dependency check but no decision tree or fallback path |
| 6-7 | Detection flow with fallback messages; single method path after detection |
| 8-9 | Full detection flow → decision tree → a second method path where a real alternative exists; auth detection; graceful fallbacks |
| 10 | Multi-dimensional detection (tools + auth + runtime + live data), decision tree with 3+ paths, inline fallbacks at every usage point, frontmatter conditional activation |

**Examples:** github-auth detects gh vs git, auth state, and credential helper with three method paths. fintel-data resolves its API key from the environment, a local `.env`, or the repo-root `.env`. options-payoff injects a live SPX price with a fallback.

**Note:** Skills that are pure analysis (no external deps) can score 7+ by having a well-structured "Gather Data" step with data source alternatives (e.g., yfinance vs manual input).

## Dimension 6: Output Contract

Does the final step say what a good answer contains?

| Score | Criteria |
|---|---|
| 1-3 | "Summarize the results" — nothing specified |
| 4-5 | Lists topics, but not what to lead with, which caveats apply, or what verdict to give |
| 6-7 | Clear contract: what to lead with, the required content, the caveats |
| 8-9 | Contract plus a precisely defined verdict or grade scale; fixed templates only where format matters; length described qualitatively; examples labeled illustrative |
| 10 | Output is complete and useful across varied inputs — including thin data — without a rigid template, while format-sensitive parts (scorecards, widgets) are pinned exactly |

**Example:** sepa-strategy defines a three-way verdict (Strong Buy Setup / Watch List / Pass) and pins its trend-template scorecard; startup-analysis defines a verdict scale per lens and asks each section to scale to the evidence.

## Dimension 7: Error Handling & Missing Data

How does the skill handle missing data, failed API calls, or partial input?

| Score | Criteria |
|---|---|
| 1-3 | No mention of error cases, skill will break on missing data |
| 4-5 | Some error handling but gaps — certain failures cause silent wrong results |
| 6-7 | Handles main error cases, has "if unavailable" notes |
| 8-9 | Comprehensive: missing data noted and flagged, fallback approaches, user prompts |
| 10 | Graceful degradation at every step — always produces useful output even with partial data |

**Example:** sepa-strategy says to proceed with what's available and flag a missing RS rating as a significant gap.

## Dimension 8: Code / Formula Quality

Are code templates and formulas correct, complete, and copy-paste ready?

| Score | Criteria |
|---|---|
| 1-3 | No code provided, or pseudocode that won't run |
| 4-5 | Code snippets exist but incomplete — missing imports, undefined variables, or calls to APIs that no longer exist |
| 6-7 | Working code that needs minor adaptation |
| 8-9 | Copy-paste ready code with proper imports and error handling, checked against the current library version |
| 10 | Production-quality code templates in reference files + skeleton in SKILL.md, verified end to end |

**Example:** stock-correlation ships complete Python functions with imports, NaN handling, and edge cases.

**Note:** Not all skills need code. For pure analysis skills, score based on formula clarity and table quality.

## Dimension 9: Conciseness & Register

Is SKILL.md appropriately sized, and does every line earn its place?

| Score | Criteria |
|---|---|
| 1-3 | Over 500 lines, or dense with capitalized warnings, repeated rules, and instructions the model follows by default |
| 4-5 | 300-500 lines, or several MUST/NEVER/CRITICAL lines without reasons, generic virtues ("be thorough", "double-check"), maintainer notes, or history |
| 6-7 | 200-300 lines; mostly plain register with a few restated defaults or duplicated rules |
| 8-9 | 150-250 lines; each constraint stated once, plainly, with its reason; no boilerplate |
| 10 | Under 200 lines with comprehensive reference files; nothing a capable model would already do unprompted |

**Example:** options-payoff stays under 200 lines and leaves the depth to two reference files.

## Dimension 10: Domain Accuracy

Is the skill's domain knowledge correct and trustworthy?

| Score | Criteria |
|---|---|
| 1-3 | Factual errors, wrong formulas, misleading guidance |
| 4-5 | Mostly correct but some imprecise statements, outdated info, or undated figures that have gone stale |
| 6-7 | Accurate for main use cases, some edge cases not covered |
| 8-9 | Highly accurate, edge cases documented, dated data labeled, disclaimers appropriate |
| 10 | Expert-level accuracy — could be used as a reference by domain practitioners |

**Example:** options-payoff has correct Black-Scholes formulas, documented edge cases, and a disclaimer.

---

## Scoring Summary Table

Copy this template when scoring a skill:

```
| # | Dimension | Score | Notes |
|---|---|---|---|
| 1 | Trigger quality | /10 | |
| 2 | Defaults coverage | /10 | |
| 3 | Instruction design | /10 | |
| 4 | Reference file strategy | /10 | |
| 5 | Dynamic content | /10 | |
| 6 | Output contract | /10 | |
| 7 | Error handling | /10 | |
| 8 | Code/formula quality | /10 | |
| 9 | Conciseness & register | /10 | |
| 10 | Domain accuracy | /10 | |
| **Total** | | **/100** | |
```

## Score Interpretation

| Range | Quality | Action |
|---|---|---|
| 90-100 | Exceptional | Ship as-is, use as template for new skills |
| 80-89 | Production | Ready to use, minor polish opportunities |
| 70-79 | Good | Functional, 2-3 targeted improvements recommended |
| 60-69 | Needs work | Usable but will frustrate users, prioritize fixes |
| Below 60 | Draft | Not ready for use, needs structural rework |
