// Pit humidity calculator — thin wrapper around PsychroLib (ASHRAE 2017).
// Converts smoker dry-bulb + wet-bulb + station pressure into relative
// humidity, humidity ratio, and dew point. Everything user-facing stays
// in imperial (°F, kPa) but the math runs in SI internally because
// PsychroLib's SI mode has cleaner pressure handling (Pa) than IP (psi).
//
// One entry point: computeHumidity({ dryF, wetF, pressureKPa }).
// Returns { rh, wKgPerKg, dewpointF, warning } where warning is null
// or one of 'inverted' | 'dry_wick' | 'above_boiling'.

import psychrolib from 'psychrolib';

psychrolib.SetUnitSystem(psychrolib.SI);

const fToC = (f) => (f - 32) * (5 / 9);
const cToF = (c) => c * (9 / 5) + 32;
const kPaToPa = (kpa) => kpa * 1000;

// Boiling detection: liquid water cannot exist above the boiling point
// for a given pressure. That means the WET-bulb reading cannot exceed
// the boiling point — if it does, the shoelace is boiling dry rather
// than wet-bulb-measuring. Dry-bulb can be arbitrarily high (that's
// just hot air); it's the wet-bulb that's constrained.
//
// Test: is saturation vapor pressure at the wet-bulb temperature
// greater than or equal to the total pressure? If yes, water would
// boil at that temperature and the wet-bulb probe can't be reading
// what it claims.
function wetBulbAboveBoiling(wetC, pressurePa) {
  const satVapPresAtWet = psychrolib.GetSatVapPres(wetC);
  return satVapPresAtWet >= pressurePa;
}

export function computeHumidity({ dryF, wetF, pressureKPa }) {
  // Validate inputs. Non-finite or missing values return null result
  // rather than throwing — caller decides how to render an empty state.
  if (!Number.isFinite(dryF) || !Number.isFinite(wetF) || !Number.isFinite(pressureKPa)) {
    return { rh: null, wKgPerKg: null, dewpointF: null, warning: null };
  }

  // Physical guard: wet-bulb cannot exceed dry-bulb. Almost always means
  // the tester has the probes swapped — flag it and don't compute.
  if (wetF > dryF) {
    return { rh: null, wKgPerKg: null, dewpointF: null, warning: 'inverted' };
  }

  const dryC = fToC(dryF);
  const wetC = fToC(wetF);
  const pressurePa = kPaToPa(pressureKPa);

  // Above-boiling guard runs BEFORE the math. If the wet-bulb reading is
  // at or above the boiling point for this pressure, the shoelace can't
  // actually be wet — bail with the warning rather than feed nonsense to
  // psychrolib.
  if (wetBulbAboveBoiling(wetC, pressurePa)) {
    return {
      rh: 1.0,
      wKgPerKg: null,
      dewpointF: null,
      warning: 'above_boiling',
    };
  }

  let wKgPerKg, rh, dewpointC;
  try {
    wKgPerKg = psychrolib.GetHumRatioFromTWetBulb(dryC, wetC, pressurePa);
    rh = psychrolib.GetRelHumFromHumRatio(dryC, wKgPerKg, pressurePa);
    dewpointC = psychrolib.GetTDewPointFromHumRatio(dryC, wKgPerKg, pressurePa);
  } catch {
    // PsychroLib throws on invalid inputs (e.g. negative humidity ratio).
    // Fall back to an empty result rather than a broken UI.
    return { rh: null, wKgPerKg: null, dewpointF: null, warning: null };
  }

  // Clamp RH to [0, 1] for cases where the iterative solver overshoots
  // very slightly at saturation but the physics is still valid.
  const rhClamped = Math.max(0, Math.min(1, rh));

  // Dry-wick detection: the physical rig fails when the shoelace runs
  // dry and stops wicking water — the wet-bulb probe converges on the
  // dry-bulb reading. In the smoker operating range (dry ≥ 180°F), a
  // gap of less than 10°F is suspicious. This is the failure mode the
  // spec calls out explicitly.
  const dryWick = dryF >= 180 && (dryF - wetF) < 10;

  return {
    rh: rhClamped,
    wKgPerKg,
    dewpointF: cToF(dewpointC),
    warning: dryWick ? 'dry_wick' : null,
  };
}
