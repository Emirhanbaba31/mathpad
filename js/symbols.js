// Circuit symbols for the board. Each symbol is drawn from SVG path data inside a w×h box (board units, scale 1).
// stroke: outlines; fill: solid parts (dots, arrow heads).
export const SYMBOLS = {
  resistor: { label: 'Direnç', w: 60, h: 30, stroke: ['M0 15H14L17 7L23 23L29 7L35 23L41 7L44 15H60'] },
  resistorIec: { label: 'Direnç (IEC)', w: 60, h: 30, stroke: ['M0 15H16M44 15H60M16 9H44V21H16Z'] },
  capacitor: { label: 'Kondansatör', w: 60, h: 30, stroke: ['M0 15H26M26 3V27M34 3V27M34 15H60'] },
  inductor: { label: 'Bobin', w: 60, h: 30, stroke: ['M0 15H12A4.5 4.5 0 0 1 21 15A4.5 4.5 0 0 1 30 15A4.5 4.5 0 0 1 39 15A4.5 4.5 0 0 1 48 15H60'] },
  battery: { label: 'Pil (DC)', w: 60, h: 30, stroke: ['M0 15H25M25 3V27M33 9V21M33 15H60M14 6H20M17 3V9'] },
  vsource: { label: 'Gerilim kaynağı', w: 60, h: 30, stroke: ['M0 15H16M44 15H60M44 15A14 14 0 1 1 16 15A14 14 0 1 1 44 15M21 15H26M23.5 12.5V17.5M34 15H39'] },
  acsource: { label: 'AC kaynak', w: 60, h: 30, stroke: ['M0 15H16M44 15H60M44 15A14 14 0 1 1 16 15A14 14 0 1 1 44 15M22 15Q26 7 30 15T38 15'] },
  isource: { label: 'Akım kaynağı', w: 60, h: 30, stroke: ['M0 15H16M44 15H60M44 15A14 14 0 1 1 16 15A14 14 0 1 1 44 15M22 15H38'], fill: ['M38 15L32 11V19Z'] },
  ground: { label: 'Toprak', w: 30, h: 26, stroke: ['M15 0V12M3 12H27M8 17H22M12 22H18'] },
  diode: { label: 'Diyot', w: 60, h: 30, stroke: ['M0 15H22M38 5V25M38 15H60'], fill: ['M22 5V25L38 15Z'] },
  led: { label: 'LED', w: 60, h: 34, stroke: ['M0 19H22M38 9V29M38 19H60M34 6L40 0M40 4L46 -2'], fill: ['M22 9V29L38 19Z', 'M40 0L36 1L39 4Z', 'M46 -2L42 -1L45 2Z'] },
  zener: { label: 'Zener diyot', w: 60, h: 30, stroke: ['M0 15H22M34 3L38 5V25L42 27M38 15H60'], fill: ['M22 5V25L38 15Z'] },
  switch: { label: 'Anahtar', w: 60, h: 30, stroke: ['M0 15H16M44 15H60M19 15L41 4'], fill: ['M19 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M44 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'] },
  opamp: { label: 'Op-amp', w: 70, h: 50, stroke: ['M12 0V50L58 25Z', 'M0 13H12M0 37H12M58 25H70M16 13H22M16 37H22M19 34V40'] },
  npn: { label: 'NPN transistör', w: 44, h: 46, stroke: ['M24 5A18 18 0 1 1 23.9 5', 'M0 23H15M15 11V35M15 17L32 7V0M15 29L32 39V46'], fill: ['M32 39L23 37L27 31Z'] },
  pnp: { label: 'PNP transistör', w: 44, h: 46, stroke: ['M24 5A18 18 0 1 1 23.9 5', 'M0 23H15M15 11V35M15 17L32 7V0M15 29L32 39V46'], fill: ['M15 29L24 31L20 37Z'] },
  lamp: { label: 'Lamba', w: 60, h: 30, stroke: ['M0 15H16M44 15H60M44 15A14 14 0 1 1 16 15A14 14 0 1 1 44 15M20 5L40 25M40 5L20 25'] },
  node: { label: 'Düğüm', w: 8, h: 8, fill: ['M4 4m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0'] },
};

// Small SVG preview for the palette.
export const symbolSvg = name => {
  const s = SYMBOLS[name], pad = 6;
  return `<svg viewBox="${-pad} ${-pad} ${s.w + pad * 2} ${s.h + pad * 2}" aria-hidden="true">${(s.stroke || []).map(d => `<path d="${d}" class="sym-s"/>`).join('')}${(s.fill || []).map(d => `<path d="${d}" class="sym-f"/>`).join('')}</svg>`;
};
