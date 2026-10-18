# Annotated Skill Examples

Real excerpts from the best skills in this repo, with annotations explaining why specific patterns work.

## Example 1: Intent-Category Description (sepa-strategy)

```yaml
description: >
  Analyze stocks with Mark Minervini's SEPA (Specific Entry Point Analysis) methodology:
  stage analysis, the 8-condition trend template, fundamentals, VCP and other base
  patterns, pivot-point entries, market environment, and risk-based position sizing.
  Use this skill whenever the user mentions SEPA, Minervini, superperformance, the
  trend template, VCP (volatility contraction pattern), Stage 2, pivot or breakout
  entries, moving-average stacking (price above the 50/150/200-day MAs), breakout
  volume, position sizing from risk percentage, growth-stock screening criteria, or
  bases such as cup-with-handle, flat base, bull flag, or high tight flag. Also use it
  when the user asks "should I buy this stock" or "is this a good setup" about a
  growth or momentum name, or shares a chart for pattern analysis.
```

**Why this works:**
- Opens with what the skill does, in the methodology's own terms
- Names the distinctive vocabulary a user would actually use (VCP, trend template, Stage 2, pivot) rather than ten phrasings of the same request
- Adds sideways entries ("should I buy this stock") scoped to the context where they belong, so they don't fire on every stock question
- Covers input modalities ("shares a chart")

---

## Example 2: Comprehensive Defaults Table (options-payoff)

```markdown
| Field | Where to find it | Default if missing |
|---|---|---|
| Strategy type | Title bar / leg description | "custom" |
| Underlying | Ticker symbol | SPX |
| Strike(s) | K1, K2, K3... in title or leg table | nearest round number |
| Premium paid/received | Filled price or avg price | 5.00 |
| Quantity | Position size | 1 |
| Multiplier | 100 for equity options, 100 for SPX | 100 |
| Expiry | Date in title | 30 DTE |
| Spot price | Current underlying price shown in the screenshot or text | live quote (see below); middle strike only if no quote is available |
| IV | Shown in greeks panel, or estimate from vega | 20% |
| Risk-free rate | — | 4.3% |
```

**Why this works:**
- Three columns: Field, Where to find it (extraction guidance), Default
- Covers every parameter — the skill never stalls
- Defaults are reasonable (SPX is the most common underlying, 30 DTE is standard)
- The one tricky field, spot, gets a resolution order (screenshot → live quote → middle strike, flagged) instead of a bare prohibition

---

## Example 3: Pass/Fail Gate (sepa-strategy, Step 2)

```markdown
## Step 2: Stage Analysis — Identify the Current Stage

| Stage | Characteristics | Action |
|---|---|---|
| **Stage 1** — Basing | Price near 200MA, MA flat/declining | Do nothing, wait |
| **Stage 2** — Advancing | Higher highs/lows, bullish MA alignment | **Only stage to buy** |
| **Stage 3** — Topping | Wide swings at highs, false breakouts | Reduce, no new positions |
| **Stage 4** — Declining | Below all MAs, bearish alignment | Full cash, stay away |

If the stock is NOT in Stage 2, stop here and tell the user. No further analysis needed.
```

**Why this works:**
- Clear classification table (4 options, each with characteristics and action)
- **Hard gate**: "stop here" — the methodology itself says no other stage is buyable, so further analysis would be wasted
- The gate is explicit, not a suggestion
- Saves tokens and produces more accurate results

---

## Example 4: Router Pattern (stock-correlation, Step 2)

```markdown
## Step 2: Route to the Correct Sub-Skill

| User Request | Route To | Examples |
|---|---|---|
| Single ticker, wants related stocks | **Sub-Skill A** | "what correlates with NVDA" |
| Two+ tickers, wants relationship | **Sub-Skill B** | "correlation between AMD and NVDA" |
| Group, wants structure/grouping | **Sub-Skill C** | "correlation matrix for FAANG" |
| Time-varying or conditional | **Sub-Skill D** | "rolling correlation AMD NVDA" |

If ambiguous, default to **Sub-Skill A** for single tickers, **Sub-Skill B** for two tickers.
```

