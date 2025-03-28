import {
  Youtube,
  Facebook,
  Twitter,
  RotateCw,
  type LucideIcon,
  Instagram,
} from "lucide-react"
import { RedditIcon, TiktokIcon } from "./ui/custom-icons"

export type IconKeys = "youtube" | "facebook" | "twitter" | "reddit" | "spinner" | "tiktok" | "instagram"

type IconType = LucideIcon | React.FC<{ className?: string }>

export const Icons: Record<IconKeys, IconType> = {
  youtube: Youtube,
  facebook: Facebook,
  twitter: Twitter,
  reddit: RedditIcon,
  tiktok: TiktokIcon,
  instagram: Instagram,
  spinner: RotateCw,
}
