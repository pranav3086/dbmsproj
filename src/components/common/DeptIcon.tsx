import { Baby, Bone, Brain, Ear, Eye, FlaskConical, Flower2, HeartPulse, Sparkles, Stethoscope, type LucideProps } from 'lucide-react'

const icons = {
  'heart-pulse': HeartPulse,
  brain: Brain,
  bone: Bone,
  baby: Baby,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  'flower-2': Flower2,
  ear: Ear,
  eye: Eye,
  'flask-conical': FlaskConical,
} as const

export const DEPARTMENT_ICON_NAMES = Object.keys(icons)

export function DeptIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = icons[name as keyof typeof icons] ?? Stethoscope
  return <Icon aria-hidden {...props} />
}