**Why this works:**
- Routing table with concrete examples for each path
- Default behavior for ambiguous cases — the skill never stalls
- Each sub-skill is self-contained with its own sub-steps (A1, A2, A3)

---

## Example 5: Detection Flow with Decision Tree (github-auth)

```markdown
## Detection Flow

` ` `bash
git --version
gh --version 2>/dev/null || echo "gh not installed"
gh auth status 2>/dev/null || echo "gh not authenticated"
git config --global credential.helper 2>/dev/null || echo "no git credential helper"
` ` `

**Decision tree:**
1. If `gh auth status` shows authenticated → use `gh` for everything
2. If `gh` is installed but not authenticated → use "gh auth" method
3. If `gh` is not installed → use "git-only" method (no sudo needed)
```

**Why this works:**
- Detects 4 dimensions in one block: git, gh, gh auth, credential helper
- Decision tree has 3 clear paths — skill works for everyone
- Each path leads to a self-contained method section
- Checks first instead of assuming

---

## Example 5b: Dual-Method with Runtime Awareness (duckduckgo-search)

```markdown
## Detection Flow

` ` `bash
command -v ddgs >/dev/null && echo "DDGS_CLI=installed" || echo "DDGS_CLI=missing"
` ` `

Decision tree:
1. If `ddgs` CLI is installed → prefer `terminal` + `ddgs`
2. If `ddgs` CLI is missing → do not assume `execute_code` can import `ddgs`
3. If the user wants DuckDuckGo specifically → install `ddgs` first
4. Otherwise → fall back to built-in web/browser tools

**Important runtime note:**
- Terminal and `execute_code` are separate runtimes
- A successful shell install does not guarantee `execute_code` can import `ddgs`
```

**Why this works:**
- Explicitly warns about the terminal vs execute_code runtime boundary
- 4-level degradation chain: CLI → Python → install → built-in fallback
- `fallback_for_toolsets: [web]` in frontmatter auto-hides when web toolset is configured
- Combines frontmatter-level activation control with runtime-level method selection

---

## Example 6: Runtime Dependency Check with Algorithm Fallback (stock-correlation)

```markdown
## Step 1: Ensure Dependencies Are Available

**Current environment status:**

` ` `
!`python3 -c "exec('try:\n import yfinance, pandas, numpy\n print(f\'yfinance={yfinance.__version__} pandas={pandas.__version__} numpy={numpy.__version__}\')\nexcept Exception:\n print(\'DEPS_MISSING\')')"`
` ` `

If `DEPS_MISSING`, install required packages before running any code:

` ` `python
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "yfinance", "pandas", "numpy"])
` ` `

If all dependencies are already installed, skip the install step and proceed directly.
```

**Why this works:**
- Checks at runtime, not static instructions
- Reports actual versions (useful for debugging)
- Graceful fallback (`|| echo "DEPS_MISSING"`)
- Conditional action: only install if needed, skip otherwise
- Includes the exact install command — a fragile operation gets an exact script

---

## Example 7: Scorecard Output (sepa-strategy, Step 9)

```markdown
## Step 9: Respond to the User

Present a structured analysis report with these sections:

1. **Stock & Stage**: Ticker, current price, identified stage, base count
2. **Trend Template Scorecard**: 8-condition checklist with pass/fail and actual values
3. **Fundamental Grade**: A/B/C/D with EPS growth, acceleration, revenue, margins
4. **Pattern Identified**: Which pattern, key measurements
5. **Entry Assessment**: Pivot price, buy zone, breakout volume requirement
6. **Market Environment**: Current assessment and the risk per trade it implies
7. **Position Sizing**: Exact shares, stop price, targets, reward/risk ratio
8. **Overall Verdict**: Strong Buy Setup / Watch List / Pass

Always end with the disclaimer that this is educational analysis, not investment advice.
```

**Why this works:**
- A fixed structure fits here: the output is a methodology scorecard the user reads as a checklist, so consistency across runs is the point
- Each section names the data it carries
- Verdict system with 3 clear options (a decision, not a spectrum)
- Mirrors the step order, including environment before sizing
- Ends with the required disclaimer

For open-ended analysis, prefer an output contract instead (Example 10).

---

## Example 8: Reference File Pointer Pattern (sepa-strategy)

