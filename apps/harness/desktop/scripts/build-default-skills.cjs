const fs = require('fs');
const path = require('path');

const skillsDir = path.resolve(__dirname, '../skills');
const catalogFile = path.resolve(__dirname, '../src/lib/skills/skills-catalog.ts');
const defaultSkillsFile = path.resolve(__dirname, '../src/lib/skills/default-skills.ts');

if (!fs.existsSync(skillsDir)) {
  console.error('Skills directory not found:', skillsDir);
  process.exit(1);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const rawMeta = match[1];
  const body = match[2];

  const meta = {};
  const lines = rawMeta.split(/\r?\n/);
  let currentKey = null;
  let multilineVal = [];

  for (const line of lines) {
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (keyMatch) {
      if (currentKey) {
        meta[currentKey] = multilineVal.join(' ').trim();
      }
      currentKey = keyMatch[1].toLowerCase();
      const val = keyMatch[2].trim();
      if (val === '>' || val === '|' || val === '>-' || val === '|-') {
        multilineVal = [];
      } else {
        multilineVal = [val.replace(/^['"]|['"]$/g, '')];
      }
    } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      multilineVal.push(line.trim().replace(/^['"]|['"]$/g, ''));
    }
  }
  if (currentKey) {
    meta[currentKey] = multilineVal.join(' ').trim();
  }
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
    s.startsWith('mattpocock')
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
      'slideshow',
      'general-video',
      'pr-to-video',
      'product-launch-video',
      'motion-graphics',
      'talking-head-recut',
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

function getCategory(slug) {
  const s = slug.toLowerCase();
  if (['agent-browser', 'browser-use', 'remote-browser'].includes(s)) return 'browser_automation';
  if (['frontend-design', 'brand-guidelines', 'ui-taste', 'ios-design', 'generative-ui', 'figma'].includes(s)) return 'design';
  if (['docx', 'pdf', 'pptx', 'xlsx', 'canvas-design'].includes(s)) return 'document';
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
      'tradingview-mcp',
      'tradingview-reader',
    ].includes(s)
  ) return 'finance';
  if (
    s.includes('hyperframes') ||
    [
      'slideshow',
      'general-video',
      'pr-to-video',
      'product-launch-video',
      'motion-graphics',
      'talking-head-recut',
      'music-to-video',
      'embedded-captions',
      'faceless-explainer',
      'remotion-to-hyperframes',
    ].includes(s) ||
    s.includes('manim')
  ) return 'motion_video';
  if (['tiktok-scraper', 'instagram-scraper', 'x-scraper', 'discord-reader', 'linkedin-reader', 'twitter-reader', 'telegram-reader', 'yc-reader', 'opencli-reader', 'literature-search-arxiv'].includes(s)) return 'scraping_research';
  if (['tdd', 'grill-me', 'grill-with-docs', 'grilling', 'skill-creator', 'no-ai-slop'].includes(s)) return 'coding_dev';
  return 'agent_workflow';
}

const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
dirs.sort((a, b) => a.name.localeCompare(b.name));

function listRelativeFiles(dir, prefix = '') {
  const result = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          result.push(...listRelativeFiles(full, rel));
        }
      } else if (entry.isFile()) {
        result.push(rel);
      }
    }
  } catch {}
  return result;
}

// 1. Build catalog and manifest
const catalog = [];
for (const dir of dirs) {
  const slug = dir.name;
  const p = path.join(skillsDir, slug, 'SKILL.md');
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  const { meta } = parseFrontmatter(content);

  const cleanDescription = (meta.description || '').replace(/\s+/g, ' ').trim();
  const author = getAuthorForSkill(slug, meta.author);
  const category = getCategory(slug);
  const relativeFiles = listRelativeFiles(path.join(skillsDir, slug));

  catalog.push({
    id: `skill_${slug}`,
    slug: slug,
    name: meta.name || slug,
    description: cleanDescription,
    category: category,
    author: author,
    version: meta.version || '1.0.0',
    icon: 'Sparkles',
    files: relativeFiles.length > 0 ? relativeFiles : ['SKILL.md'],
  });
}

const manifestData = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  count: catalog.length,
  skills: catalog,
};

const manifestPath1 = path.resolve(__dirname, '../skills/index.json');
const manifestPath2 = path.resolve(__dirname, '../src/lib/skills/skills-manifest.json');
fs.writeFileSync(manifestPath1, JSON.stringify(manifestData, null, 2), 'utf8');
fs.writeFileSync(manifestPath2, JSON.stringify(manifestData, null, 2), 'utf8');
console.log(`Generated skills/index.json and skills-manifest.json with ${catalog.length} skills.`);

const catalogCode = `import type { SkillCategory } from "./types";

export interface MarketplaceSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: SkillCategory;
  author: string;
  version: string;
  icon?: string;
  overview?: string;
  files?: string[];
  installs?: number;
  source?: string;
}

export const MARKETPLACE_CATALOG: MarketplaceSkill[] = ${JSON.stringify(catalog, null, 2)};
`;

fs.writeFileSync(catalogFile, catalogCode, 'utf8');
console.log(`Generated skills-catalog.ts with ${catalog.length} skills.`);

// 2. Build default-skills.ts with pre-installed docx, pdf, pptx
const defaultSlugs = []; // Skills are installed explicitly by the user.
const defaultSkills = [];

for (const slug of defaultSlugs) {
  const dir = path.join(skillsDir, slug);
  const skillMdPath = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) continue;
  const content = fs.readFileSync(skillMdPath, 'utf8');
  const { meta } = parseFrontmatter(content);

  const files = {};
  function readDir(cur, prefix = '') {
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      const rel = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== 'schemas' && entry.name !== 'node_modules') {
          readDir(full, rel);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.md', '.txt', '.json', '.py', '.js'].includes(ext) && fs.statSync(full).size < 30000) {
          files[rel] = fs.readFileSync(full, 'utf8');
        }
      }
    }
  }
  readDir(dir);
  files['SKILL.md'] = content;

  defaultSkills.push({
    id: `skill_${slug}`,
    slug: slug,
    name: meta.name || slug,
    description: (meta.description || '').replace(/\s+/g, ' ').trim(),
    content: content,
    icon: 'FileText',
    category: 'document',
    isBuiltIn: false,
    isEnabled: true,
    scope: 'user',
    author: 'Anthropic',
    version: meta.version || '1.0.0',
    files: files,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

const defaultSkillsCode = `import type { LocalSkill } from "./types";

/**
 * Optional bundled defaults. Skills are installed explicitly by the user.
 */
export const DEFAULT_INSTALLED_SKILLS: LocalSkill[] = ${JSON.stringify(defaultSkills, null, 2)};

export const DEFAULT_SKILLS: LocalSkill[] = DEFAULT_INSTALLED_SKILLS;
`;

fs.writeFileSync(defaultSkillsFile, defaultSkillsCode, 'utf8');
console.log(`Generated default-skills.ts with ${defaultSkills.length} pre-installed skills.`);
