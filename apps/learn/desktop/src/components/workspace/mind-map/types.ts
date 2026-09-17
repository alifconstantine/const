export interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  children?: MindMapNode[];
}

export interface MindMapData {
  id: string;
  learnId?: string;
  title: string;
  root: MindMapNode;
  sourceIds?: string[];
  sourceCount?: number;
  sourceNames?: string[];
  prompt?: string;
  feedback?: "good" | "bad";
  createdAt: number;
  updatedAt: number;
}

export interface BranchTheme {
  name: string;
  borderHex: string;
  bgHex: string;
  curveHex: string;
  badgeBgHex: string;
  badgeTextHex: string;
  textHex: string;
}

export const BRANCH_THEMES: BranchTheme[] = [
  {
    name: "Sky",
    borderHex: "#0284c7",
    bgHex: "rgba(2, 132, 199, 0.08)",
    curveHex: "#38bdf8",
    badgeBgHex: "rgba(2, 132, 199, 0.15)",
    badgeTextHex: "#0284c7",
    textHex: "#0369a1",
  },
  {
    name: "Emerald",
    borderHex: "#059669",
    bgHex: "rgba(5, 150, 105, 0.08)",
    curveHex: "#34d399",
    badgeBgHex: "rgba(5, 150, 105, 0.15)",
    badgeTextHex: "#059669",
    textHex: "#047857",
  },
  {
    name: "Amber",
    borderHex: "#d97706",
    bgHex: "rgba(217, 119, 6, 0.08)",
    curveHex: "#fbbf24",
    badgeBgHex: "rgba(217, 119, 6, 0.15)",
    badgeTextHex: "#d97706",
    textHex: "#b45309",
  },
  {
    name: "Rose",
    borderHex: "#e11d48",
    bgHex: "rgba(225, 29, 72, 0.08)",
    curveHex: "#fb7185",
    badgeBgHex: "rgba(225, 29, 72, 0.15)",
    badgeTextHex: "#e11d48",
    textHex: "#be123c",
  },
  {
    name: "Violet",
    borderHex: "#7c3aed",
    bgHex: "rgba(124, 58, 237, 0.08)",
    curveHex: "#a78bfa",
    badgeBgHex: "rgba(124, 58, 237, 0.15)",
    badgeTextHex: "#7c3aed",
    textHex: "#6d28d9",
  },
  {
    name: "Cyan",
    borderHex: "#0891b2",
    bgHex: "rgba(8, 145, 178, 0.08)",
    curveHex: "#22d3ee",
    badgeBgHex: "rgba(8, 145, 178, 0.15)",
    badgeTextHex: "#0891b2",
    textHex: "#0e7490",
  },
];

export const ROOT_THEME: BranchTheme = {
  name: "Primary",
  borderHex: "#3b82f6",
  bgHex: "rgba(59, 130, 246, 0.12)",
  curveHex: "#60a5fa",
  badgeBgHex: "rgba(59, 130, 246, 0.2)",
  badgeTextHex: "#2563eb",
  textHex: "#1d4ed8",
};

export interface PositionedNode {
  node: MindMapNode;
  id: string;
  label: string;
  lines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  isRoot: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  branchIndex: number;
  branchTheme: BranchTheme;
  parent?: PositionedNode;
  children: PositionedNode[];
}

export interface ConnectorCurve {
  id: string;
  fromId: string;
  toId: string;
  path: string;
  colorHex: string;
}

