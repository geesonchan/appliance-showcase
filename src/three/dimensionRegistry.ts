/**
 * Dimension lines live in an SVG overlay; the render loop moves their
 * endpoints. Same arrangement as the pins, for the same reason: following the
 * camera must not cost a React render.
 */
export interface DimensionParts {
  line: SVGGElement | null;
  label: HTMLElement | null;
}

export const dimensionElements = new Map<string, DimensionParts>();

export function registerDimensionPart(
  id: string,
  part: keyof DimensionParts,
  el: DimensionParts[keyof DimensionParts],
) {
  const entry = dimensionElements.get(id) ?? { line: null, label: null };
  // @ts-expect-error the key and the value are chosen together by the caller
  entry[part] = el;
  if (!entry.line && !entry.label) dimensionElements.delete(id);
  else dimensionElements.set(id, entry);
}
