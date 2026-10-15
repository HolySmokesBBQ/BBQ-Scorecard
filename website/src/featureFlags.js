// Feature flags — flip and rebuild to toggle.
//
// NAV_V2: the hamburger + accordion drawer + Settings page redesign
// (2026-07). ON in the working tree so Joel can use/iterate on v1.
// It is isolated by this flag rather than a branch because the shared
// src/ tree already carries other in-flight work.
//
// IMPORTANT: before any Play Store AAB rebuild or iOS/Codemagic build,
// confirm the nav redesign is approved — or flip this to false — so an
// unfinished design never ships. The build steps check this flag.
export const NAV_V2 = true;
