// Read design tokens from theme.css so JS-drawn things (3D viewer, legends) share the same colors.
export const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const confidenceColor = (b) =>
  b > 0.9 ? token("--conf-very-high") : b > 0.7 ? token("--conf-high") : b > 0.5 ? token("--conf-low") : token("--conf-very-low");
