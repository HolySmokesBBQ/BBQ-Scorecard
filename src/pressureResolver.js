// Station pressure resolver for the Pit Humidity calculator.
//
// The psychrometric math needs total atmospheric pressure at the
// user's location. Four candidate sources, in priority order:
//
//   1. Manual override — user tapped the pressure chip and typed a value
//   2. Weather station — fetched by the calculator (or CookForm, cached)
//   3. Elevation-derived — barometric formula from GPS elevation
//   4. Hard default — 98.3 kPa, Waukesha's typical station pressure at
//      ~860 ft, chosen because it's the user's actual home location.
//
// Everything is a pure function. No I/O.

// Standard atmosphere barometric formula. Inputs meters, outputs Pa.
// Source: ISA 1976, valid to ~11 km. Reference: 101.325 kPa at sea level.
function pressureFromElevationMeters(hMeters) {
  return 101325 * Math.pow(1 - 2.25577e-5 * hMeters, 5.25588);
}

const FT_TO_M = 0.3048;

export const DEFAULT_PRESSURE_KPA = 98.3;

export function resolvePressure({
  manualPressureKPa,
  weatherPressureKPa,
  elevationFt,
}) {
  if (Number.isFinite(manualPressureKPa) && manualPressureKPa > 0) {
    return { valueKPa: manualPressureKPa, source: 'manual' };
  }
  if (Number.isFinite(weatherPressureKPa) && weatherPressureKPa > 0) {
    return { valueKPa: weatherPressureKPa, source: 'weather' };
  }
  if (Number.isFinite(elevationFt) && elevationFt >= 0) {
    const pa = pressureFromElevationMeters(elevationFt * FT_TO_M);
    return { valueKPa: pa / 1000, source: 'elevation' };
  }
  return { valueKPa: DEFAULT_PRESSURE_KPA, source: 'default' };
}