export interface TreeLayoutResult {
  nodes: PositionedNode[];
  curves: ConnectorCurve[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

const HORIZONTAL_GAP = 95;
const VERTICAL_GAP = 24;
const SINGLE_LINE_HEIGHT = 44;
const MULTI_LINE_HEIGHT = 58;

/**
 * Wraps node label into 1 or 2 lines cleanly by word boundary.
 */
export function wrapNodeLabel(label: string, isRoot: boolean): { lines: string[]; height: number; width: number } {
  const trimmed = label.trim();
  const maxCharsSingle = isRoot ? 32 : 26;

  // Single line if short enough
  if (trimmed.length <= maxCharsSingle) {
    const basePad = isRoot ? 60 : 48;
    const calcWidth = basePad + trimmed.length * 7.6;
    const width = Math.min(Math.max(calcWidth, isRoot ? 180 : 130), 280);
    return {
      lines: [trimmed],
      height: SINGLE_LINE_HEIGHT,
      width,
    };
  }

  // Multi-line wrap
  const words = trimmed.split(/\s+/);
  const line1Words: string[] = [];
  const line2Words: string[] = [];
  let currentLen = 0;
  const targetPerLine = Math.ceil(trimmed.length / 2);

  for (const word of words) {
    if (line1Words.length === 0 || (currentLen + word.length + 1 <= targetPerLine && line1Words.length < 5)) {
      line1Words.push(word);
      currentLen += word.length + 1;
    } else {
      line2Words.push(word);
    }
  }

  let line1 = line1Words.join(" ");
  let line2 = line2Words.join(" ");

  // Safety: if line 2 is empty (single massive word), split by chars
  if (!line2) {
    line1 = trimmed.slice(0, 24);
    line2 = trimmed.slice(24, 48);
  }

  // Gracefully truncate line 2 if excessively long (> 30 chars)
  if (line2.length > 28) {
    line2 = `${line2.slice(0, 26)}...`;
  }

  const maxLineLen = Math.max(line1.length, line2.length);
  const basePad = isRoot ? 64 : 52;
  const calcWidth = basePad + maxLineLen * 7.4;
  const width = Math.min(Math.max(calcWidth, isRoot ? 200 : 160), 320);

  return {
    lines: [line1, line2],
    height: MULTI_LINE_HEIGHT,
    width,
  };
}

/**
 * Computes tree layout positioning with support for collapsed branches and dynamic node sizes.
 */
export function computeTreeLayout(
  root: MindMapNode,
  collapsedIds: Set<string>
): TreeLayoutResult {
  const allNodes: PositionedNode[] = [];
  const curves: ConnectorCurve[] = [];

  // Step 1: Hierarchical measurement of subtree heights
  function measureSubtreeHeight(node: MindMapNode, isRoot: boolean): number {
    const isCollapsed = collapsedIds.has(node.id);
    const children = (!isCollapsed && node.children) ? node.children : [];
    const { height: nodeHeight } = wrapNodeLabel(node.label, isRoot);

    if (children.length === 0) {
      return nodeHeight;
    }

    let totalChildrenHeight = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child) {
        totalChildrenHeight += measureSubtreeHeight(child, false);
      }
      if (i > 0) {
        totalChildrenHeight += VERTICAL_GAP;
      }
    }
    return Math.max(nodeHeight, totalChildrenHeight);
  }

  // Step 2: Recursive positioning
  function layoutNode(
    node: MindMapNode,
    x: number,
    yStart: number,
    depth: number,
    branchIdx: number,
    parent?: PositionedNode
  ): PositionedNode {
    const isRoot = depth === 0;
    const isCollapsed = collapsedIds.has(node.id);
    const children = (!isCollapsed && node.children) ? node.children : [];
    const hasChildren = Boolean(node.children && node.children.length > 0);

    const { lines, width, height } = wrapNodeLabel(node.label, isRoot);
    const subtreeHeight = measureSubtreeHeight(node, isRoot);
    const nodeY = yStart + (subtreeHeight - height) / 2;

    const branchTheme = isRoot
      ? ROOT_THEME
      : BRANCH_THEMES[Math.abs(branchIdx) % BRANCH_THEMES.length]!;

    const positionedNode: PositionedNode = {
      node,
      id: node.id,
      label: node.label,
      lines,
      x,
      y: nodeY,
      width,
      height,
      depth,
      isRoot,
      hasChildren,
      isCollapsed,
      branchIndex: branchIdx,
      branchTheme,
      parent,
      children: [],
    };

    allNodes.push(positionedNode);

    if (children.length > 0) {
      let childYCurrent = yStart;
      const childX = x + width + HORIZONTAL_GAP;

      for (let idx = 0; idx < children.length; idx++) {
        const child = children[idx]!;
        const childBranchIdx = isRoot ? idx : branchIdx;
        const childSubtreeHeight = measureSubtreeHeight(child, false);

        const childPositioned = layoutNode(
          child,
          childX,
          childYCurrent,
          depth + 1,
          childBranchIdx,
          positionedNode
        );
        positionedNode.children.push(childPositioned);

        // Compute smooth cubic bezier connector curve
        const startX = x + width;
        const startY = nodeY + height / 2;
        const endX = childPositioned.x;
        const endY = childPositioned.y + childPositioned.height / 2;
        const midX = (startX + endX) / 2;

        const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

        curves.push({
          id: `${node.id}->${child.id}`,
          fromId: node.id,
          toId: child.id,
          path,
          colorHex: childPositioned.branchTheme.curveHex,
        });

        childYCurrent += childSubtreeHeight + VERTICAL_GAP;
      }
    }

    return positionedNode;
  }

  // Execute positioning starting at (60, 60)
  layoutNode(root, 60, 60, 0, 0);

  // Step 3: Compute bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of allNodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  if (allNodes.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 200;
    maxY = 100;
  }

  const padding = 80;
  return {
    nodes: allNodes,
    curves,
    bounds: {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: Math.max(maxX - minX + padding * 2, 400),
      height: Math.max(maxY - minY + padding * 2, 300),
    },
  };
}
