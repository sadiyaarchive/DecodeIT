// Decisions about the canvas selection that do not need Figma itself, so they can be tested
// without it. The plugin code passes in plain descriptions of the selected layers.

/** The kinds of layer that make sense as "the design the feedback is about". */
export const SUPPORTED_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION', 'GROUP'] as const;

export interface NodeLike {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
}

export type Classified =
  | { kind: 'none' }
  | { kind: 'multiple'; count: number }
  | { kind: 'unsupported'; nodeType: string; name: string }
  | { kind: 'candidate'; node: NodeLike };

export function isSupportedType(type: string): boolean {
  return (SUPPORTED_TYPES as readonly string[]).includes(type);
}

export function classifySelection(nodes: readonly NodeLike[]): Classified {
  if (nodes.length === 0) return { kind: 'none' };
  if (nodes.length > 1) return { kind: 'multiple', count: nodes.length };
  const node = nodes[0];
  if (!isSupportedType(node.type)) return { kind: 'unsupported', nodeType: node.type, name: node.name };
  if (!(node.width > 0) || !(node.height > 0)) return { kind: 'unsupported', nodeType: node.type, name: node.name };
  return { kind: 'candidate', node };
}

/**
 * How much to scale a layer for its preview image: sharp on a 2x screen, but never huge. A very tall
 * frame is scaled down so the image stays a reasonable size. Figma accepts 0.01 to 4.
 */
export function previewScale(width: number, height: number, max = { width: 720, height: 2400, scale: 2 }): number {
  const s = Math.min(max.scale, max.width / width, max.height / height);
  return Math.min(4, Math.max(0.01, Number(s.toFixed(4))));
}

/** A readable name for a Figma node type, for messages. */
export function typeLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    TEXT: 'a text layer',
    RECTANGLE: 'a rectangle',
    ELLIPSE: 'a shape',
    VECTOR: 'a vector',
    LINE: 'a line',
    BOOLEAN_OPERATION: 'a shape',
    STAR: 'a shape',
    POLYGON: 'a shape',
    SLICE: 'a slice',
    STICKY: 'a sticky',
  };
  return labels[nodeType] ?? 'that layer';
}
