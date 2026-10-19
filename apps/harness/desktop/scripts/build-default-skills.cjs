const fs = require('fs');
const path = require('path');

const skillsDir = path.resolve(__dirname, '../skills');
const outputFile = path.resolve(__dirname, '../src/lib/skills/default-skills.ts');

if (!fs.existsSync(skillsDir)) {
  console.error('Skills directory not found:', skillsDir);
  process.exit(1);
}

const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const rawMeta = match[1];
  const body = match[2];
  const meta = {};
  rawMeta.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (m) {
      meta[m[1].toLowerCase()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  });
  return { meta, body };
}

function getAuthorForSkill(slug, metaAuthor) {
  if (metaAuthor && metaAuthor !== 'Const Platform' && metaAuthor !== 'Const') {
    return metaAuthor;
  }
  const s = slug.toLowerCase();
  if (
    s.startsWith('anthropic') ||
    ['frontend-design', 'brand-guidelines', 'skill-creator', 'docx', 'pdf', 'pptx', 'xlsx', 'canvas-design'].includes(s)
  ) {
    return 'Anthropic';
  }
  if (
    s === 'grill-me' ||
    s === 'grill-with-docs' ||
    s === 'grilling' ||
    s === 'tdd' ||
    s.startsWith('mattpocock') ||
    ['grilling', 'loop-me'].includes(s)
  ) {
    return 'Matt Pocock';
  }
  if (s === 'ui-taste' || s === 'ios-design') {
    return 'Uizze';
  }
  if (s === 'no-ai-slop') {
    return 'Peter Yang';
  }
  if (s.includes('manim')) {
    return 'Adithya S K';
  }
  if (
    s.includes('hyperframes') ||
    [
      'motion-graphics',
      'general-video',
      'slideshow',
      'media-use',
      'figma',
      'talking-head-recut',
      'pr-to-video',
      'product-launch-video',
      'music-to-video',
      'embedded-captions',
      'faceless-explainer',
      'remotion-to-hyperframes',
    ].includes(s)
  ) {
    return 'HyperFrames';
  }
  if (s.includes('scraper') || ['tiktok-scraper', 'instagram-scraper', 'x-scraper'].includes(s)) {
    return 'ApiDojo';
  }
  if (s.includes('arxiv')) {
    return 'Google DeepMind';
  }
  if (s.includes('browser-use') || s.includes('remote-browser')) {
    return 'Browser Use';
  }
  if (s === 'agent-browser') {
    return 'Vercel Labs';
  }
  if (s === 'composio') {
    return 'Composio';
  }
  if (
    [
      'company-valuation',
      'yfinance-data',
      'stock-correlation',
      'stock-liquidity',
      'options-payoff',
      'sepa-strategy',
      'startup-analysis',
      'saas-valuation-compression',
      'earnings-preview',
      'earnings-recap',
      'estimate-analysis',
      'etf-premium',
      'fintel-data',
      'finance-sentiment',
      'hormuz-strait',
      'hyperliquid-reader',
    ].includes(s)
  ) {
    return 'Himself65';
  }
  if (
    [
      'discord-reader',
      'linkedin-reader',
      'twitter-reader',
      'telegram-reader',
      'yc-reader',
      'opencli-reader',
      'tradingview-reader',
      'tradingview-mcp',
    ].includes(s)
  ) {
    return 'OpenCLI';
  }
  if (s.includes('gemini')) {
    return 'Google';
  }
  if (s === 'generative-ui') {
    return 'Vercel';
  }
  return 'skills.sh';
}

const skills = [];
const seenSlugs = new Set();

dirs.sort((a, b) => a.name.localeCompare(b.name));

dirs.forEach((dir) => {
  // Exclude convex skills completely
  if (dir.name.toLowerCase().startsWith('convex')) {
    return;
  }

  // Deduplicate
  const cleanSlug = dir.name.toLowerCase().trim();
  if (seenSlugs.has(cleanSlug)) {
    return;
  }

  const dirPath = path.join(skillsDir, dir.name);
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) return;
  const content = fs.readFileSync(skillMdPath, 'utf8');
  const { meta } = parseFrontmatter(content);

  seenSlugs.add(cleanSlug);

  const slug = dir.name;
  const name = meta.name || dir.name;
  const description = (meta.description || 'Agent skill from skills.sh').replace(/\s+/g, ' ').trim();
  const author = getAuthorForSkill(slug, meta.author);

  // Read all text files in directory
  const files = {};
  function readDirRecursive(currentDir, prefix = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          readDirRecursive(fullPath, relPath);
        }
      } else if (entry.isFile()) {
        try {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.md', '.txt', '.json', '.yaml', '.yml', '.ts', '.js', '.py'].includes(ext)) {
            const stat = fs.statSync(fullPath);
            if (stat.size < 150000) {
              files[relPath] = fs.readFileSync(fullPath, 'utf8');
            }
          }
        } catch (e) {}
      }
    }
  }

  try {
    readDirRecursive(dirPath);
  } catch (e) {}

  if (!files['SKILL.md']) {
    files['SKILL.md'] = content;
  }

  skills.push({
    id: 'skill_' + dir.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
    slug: dir.name,
    name: name,
    description: "",
    content: content,
    icon: 'PencilSparkles',
    category: 'custom',
    isBuiltIn: true,
    isEnabled: true,
    scope: 'user',
    author: author,
    version: meta.version || '1.0.0',
    files: files,
    createdAt: 1727222400000,
    updatedAt: 1727222400000,
  });
});

console.log(`Found and parsed ${skills.length} real skills from skills.sh (Convex excluded, zero duplicates).`);

const tsContent = `// Auto-generated real skills from skills.sh (Open Standard, zero duplicates, Convex removed)
import type { LocalSkill, LocalSkillBundle } from "./types";

export const DEFAULT_BUILTIN_BUNDLES: LocalSkillBundle[] = [];

export const DEFAULT_BUILTIN_SKILLS: LocalSkill[] = ${JSON.stringify(skills, null, 2)};

export const DEFAULT_SKILLS = DEFAULT_BUILTIN_SKILLS;
export const DEFAULT_SKILL_BUNDLES = DEFAULT_BUILTIN_BUNDLES;
`;

fs.writeFileSync(outputFile, tsContent, 'utf8');
console.log(`Successfully written ${skills.length} skills to ${outputFile}`);
