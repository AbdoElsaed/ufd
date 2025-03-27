import {
  Youtube,
  Facebook,
  Twitter,
  RotateCw,
  type LucideIcon,
  Instagram,
} from "lucide-react"
import { RedditIcon, TiktokIcon } from "./custom-icons"

export type IconKeys = "youtube" | "facebook" | "twitter" | "reddit" | "spinner" | "tiktok" | "instagram"

export const Icons: Record<IconKeys, any> = {
  youtube: Youtube,
  facebook: Facebook,
  twitter: Twitter,
  reddit: RedditIcon,
  tiktok: TiktokIcon,
  instagram: Instagram,
  spinner: RotateCw,
}
