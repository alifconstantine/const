# Architecture Patterns for Skills

Choosing the right structural pattern is the most impactful decision in skill design. The wrong pattern creates friction; the right one makes the skill feel natural.

## Linear Pattern

**When to use:** The skill has a single workflow with no branching. User provides input, skill processes it sequentially, skill returns output.

**Structure:** A few numbered steps, executed in order.

**Example:** `earnings-preview`
```
Step 1: Check yfinance
Step 2: Fetch earnings, estimate, and sentiment data
Step 3: Build the preview (five content areas, one of them judgment)
Step 4: Respond with the briefing
```

**Strengths:** Simple to follow, easy to debug, low token cost.
**Weaknesses:** Cannot handle diverse user intents within the same domain.

**Design rules:**
- Each step should produce a concrete intermediate result
- Include an early exit if prerequisites fail (Step 1)
- Keep the total under about 7 steps; if you need more, consider Router or Methodology

---

## Router Pattern

**When to use:** The skill covers multiple related sub-tasks. The user's intent determines which path to take.

**Structure:** Step 1 (setup) + Step 2 (route) + Sub-Skill sections + Final step (respond).

**Example:** `stock-correlation`
```
Step 1: Check dependencies
Step 2: Route based on intent
  - Single ticker → Sub-Skill A: Co-movement Discovery
  - Two tickers → Sub-Skill B: Return Correlation
  - Group → Sub-Skill C: Sector Clustering
  - Time-varying → Sub-Skill D: Realized Correlation
Step 3: Respond to user
```

**Strengths:** Handles diverse intents cleanly, each sub-path stays focused.
**Weaknesses:** More complex to write, routing table must be exhaustive.

**Design rules:**
- Give the routing table a default for ambiguous requests
- Each sub-skill should be self-contained (A1, A2, A3 sub-steps)
- Shared defaults go in Step 1, sub-skill-specific defaults go in each sub-skill
- Limit to 4-6 sub-skills; more means the skill should be split into separate skills

---

## Methodology Pattern

**When to use:** The skill implements a known framework or methodology with sequential validation gates. Each step builds on the previous one, and failure at a real gate stops the analysis.

**Structure:** Ordered checks, each with the methodology's own pass/fail criteria or grade.

**Example:** `sepa-strategy`
```
Step 1: Gather stock data (computed in code)
Step 2: Stage analysis (STOP if not Stage 2)
Step 3: Trend template — 8 conditions (STOP if any fail)
Step 4: Fundamental check (grade A/B/C/D)
Step 5: Pattern recognition (VCP, cup-handle, etc.)
Step 6: Entry point analysis
Step 7: Market environment check (sets risk per trade)
Step 8: Position sizing & stop loss
Step 9: Respond with structured report
```

**Strengths:** Thorough, educational, produces high-quality analysis, prevents premature conclusions.
**Weaknesses:** Highest token cost, requires deep domain knowledge to write.

**Design rules:**
- Put a gate or grade wherever the methodology really has one, and order steps by their dependencies (the environment sets risk per trade, so it comes before sizing)
- A failed gate stops the analysis with a clear message ("Not Stage 2 — no further analysis needed")
- Use tables for checklists and criteria (the 8-condition trend template is the gold standard)
- Defer detailed criteria to reference files; SKILL.md shows the checklist, the reference shows the rubric
- End with a verdict system (Strong Buy Setup / Watch List / Pass)
- A scorecard-style methodology can mirror its step structure in the output; that fixed format earns its place because the user reads it as a checklist

---

## Widget Pattern

**When to use:** The skill generates an interactive HTML/SVG widget as output.

**Structure:** 4-5 steps: extract parameters → identify type → compute → render → explain.

**Example:** `options-payoff`
```
Step 1: Extract strategy from user input (with comprehensive defaults table)
Step 2: Identify strategy type (lookup matrix)
Step 3: Compute payoffs (mathematical formulas)
Step 4: Render the widget (UI spec + code template)
Step 5: Respond with brief explanation
```

