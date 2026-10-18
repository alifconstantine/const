# Writing SKILL.md and Reference Files

Detailed instructions for authoring each part of a skill. This is the reference companion to Steps 3-4 of the skill-creator workflow.

## Writing for Current Claude Models

Current Claude models follow instructions closely and literally, plan multi-step work on their own, and verify their own work without being asked. Skills written for earlier models often over-steer them. Apply one test to every line: **could the model already know this?** Re-run that test when a new model generation ships — a line that was load-bearing for one model can be dead weight for the next.

- **Keep what only the author knows.** The environment and tools, exact commands, API contracts and field names, defaults, the domain heuristics and thresholds, the quality bar, and the *reasons* behind each constraint. Context is never cruft, and a skill that gives too little context gets generic output.
- **Cut what the model does by default.** "Be thorough", "think step by step", "plan before acting", "double-check your answer", "don't be lazy". These don't improve the work; on current models they cause over-planning and over-verification.
- **Say it once, plainly, with the reason.** Capitalized MUST/NEVER/CRITICAL and repeated warnings made older models comply; current models over-apply them, and an anxious skill produces cautious, hedging output. Hedges cut the other way — "try to include X if possible" now reads as permission to skip X. State real requirements directly.
- **Match specificity to fragility.** Exact commands for narrow bridges (installs, auth, CLI flags, destructive operations, formulas that must be right). Goals, criteria, and heuristics for open ground (analysis, interpretation, writing), where a hand-written script is worse than the model's own plan.
- **Describe success rather than enumerating failures.** Keep a prohibition only when it encodes a real constraint (read-only access, compliance, privacy) or a failure you have actually seen — and give its reason.
- **Watch your examples.** A concrete example is the strongest signal in a skill: the model copies its length, tone, and structure. Label examples as illustrative, vary them when there are several, and don't invent figures for real companies.
- **Keep numbers out of length guidance.** "Two to three sentences" or "at most five bullets" starves the answer on hard cases; describe the length qualitatively ("a short read of the overall setup").
- **Leave history and maintenance out.** Past incidents, PR numbers, "this now works differently", and maintainer notes belong in the README or git history, not in text the model reads on every trigger.

## Writing the Frontmatter

Write the YAML frontmatter first. See `references/frontmatter-guide.md` for the complete field reference.

```yaml
---
name: skill-name-here
description: >
  [What it does — concrete, specific, with the tool or data source]
  [Use this skill whenever the user... — the categories of requests it serves,
   with the distinctive vocabulary users will use: methods, data types, entities]
  [Sideways entries — "also when the user asks X in context Y"]
  [Boundaries — "for Z, use sibling-skill instead"; read-only if relevant]
---
```

The description is routing text: it rides along in every request and decides whether the skill loads. Current skills tend to under-trigger, so calibrated urgency ("use this skill whenever...", "even if they only give a ticker") is fine here — this is the one place it belongs.

**Description quality rules:**
- Cover every category of request the skill serves, including sideways entries (a methodology skill should also catch "should I buy this stock" in its context)
- Name the specific tools, methods, or APIs the skill uses, and example entities (tickers, sites) where they help recognition
- Name categories instead of listing near-synonymous phrasings — ten ways to say "show me the price" cost tokens in every session and generalize worse than "current quotes and price history"
- Point to sibling skills for neighboring requests
- Keep behavior out of the description; the body is where the skill says how to do the work

## Writing Step 1: Detection Flow

Skills that use external tools should start with a detection flow — not just a single dependency check, but a probe of the dimensions that change what the skill does next, feeding a decision tree. See `references/dynamic-calling.md` for the complete pattern catalog.

### Template: Detection flow with decision tree

```markdown
## Step 1: Detection Flow

**Environment status:**
` ` `
!`(command -v tool_a && tool_a --version) 2>/dev/null || echo "TOOL_A_MISSING"`
` ` `

` ` `
!`(command -v tool_b && tool_b --version) 2>/dev/null || echo "TOOL_B_MISSING"`
` ` `

` ` `
!`echo $API_KEY | head -c 8 && echo "...KEY_SET" || echo "KEY_NOT_SET"`
` ` `

**Decision tree:**
1. If `tool_a` available and `KEY_SET` → **Method 1** (preferred, richest)
2. If `tool_a` available but `KEY_NOT_SET` → guide auth setup, then Method 1
3. If `tool_a` missing but `tool_b` available → **Method 2** (fallback)
4. If neither available → install `tool_a`, then Method 1
```

