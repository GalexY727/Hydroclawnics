import { getCropIcon } from '../lib/cropAssets'

export default function CropIcon({ crop, className = 'h-4 w-4', alt = '' }) {
  return (
    <img
      src={getCropIcon(crop)}
      alt={alt}
      className={`${className} shrink-0 object-contain`}
      draggable="false"
    />
  )
}