**Strengths:** Produces tangible, interactive output.
**Weaknesses:** Requires detailed code templates, hard to test without rendering.

**Design rules:**
- Step 1 needs a defaults table covering every parameter, so the skill never stalls asking for info
- The extraction step needs "Where to find it" guidance for each field
- Include a code template skeleton in SKILL.md (not full implementation — that goes in references)
- The render step specifies controls, stats cards, chart axes, colors, and tooltips — a widget is format-sensitive, so exact specs belong here
- Keep the final step short — the chart speaks for itself

---

## API Wrapper Pattern

**When to use:** The skill wraps an external API with many endpoints. The user's request maps to one or more API calls.

**Structure:** Auth and lookup steps + an endpoint map + heavy reference files.

**Example:** `fintel-data`
```
Step 1: Resolve the API key (env var, local .env, repo-root .env)
Step 2: Resolve the security (ticker, CUSIP, ISIN, FIGI)
Step 3: Match the request to an endpoint (routing table)
Step 4: Call the API and handle errors
Step 5: MCP alternative
Step 6: Respond to user
```

**Strengths:** Comprehensive API coverage, reference files serve as living documentation.
**Weaknesses:** The routing table can become unwieldy, reference files need maintenance.

**Design rules:**
- The routing table in SKILL.md should be a high-level category map, not every endpoint
- Each reference file covers one endpoint category (market-data, fundamentals, options, etc.)
- Reference files should include: endpoint URL, parameters, example curl/code, response format
- Cover the common mechanics (pagination, rate limits, error codes, metered usage) in one place
- API keys should use `required_environment_variables` in frontmatter, not inline instructions

---

## Choosing Between Patterns

| Signal | Recommended Pattern |
|---|---|
| "Fetch X data and show it" | Linear |
| "It depends on what the user asks" | Router |
| "There's a formal framework with criteria" | Methodology |
| "Generate a chart/widget/visualization" | Widget |
| "Wrap this API's 20+ endpoints" | API Wrapper |
| Multiple signals | Combine: Router with Linear sub-skills, Methodology with Widget output |

## Anti-Patterns to Avoid

### The Wall of Text
A single massive step with 50+ lines of undifferentiated instructions. **Fix:** Split into steps with clear boundaries, and move reference material to `references/`.

### The Script for Judgment
Analysis or writing choreographed as "Step 3a: compute X. Step 3b: compare Y. Step 3c: write two sentences about Z." Current models plan this kind of work better than a hand-written script, and the script boxes them in. **Fix:** State the goal, the criteria, and the domain heuristics; keep numbered steps for work whose order really matters.

### The Shouting Skill
Capitalized MUST / NEVER / CRITICAL on several lines, repeated warnings, "double-check your answer". Current models over-apply this register and turn cautious. **Fix:** State each real constraint once, plainly, with its reason; delete instructions the model follows by default.

### The Gold Output
A single worked example — often with invented figures for a real company — that the model copies in length, structure, and phrasing. **Fix:** Describe what the output must contain; label any example as illustrative and keep it free of fabricated real-world numbers.

### The Synonym-List Description
A description that grows one quoted phrasing per missed trigger. **Fix:** Name the categories of intent and the distinctive vocabulary; point to sibling skills for neighboring requests.

### The Premature Reference
Linking to a reference file for 3 lines of content. **Fix:** Keep short content inline; references are for 50+ lines of depth.

### The Missing Exit Gate
A methodology that keeps analyzing after a disqualifying check fails. **Fix:** Add "If X fails, stop here and tell the user" at each point where failure really ends the analysis.

### The Vague Output
"Summarize the results for the user." **Fix:** State an output contract — what to lead with, what must be covered, which caveats apply, and the verdict scale if the skill is evaluative.

### The Hardcoded Universe
Static ticker lists or data that will go stale. **Fix:** Build universes dynamically at runtime using screening APIs, and date-stamp any snapshot data kept in references.
