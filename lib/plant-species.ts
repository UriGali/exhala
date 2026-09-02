export interface PlantSpecies {
  id: string
  name: string
  scientificName: string
  lore: string
  healingBenefit: string
  colorTheme: {
    primary: string
    secondary: string
    accent: string
    bud: string
    bloom: string
    glow: string
  }
}

export const PLANT_SPECIES: PlantSpecies[] = [
  {
    id: 'bonsai',
    name: 'Bonsái Zen de Jade',
    scientificName: 'Crassula Ovata Zen',
    lore: 'Símbolo de paciencia y serenidad. Crece con constancia igual que tu nueva vida.',
    healingBenefit: 'A los 30 riegos, tus vías respiratorias recuperan su elasticidad natural.',
    colorTheme: {
      primary: '#2D6A4F',
      secondary: '#52B788',
      accent: '#74C69D',
      bud: '#A7F3D0',
      bloom: '#10B981',
      glow: 'rgba(52, 211, 153, 0.25)',
    },
  },
  {
    id: 'sakura',
    name: 'Sakura del Renacer',
    scientificName: 'Prunus Serrulata',
    lore: 'El florecimiento del cerezo celebra cada respiración limpia como un nuevo amanecer.',
    healingBenefit: 'Tus niveles de monóxido de carbono han descendido a valores totalmente normales.',
    colorTheme: {
      primary: '#4A2810',
      secondary: '#40916C',
      accent: '#F472B6',
      bud: '#FBCFE8',
      bloom: '#EC4899',
      glow: 'rgba(244, 114, 182, 0.25)',
    },
  },
  {
    id: 'monstera',
    name: 'Monstera Pulmonar',
    scientificName: 'Monstera Deliciosa',
    lore: 'Sus grandes hojas absorben el aire viciado y purifican cada rincón de tu cuerpo.',
    healingBenefit: 'La capacidad pulmonar aumenta notablemente; subir escaleras ya no te fatiga.',
    colorTheme: {
      primary: '#1B4332',
      secondary: '#2D6A4F',
      accent: '#52B788',
      bud: '#95D5B2',
      bloom: '#34D399',
      glow: 'rgba(16, 185, 129, 0.25)',
    },
  },
  {
    id: 'rose',
    name: 'Rosal de la Perseverancia',
    scientificName: 'Rosa Resilientia',
    lore: 'Flores vibrantes que demuestran que de la disciplina nace la belleza más pura.',
    healingBenefit: 'Tu sentido del gusto y del olfato han regresado en su máxima intensidad.',
    colorTheme: {
      primary: '#1E3A1E',
      secondary: '#2E7D32',
      accent: '#E11D48',
      bud: '#FB7185',
      bloom: '#E11D48',
      glow: 'rgba(225, 29, 72, 0.25)',
    },
  },
  {
    id: 'sunflower',
    name: 'Girasol de la Vitalidad',
    scientificName: 'Helianthus Vitalis',
    lore: 'Siempre buscando la luz del sol, llena de energía renovada cada una de tus mañanas.',
    healingBenefit: 'La circulación sanguínea hacia extremidades y corazón se ha restablecido plenamente.',
    colorTheme: {
      primary: '#2D5A27',
      secondary: '#4E8752',
      accent: '#F59E0B',
      bud: '#FDE68A',
      bloom: '#F59E0B',
      glow: 'rgba(245, 158, 11, 0.25)',
    },
  },
  {
    id: 'tree_of_life',
    name: 'Árbol de la Vida Sagrado',
    scientificName: 'Olea Aeterna',
    lore: 'Arraigado profundamente, invulnerable ante las tormentas pasadas.',
    healingBenefit: 'Riesgo de enfermedad coronaria reducido a la mitad tras tu victoria definitiva.',
    colorTheme: {
      primary: '#3F2E18',
      secondary: '#386641',
      accent: '#6A994E',
      bud: '#A7C957',
      bloom: '#F2E8CF',
      glow: 'rgba(106, 153, 78, 0.25)',
    },
  },
]
