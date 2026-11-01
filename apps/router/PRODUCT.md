# Const Router

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product purpose

A shared API gateway for the model catalog in `src/lib/model-specs.ts`, with a developer console for credentials, usage, model comparison, prompt testing, routing combinations, and account preferences.

## Users and tasks

The developer audience is inferred from the repository's SDK examples and API workflows. Visitors compare models and rates, obtain a key through Const Accounts, configure an OpenAI-compatible client, and inspect requests, token allowance, and paid usage. The user explicitly requested improvements across landing, Overview, Playground, Models & pricing, Endpoints, Credits, Settings, and Docs.

## Capabilities and constraints

- Next.js App Router, React, Convex, Tailwind, and shared `@const/ui` primitives.
- Supported routes and contracts come from `src/lib/api-contract.ts` and actual `src/app/v1` handlers. Do not advertise unsupported API formats.
- The built-in catalog is the pricing source. Competitor prices and performance, uptime, or savings guarantees are not verified evidence.
- Free requests consume a weekly token allowance. Paid requests use credits. Token usage may be estimated when provider usage is absent; copy must reflect this.
- Authentication, billing, account preferences, and destructive actions retain their authorization boundaries.
- Playground is a current-session workspace. The user requested removal of saved chat history.

## Brand commitments

Keep the Const name/logo and black foundation. The user delegated other design choices. Preserve the existing desktop hero backdrop; mobile uses a distinct layout without it.

## Evidence

The repository supplies the catalog, API routes, quota/credit queries, billing contracts, and particle backdrop. No testimonials, health feed, or benchmark evidence is supplied.
