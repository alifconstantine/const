export interface CropPosition {
  x: number;
  y: number;
}

/** The normalized position is shared by the preview and exported image. */
export function avatarCropRect(
  width: number,
  height: number,
  zoom: number,
  position: CropPosition,
) {
  const side = Math.min(width, height) / Math.max(1, zoom);
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  return {
    x: ((width - side) / 2) * (1 - clamp(position.x)),
    y: ((height - side) / 2) * (1 - clamp(position.y)),
    side,
  };
}
