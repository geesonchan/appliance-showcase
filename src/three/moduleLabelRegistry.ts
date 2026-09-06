/**
 * Debug labels for the cabinet modules, registered by box id.
 *
 * Same arrangement as the pins: the DOM owns the elements, the render loop
 * writes transforms onto them, and React never re-renders to follow the camera.
 */
export const moduleLabels = new Map<string, HTMLElement>();

export function registerModuleLabel(id: string, el: HTMLElement | null) {
  if (el) moduleLabels.set(id, el);
  else moduleLabels.delete(id);
}