```markdown
## Reference Files

- `references/stage-analysis.md` — Four-stage theory, transition signals, base counting
- `references/trend-template.md` — Detailed 8-condition explanations and memory aids
- `references/fundamentals.md` — EPS, revenue, margins, institutional holdings, catalysts
- `references/patterns.md` — VCP 7 rules, cup-with-handle, flat base, flag, HTF
- `references/entry-rules.md` — Pivot point mechanics, buy zone, true vs false breakout
- `references/position-sizing.md` — Formula, stop loss evolution, pyramiding, loss handling
- `references/market-environment.md` — Bull/choppy/bear criteria and position adjustments
```

**Why this works:**
- Each reference file is listed with a one-line description
- Descriptions tell you what's in the file without opening it (saves tokens)
- Files are organized by concept-cluster, not by step
- 7 files is near the sweet spot for methodology-pattern skills

---

## Example 9: Edge Cases in Reference File (options-payoff, strategies.md)

```markdown
## Edge Cases

- **DTE = 0**: skip BS entirely, use intrinsic value only
- **IV = 0**: BS undefined (σ=0), use max(intrinsic, 0)
- **K1 > K2**: warn user, auto-sort strikes ascending
- **Negative theoretical value**: clip to 0 for display (arbitrage-free floor)
- **Calendar with IV skew**: use separate IV sliders for near vs far leg
```

**Why this works:**
- Specific conditions, not vague "handle errors"
- Each edge case has an exact resolution
- Placed in the reference file (not SKILL.md) to keep main instructions lean
- These are the cases that would cause bugs without explicit handling

---

## Example 10: Output Contract (earnings-preview, Steps 3-4)

```markdown
## Step 3: Build the Earnings Preview

The briefing should let the user see the setup at a glance. Cover these five areas;
if the data for one is missing, say so in a line rather than dropping it.

1. **Date and context** — company, ticker, sector and industry; the report date and
   whether it lands before the open or after the close; current price with 1-week
   and 1-month performance; market cap.
2. **Consensus estimates** — a table of this quarter's EPS and revenue consensus with
   low, high, analyst count, year-ago value, and expected growth. A high/low spread
   wider than about 20% of consensus signals unusual uncertainty; say so when you see it.
3. **Beat/miss track record** — ...
4. **Analyst sentiment** — ...
5. **What to watch** — the few things the market will focus on in this print, chosen
   for this company and sector ... This is the judgment part of the briefing.

## Step 4: Respond to the User

Open with the headline — the report date and a one-line read of the setup — then the
five areas above, using tables where they help. Close with a short read of the overall
setup, framed as what the street expects rather than a recommendation.
```

**Why this works:**
- Says what must be covered, not which headings to fill; missing data gets a line instead of a silent gap
- Carries the domain heuristic with its threshold (spread wider than ~20% of consensus)
- Marks the one judgment section and leaves the choice of what matters to the model
- Leads with the headline and describes length qualitatively ("a short read")
- Contains no invented figures for a real company for the model to copy

---

## Anti-Example: Vague Output (avoid this)

```markdown
## Respond to the User

Summarize the analysis results in a clear and readable format.
Include relevant metrics and insights.
```

**Why this fails:**
- Doesn't say what to lead with or which metrics matter for this skill
- No required caveats, so data limitations go unmentioned
- No verdict → user must interpret everything themselves

---

## Anti-Example: The Scripted, Shouting Step (avoid this)

```markdown
## Step 4: Respond to the User

IMPORTANT: You MUST show all 5 sections. Think step by step and double-check every number.

1. Lead with: "AAPL reports earnings on [date]. Here's what to expect."
2. Show all 5 sections with headers and tables
3. End with a 2-3 sentence summary

Example: "AAPL has beaten EPS estimates in 4 of the last 4 quarters by an average of 2.6%."
```

**Why this fails on current models:**
- Capitalized MUST/IMPORTANT and "double-check" lead to over-checking and rigid, padded output
- "Think step by step" is redundant with built-in thinking
- The sentence count caps the synthesis regardless of how much the data says
- The worked example carries invented figures for a real company, which the model copies in shape and can mistake for fact
