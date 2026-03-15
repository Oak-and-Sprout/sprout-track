/**
 * Top 50 most common childhood vaccines
 * Names are kept in English as they are medical/scientific terms
 */
export const CHILDHOOD_VACCINES = [
  // Hepatitis
  'Hepatitis B (HepB)',
  'Hepatitis A (HepA)',
  'Twinrix (HepA/HepB)',

  // Rotavirus
  'Rotavirus (RV) - RotaTeq',
  'Rotavirus (RV) - Rotarix',

  // Diphtheria, Tetanus, Pertussis
  'DTaP (Diphtheria, Tetanus, Pertussis)',
  'Tdap (Tetanus, Diphtheria, Pertussis)',
  'DT (Diphtheria, Tetanus)',
  'Td (Tetanus, Diphtheria)',

  // Haemophilus influenzae
  'Hib (Haemophilus influenzae type b)',
  'Hib-MenCY (MenHibrix)',

  // Pneumococcal
  'PCV13 (Prevnar 13)',
  'PCV15 (Vaxneuvance)',
  'PCV20 (Prevnar 20)',
  'PPSV23 (Pneumovax 23)',

  // Poliovirus
  'IPV (Inactivated Poliovirus)',

  // Influenza
  'Influenza (Flu) - Injectable',
  'Influenza (Flu) - Nasal Spray (LAIV)',

  // Measles, Mumps, Rubella
  'MMR (Measles, Mumps, Rubella)',
  'MMRV (ProQuad)',

  // Varicella
  'Varicella (Chickenpox)',

  // Meningococcal
  'MenACWY (Menactra)',
  'MenACWY (Menveo)',
  'MenB (Bexsero)',
  'MenB (Trumenba)',

  // HPV
  'HPV (Gardasil 9)',

  // COVID-19
  'COVID-19 - Pfizer-BioNTech',
  'COVID-19 - Moderna',
  'COVID-19 - Novavax',

  // RSV
  'RSV (Abrysvo)',
  'RSV (Beyfortus/Nirsevimab)',

  // Combination Vaccines
  'Pediarix (DTaP/IPV/HepB)',
  'Pentacel (DTaP/IPV/Hib)',
  'Vaxelis (DTaP/IPV/Hib/HepB)',
  'Kinrix (DTaP/IPV)',
  'Quadracel (DTaP/IPV)',

  // Tuberculosis
  'BCG (Tuberculosis)',

  // Rabies
  'Rabies',

  // Japanese Encephalitis
  'Japanese Encephalitis (Ixiaro)',

  // Typhoid
  'Typhoid - Injectable (Typhim Vi)',
  'Typhoid - Oral (Vivotif)',

  // Yellow Fever
  'Yellow Fever (YF-VAX)',

  // Cholera
  'Cholera (Vaxchora)',

  // Dengue
  'Dengue (Dengvaxia)',

  // Mpox
  'Mpox (Jynneos)',
] as const;

export type VaccineName = typeof CHILDHOOD_VACCINES[number];
