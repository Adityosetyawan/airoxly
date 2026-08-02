export const theme = {
  color: {
    surface: "#FFFFFF",
    onSurface: "#18181B",
    surfaceSecondary: "#F4F4F5",
    onSurfaceSecondary: "#3F3F46",
    surfaceTertiary: "#E4E4E7",
    onSurfaceTertiary: "#52525B",
    surfaceInverse: "#18181B",
    onSurfaceInverse: "#FAFAFA",
    brand: "#059669",
    brandPrimary: "#10B981",
    onBrandPrimary: "#FFFFFF",
    brandSecondary: "#34D399",
    brandTertiary: "#D1FAE5",
    onBrandTertiary: "#065F46",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#14B8A6",
    border: "#E4E4E7",
    borderStrong: "#A1A1AA",
    divider: "#F4F4F5",
    muted: "#71717A",
  },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 },
  font: {
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    "2xl": 24,
  },
};

export const rp = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
