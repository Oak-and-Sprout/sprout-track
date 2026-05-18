import { useLocalization } from '../context/localization';

/**
 * Localizes the unit if available, otherwise localizes a lowercase `unitAbbr`.
 * Fallback is the lowercase `unitAbbr` itself.
 */
export function useUnit() {
  const { t } = useLocalization();

  return {
    unitName: (unitName: string | undefined | null) => getName(unitName, t),
    unitSymbol: (unitAbbr: string | undefined | null) => getSymbol(unitAbbr, t),
  };
}

export function getName(unitName: string | undefined | null, t: (key: string) => string) {
  unitName ??= "";
  return t(`unit.name.${unitName}`) || t(unitName);
}

export function getSymbol(unitAbbr: string | undefined | null, t: (key: string) => string) {
  unitAbbr ??= "";
  return t(`unit.symbol.${abbrToName[unitAbbr]}`) || t(unitAbbr.toLowerCase());
}

const abbrToName: Record<string, string> = {
  C: 'Celsius',
  CAP: 'Cap',
  CC: 'Cubic Centimeters',
  CM: 'Centimeters',
  CREAM: 'Cream',
  DROP: 'Drops',
  DOSE: 'Dose',
  F: 'Fahrenheit',
  G: 'Grams',
  IN: 'Inches',
  INHALER: 'Inhaler',
  INJECTION: 'Injection',
  KG: 'Kilograms',
  L: 'Liters',
  LB: 'Pounds',
  MCG: 'Micrograms',
  MG: 'Milligrams',
  ML: 'Milliliters',
  MMOL: 'Millimoles',
  MOL: 'Moles',
  OINTMENT: 'Ointment',
  OZ: 'Ounces',
  PATCH: 'Patch',
  PILL: 'Pill',
  SPRAY: 'Spray',
  SUPPOSITORY: 'Suppository',
  TAB: 'Tab',
  TBSP: 'Tablespoon',
}
