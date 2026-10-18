---
name: gemini-infographic
description: >
  Generate hand-drawn whiteboard, notebook, and visual infographic prompts from source materials. Takes source content (a post, newsletter, blog, research note, lecture) and produces an infographic brief and high-impact image generation prompt. Use whenever the user asks for a "whiteboard infographic", "gemini infographic", "hand-drawn graphic", or wants an AI-generated infographic for study notes or social posts.
---

# Gemini Infographic

Turn dense source content (notes, articles, transcripts, documentation) into a visual hand-drawn whiteboard or structured infographic prompt.

## Core Capabilities
1. **Content Distillation**: Extracts key ideas, core hierarchy, metrics, and actionable takeaways from source material.
2. **Visual Layout Planning**: Organizes concepts into logical layouts (steps, comparison, framework, concentric cycles, or metric cards).
3. **Prompt Engineering**: Formulates optimized visual prompts for Gemini, Flux, SDXL, and OpenAI image generators with detailed composition, lighting, typography, and texture instructions.

## Step 1. Ingest Source Content
Identify or ask for the source text:
- Research papers, study notes, blog posts, transcripts, or bullet points.

## Step 2. Build the Infographic Brief
Structure the brief in plain language:
- **Title**: Punchy, maximum 6 words.
- **Subtitle**: 1 line of context or learning objective.
- **Core Structure**: Choose between:
  - *Process / Timeline*: Horizontal or vertical steps with numbered arrow connectors.
  - *Comparison*: Side-by-side contrasting columns or balance scale.
  - *Framework / Bento*: Grid of 3–6 distinct conceptual cards with icons.
  - *Stats & Metrics*: Big bold numbers with explanatory labels.
  - *Concentric / Mind Map*: Central core concept radiating to sub-nodes.
- **Key Points**: 3 to 7 concise bullets (under 10 words each) capturing essential takeaways without information loss.
- **Visual Design Elements**: Callouts, boxes, arrows, color coding (e.g. blue for primary, emerald for benefits, rose for cautions, yellow highlighter accents).

## Step 3. Generate the Image Prompt
Output the prompt formatted for image generation:

```text
Generate a single image of an infographic on a clean surface:
Style & Medium: Hand-drawn physical marker sketch on a clean whiteboard / textured notebook page.
Texture: Real ink strokes with subtle, natural imperfections, colored felt-tip markers (navy, turquoise, forest green, warm coral) and translucent pastel highlighters.
Typography: Clean, legible hand-lettered headings and clear printed notes. No messy illegible cursive.
Layout & Content:
- Header: [TITLE] - [SUBTITLE]
- Structure: [SELECTED STRUCTURE]
- Key Insights: [POINTS & ICONS]
- Highlights: Visual callout boxes, directional sketch arrows, and annotated numbers.
Lighting: Soft natural studio daylight, subtle shadow depth, sharp 8k resolution.
```

## Step 4. Tailor for Const Learn
When creating infographics within Const Learn:
- Align with the chosen visual style (Auto, Kawaii, Clay, Sketch Notes, Anime, Editorial, Vector, 3D Photorealistic, Retro Comic).
- Respect the chosen canvas orientation (`landscape` 1792×1024, `portrait` 1024×1792, `square` 1024×1024).
- Ensure output prompts remain in English for maximum image model fidelity.
