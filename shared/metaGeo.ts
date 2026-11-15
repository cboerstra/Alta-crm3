// Where a housing ad may run. Meta's Housing special ad category forbids ZIP
// code targeting and any city, address or pin with a radius under 15 miles,
// so ads target a point with a radius of at least 15 miles.

export const MIN_HOUSING_RADIUS_MILES = 15;

export type TargetArea = { name: string; latitude: number; longitude: number; radius: number };

/** Centers across the service area (Weber, Davis, Box Elder, Morgan) and nearby. */
export const UTAH_AREAS: Omit<TargetArea, "radius">[] = [
  { name: "Ogden", latitude: 41.223, longitude: -111.9738 },
  { name: "Plain City", latitude: 41.298, longitude: -112.086 },
  { name: "Roy", latitude: 41.1616, longitude: -112.0263 },
  { name: "Layton", latitude: 41.0602, longitude: -111.9711 },
  { name: "Clearfield", latitude: 41.1108, longitude: -112.0261 },
  { name: "Kaysville", latitude: 41.0352, longitude: -111.9386 },
  { name: "Farmington", latitude: 40.9805, longitude: -111.8874 },
  { name: "Bountiful", latitude: 40.8894, longitude: -111.8808 },
  { name: "Brigham City", latitude: 41.5102, longitude: -112.0155 },
  { name: "Tremonton", latitude: 41.7116, longitude: -112.1655 },
  { name: "Morgan", latitude: 41.0361, longitude: -111.6769 },
  { name: "Salt Lake City", latitude: 40.7608, longitude: -111.891 },
];

export const RADIUS_OPTIONS = [15, 20, 25, 30, 40, 50];

/** The default for new campaigns: Davis, Weber and Box Elder counties. */
export const DEFAULT_TARGET_AREAS: TargetArea[] = [
  { ...UTAH_AREAS[0], radius: 25 },                                   // Ogden: Weber and Davis
  { ...UTAH_AREAS.find((a) => a.name === "Brigham City")!, radius: 25 }, // Box Elder
];

export function areaByName(name: string, radius: number): TargetArea | null {
  const area = UTAH_AREAS.find((a) => a.name === name);
  return area ? { ...area, radius: Math.max(MIN_HOUSING_RADIUS_MILES, radius) } : null;
}