### Key rules for detection flows

- **Always use fallback sentinels:** `|| echo "SENTINEL"`, so a check never hangs or errors silently
- **Detect the dimensions that matter:** tool existence, auth state, runtime environment
- **Produce a decision tree:** give a second method path wherever a real alternative exists
- **Show partial keys:** `echo $KEY | head -c 8` lets users verify without exposing secrets
- **Treat runtimes as separate:** Terminal and execute_code are different — a shell install doesn't mean execute_code has the package
- **Keep checks fast:** Under 2 seconds — they run synchronously before the skill loads

For pure analysis skills (no external deps), use a "Gather Data" step that still detects data source availability (e.g., "if yfinance available, use it; otherwise accept manual input from user").

## Writing Core Steps (2 through N)

Number the steps whose order genuinely matters — fetch before compute, a gate before the analysis that depends on it. For each step:

1. **Clear heading**: `## Step N: [Verb] [Object]` (e.g., "Compute Correlations", "Identify Stage")
2. **Decision table** if the step involves routing or classification
3. **Pass/fail gate** where a failed check really ends the analysis ("If the stock is not in Stage 2, stop here and tell the user")
4. **Exact code or commands** for anything that must be computed or called precisely — put arithmetic in code rather than asking the model to estimate it
5. **Criteria and heuristics** for the judgment the step requires, with the reasons — what makes a range "wide", which signals matter for this kind of company
6. **Reference pointer** for deep content: "Read `references/X.md` for details."

Inside a step, describe the outcome rather than choreographing how to reach it. "Pick the few things the market will focus on in this print — revenue growth direction, margin trend, line items that moved sharply" leaves the model room to judge; "Step 3a: compute X. Step 3b: compare Y..." for judgment work does not.

## Writing Parameter Defaults

Give every parameter an explicit default so the skill works with partial input:

```markdown
| Parameter | Default if not provided | Rationale |
|---|---|---|
| Lookback period | 1y | Balances recency and statistical significance |
| Ticker | SPY | Most liquid, universally recognized |
| Risk per trade | 1% | Standard conservative sizing |
```

## Writing the Final Step: Respond to the User

The last step states the **output contract** — what a good answer contains — rather than a fill-in-the-blanks template:

```markdown
## Step N: Respond to the User

Open with [the headline the user needs first — the verdict, the number, the date],
then cover [the content areas, and which ones need tables]. Close with [the synthesis
or verdict on its defined scale].

Include the caveats that apply: [data limitations], [required disclaimer].
```

- **Lead with the answer.** Say what the first line should deliver.
- **List required content, not required headings.** Say what must be covered and let the model shape sections to the evidence — including saying briefly when data for an area is missing.
- **Define verdict and grade scales exactly** when the skill is evaluative (Strong Buy Setup / Watch List / Pass).
- **Pin the format only where format matters** — scorecards, checklists, widgets, anything a user or downstream tool parses.
- **Describe length qualitatively.**

---

## Writing Reference Files

### Naming Convention
- `lowercase-hyphenated.md` (never camelCase or underscores)
- Topic-focused: `quantization.md`, `position-sizing.md`
- One file per concept-cluster, not per section

### Reference File Structure

```markdown
# [Topic Title]

[1-3 sentence introduction]

## [First Major Section]

### [Subsection]

[Tables, code blocks, formulas]

## Edge Cases

- [Specific condition] -> [How to handle]
```

Dated data (benchmark tables, market snapshots) belongs in a reference file with an explicit "as of" date, so the SKILL.md stays stable and the model knows how fresh the numbers are.

### Size Guidelines
- **Quick lookup** (API tables, checklists): 50-150 lines
- **Deep guide** (technique, methodology): 150-400 lines
- **Comprehensive catalog** (visual effects, all endpoints): 400-900 lines

### How SKILL.md Should Reference Them

Use table pointers in the relevant step, not scattered inline links:

```markdown
Read `references/position-sizing.md` for the full formula, examples, and pyramiding rules.
```

Or as a reference section at the end:

```markdown
## Reference Files

- `references/api.md` -- Complete API endpoint reference
- `references/troubleshooting.md` -- Common errors and solutions
```
