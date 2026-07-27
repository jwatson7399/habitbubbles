export const BASE_RADIUS = 60;
export const SPECK_RADIUS = 3.5;
export const MIN_INTERACT_RADIUS = 22; // 44px diameter, the accessible minimum
export const COLLISION_SPACING = 4;

// Importance modulates amplitude; pressure drives the curve. At pressure 0 the
// product is 0 regardless of importance, which the deflate-to-speck lifecycle
// requires.
export function habitPriority({ pressure, importance }) {
  const p = Number(pressure) || 0;
  const imp = Number(importance) || 1;
  return p * (0.5 + (0.5 * imp) / 5);
}

// Four radii, deliberately separate. Sizing d3-force collision from the visual
// radius is exactly what lets zero-pressure specks stack on top of one another,
// so collision derives from the interaction radius instead.
export function habitRadii(priority) {
  const mathRadius = BASE_RADIUS * (Number(priority) || 0);
  const interactRadius = Math.max(MIN_INTERACT_RADIUS, mathRadius);
  return {
    mathRadius,
    visualRadius: Math.max(SPECK_RADIUS, mathRadius),
    interactRadius,
    collisionRadius: interactRadius + COLLISION_SPACING,
  };
}
