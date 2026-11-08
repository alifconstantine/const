# Router pricing audit · 8 November 2026

The [AtmoRouter catalog snapshot](https://atmorouter.dev/api/dashboard/catalog) at 15:12 WIB included all 21 chat IDs mapped by Const Engine. Each had at least one offer at least 50% below the catalog’s official input and output rates. The audit uses the 50% minimum discount supplied by the operator. The public catalog cannot verify the account or API-key budgets used by Const Engine.

## Claude Opus 5.5

The new Const catalog sets **$0.60 input, $0.060 cached input, and $3.00 output** per million tokens. Anthropic lists standard input and output at $4 and $20, respectively. [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)

For the exact Claude Code upstream ID, `cc/claude-opus-5-5`, the lowest tier was $0.29 input and $1.45 output with one offer. The two largest tiers within the proposed cap were $0.58 / $2.90 with 32 offers and $0.59 / $2.95 with 13 offers. The 50% account rule alone allows up to $2 / $10. The proposed $0.59 / $2.95 cap leaves $0.01 input and $0.05 output per million tokens at the highest accepted tier, before per-request minimums and other costs.

## Per-model rates and proposed upstream caps

All pairs are input / output in USD per million tokens. The offer column counts offers within the proposed cap compared with all offers eligible under the 50% rule in the snapshot. Offer counts describe listings and can change as capacity shifts.

| AtmoRouter model ID | Const fixed rates | Lowest eligible Atmo tier | Proposed Atmo cap | Offers within cap / eligible |
| --- | ---: | ---: | ---: | ---: |
| `ali/deepseek-v4.1-flash` | $0.06 / $0.24 | $0.03675 / $0.147 | $0.05 / $0.20 | 6,422 / 6,422 |
| `cbcn/glm-5.3-flash` | $0.05 / $0.17 | $0.004875 / $0.01625 | $0.045 / $0.15 | 1,784 / 2,447 |
| `cbcn/minimax-m3.1-flash` | $0.06 / $0.24 | $0.0075 / $0.03 | $0.055 / $0.22 | 1,734 / 2,320 |
| `ali/qwen3.8-27b` | $0.15 / $0.90 | $0.00875 / $0.0525 | $0.135 / $0.81 | 21,685 / 29,915 |
| `ag/gemini-3.8-flash-high` | $0.15 / $0.75 | $0.001875 / $0.009375 | $0.135 / $0.675 | 759 / 868 |
| `cc/claude-haiku-5-5` | $0.04 / $0.20 | $0.0125 / $0.0625 | $0.0375 / $0.1875 | 25 / 28 |
| `cx/gpt-6-luna` | $0.06 / $0.30 | $0.0025 / $0.0125 | $0.05 / $0.25 | 4 / 4 |
| `ali/deepseek-v4-pro-0813` | $0.20 / $0.60 | $0.00165 / $0.00495 | $0.19 / $0.57 | 20,377 / 20,377 |
| `ali/qwen3.8-max-0902` | $0.35 / $1.05 | $0.005 / $0.015 | $0.32 / $0.96 | 18,162 / 18,298 |
| `ali/qwen3.8-2.4t-a95b` | $0.32 / $0.96 | $0.04 / $0.12 | $0.30 / $0.90 | 24,592 / 31,194 |
| `ali/glm-5.3` | $0.40 / $1.25 | $0.028 / $0.088 | $0.375 / $1.18 | 16,992 / 16,997 |
| `cbcn/kimi-k3.1-pro` | $0.65 / $3.25 | $0.10 / $0.50 | $0.59 / $2.95 | 1,537 / 2,199 |
| `cbcn/kimi-k3` | $0.65 / $3.25 | $0.1575 / $0.7875 | $0.60 / $3.00 | 1,721 / 2,438 |
| `ag/gemini-4-argon` | $0.75 / $4.50 | $0.005 / $0.03 | $0.675 / $4.05 | 101 / 126 |
| `cc/claude-sonnet-5-5` | $0.50 / $2.50 | $0.145 / $0.725 | $0.45 / $2.25 | 45 / 50 |
| `cc/claude-opus-5-5` | $0.60 / $3.00 | $0.29 / $1.45 | $0.59 / $2.95 | 47 / 79 |
| `cc/claude-fable-5-1` | $2.50 / $12.50 | $1.675 / $8.375 | $2.25 / $11.25 | 28 / 42 |
| `cx/gpt-6.1-terra` | $0.30 / $1.50 | $0.2475 / $1.2375 | $0.27 / $1.35 | 5 / 5 |
| `cx/gpt-6.1-sol` | $0.60 / $3.00 | $0.495 / $2.475 | $0.55 / $2.75 | 5 / 5 |
| `cx/gpt-6-astra` | $2.75 / $13.75 | $2.475 / $12.375 | $2.50 / $12.50 | 5 / 5 |
| `grok/grok-4.7` | $0.55 / $1.65 | $0.095 / $0.285 | $0.50 / $1.50 | 20 / 25 |

## Routing and margin

- The public pricing comparison uses Google's published Gemini 4 Argon launch rate of $2 / $10 through 30 November. The upstream audit uses AtmoRouter's $2 / $12 reference to evaluate its budget rules. [Google Cloud pricing announcement](https://cloud.google.com/blog/products/ai-machine-learning/gemini-4-argon-available-on-google-cloud)
- **15 of 21 models** had at least one observed tier above the new Const rate on one or both token types despite qualifying for the 50% rule. Use the exact caps on the AtmoRouter key that Const Engine uses. Model caps and the 50% rule intersect, and AtmoRouter may refuse a request if no offer qualifies. [AtmoRouter Budgets](https://atmorouter.dev/docs/budgets)
- AtmoRouter can apply a per-request minimum and bills at the selected tier. Compare settled upstream cost with Const's ledger before relying on the gross spread, especially for short or heavily cached requests. No paid inference was used for this audit. [AtmoRouter billing](https://atmorouter.dev/docs/billing)
- APInex advertises flat input and output rates of $0.50 for Claude Opus 5.5, $0.40 for Claude Sonnet 5.5, and $0.07 for DeepSeek V4 Pro. Throughput, billed cost, and Engine compatibility need separate verification before routing traffic. [Opus](https://apinex.bond/models/claude-opus-5-5) · [Sonnet](https://apinex.bond/models/claude-sonnet-5-5) · [DeepSeek](https://apinex.bond/models/deepseek-v4-pro)
- Release the Router app and Convex gateway with the same catalog revision. Convex settles pending requests using the prices stored at reservation time.
