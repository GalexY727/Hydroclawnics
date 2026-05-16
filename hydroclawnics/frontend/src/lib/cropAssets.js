import basilIcon from '../../../../media/basil.png'
import greensIcon from '../../../../media/greens.png'
import lettuceIcon from '../../../../media/lettuce.png'
import spinachIcon from '../../../../media/spinach.png'
import tomatoIcon from '../../../../media/tomato.png'

export const CROP_ICON_SRC = {
  basil: basilIcon,
  greens: greensIcon,
  lettuce: lettuceIcon,
  microgreens: greensIcon,
  spinach: spinachIcon,
  tomato: tomatoIcon,
}

export function normalizeCropName(crop) {
  const normalized = `${crop || ''}`.trim().toLowerCase()
  if (normalized === 'greens') return 'microgreens'
  return normalized
}

export function getCropIcon(crop) {
  const normalized = normalizeCropName(crop)
  return CROP_ICON_SRC[normalized] || CROP_ICON_SRC[crop] || greensIcon
}
