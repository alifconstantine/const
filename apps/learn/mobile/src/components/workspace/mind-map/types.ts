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

export interface PositionedNode {
  node: MindMapNode;
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  isRoot: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  parent?: PositionedNode;
  children: PositionedNode[];
}

export interface ConnectorCurve {
  id: string;
  fromId: string;
  toId: string;
  path: string;
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

const HORIZONTAL_GAP = 85;
const VERTICAL_GAP = 20;
const NODE_HEIGHT = 42;

export function estimateNodeWidth(label: string, isRoot: boolean): number {
  const charLength = label.length;
  const basePadding = isRoot ? 50 : 40;
  const charWidth = 7.2;
  const calculated = basePadding + charLength * charWidth;
  return Math.min(Math.max(calculated, isRoot ? 160 : 120), 260);
}

export function computeTreeLayout(
  root: MindMapNode,
  collapsedIds: Set<string>
): TreeLayoutResult {
  const allNodes: PositionedNode[] = [];
  const curves: ConnectorCurve[] = [];

  function measureSubtreeHeight(node: MindMapNode): number {
    const isCollapsed = collapsedIds.has(node.id);
    const children = (!isCollapsed && node.children) ? node.children : [];

    if (children.length === 0) {
      return NODE_HEIGHT;
    }

    let totalHeight = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child) {
        totalHeight += measureSubtreeHeight(child);
      }
      if (i > 0) {
        totalHeight += VERTICAL_GAP;
      }
    }
    return Math.max(NODE_HEIGHT, totalHeight);
  }

  function layoutNode(
    node: MindMapNode,
    x: number,
    yStart: number,
    depth: number,
    parent?: PositionedNode
  ): PositionedNode {
    const isRoot = depth === 0;
    const isCollapsed = collapsedIds.has(node.id);
    const children = (!isCollapsed && node.children) ? node.children : [];
    const hasChildren = Boolean(node.children && node.children.length > 0);

    const width = estimateNodeWidth(node.label, isRoot);
    const height = NODE_HEIGHT;

    const subtreeHeight = measureSubtreeHeight(node);
    const nodeY = yStart + (subtreeHeight - height) / 2;

    const positionedNode: PositionedNode = {
      node,
      id: node.id,
      label: node.label,
      x,
      y: nodeY,
      width,
      height,
      depth,
      isRoot,
      hasChildren,
      isCollapsed,
      parent,
      children: [],
    };

    allNodes.push(positionedNode);

    if (children.length > 0) {
      let childYCurrent = yStart;
      const childX = x + width + HORIZONTAL_GAP;

      for (const child of children) {
        const childSubtreeHeight = measureSubtreeHeight(child);
        const childPositioned = layoutNode(
          child,
          childX,
          childYCurrent,
          depth + 1,
          positionedNode
        );
        positionedNode.children.push(childPositioned);

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
        });

        childYCurrent += childSubtreeHeight + VERTICAL_GAP;
      }
    }

    return positionedNode;
  }

  layoutNode(root, 50, 50, 0);

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

  const padding = 60;
  return {
    nodes: allNodes,
    curves,
    bounds: {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: Math.max(maxX - minX + padding * 2, 360),
      height: Math.max(maxY - minY + padding * 2, 280),
    },
  };
}
