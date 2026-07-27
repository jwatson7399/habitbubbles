// The palette runs the arc of a day: an indigo night base, with the zone ramp
// climbing from ember through amber to dawn gold. Doing well looks like sunrise.
// Named by role, not by hue, so the scheme can be retuned without renaming.
export const theme = {
  // surfaces, darkest to lightest
  night:        "#151033",
  surface:      "#1F1A45",
  surfaceRaised:"#262056",
  border:       "#332B63",
  borderStrong: "#3D3475",

  // text
  text:         "#EFEBFF",
  textDim:      "#A9A3D4",
  textMuted:    "#8B86B8",

  // zone ramp: behind -> on top
  zoneBehind:   "#E2726E",  // ember
  zoneMiddle:   "#F2A65A",  // amber
  zoneTop:      "#FFD98E",  // dawn gold
  zoneTopSoft:  "#FFE7B5",

  // the suggestion highlight is deliberately COOL, so it cannot be confused
  // with zoneTop now that "doing well" is gold
  suggest:      "#A99BFF",
  suggestDim:   "#5B4FA8",
  suggestBg:    "#2A2358",

  danger:       "#E2726E",
};
