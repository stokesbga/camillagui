export const RAINBOW_COLORS = ["#ff5277", "#ff994d", "#ffe36b", "#7bea80", "#49d9f0", "#6386ff", "#b785ff"]

export function rainbowGradient(context: CanvasRenderingContext2D, left: number, right: number, alpha = "") {
  const gradient = context.createLinearGradient(left, 0, right, 0)
  RAINBOW_COLORS.forEach((color, index) => gradient.addColorStop(index / (RAINBOW_COLORS.length - 1), color + alpha))
  return gradient
}
