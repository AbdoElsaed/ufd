import { Youtube, Facebook, Twitter, Instagram, Loader2, LucideIcon } from "lucide-react";
import { RedditIcon, TiktokIcon } from "./custom-icons";

export type IconKeys =
  | "youtube"
  | "facebook"
  | "twitter"
  | "reddit"
  | "instagram"
  | "tiktok"
  | "spinner";

export const Icons: Record<IconKeys, LucideIcon> = {
  youtube: Youtube,
  facebook: Facebook,
  twitter: Twitter,
  reddit: RedditIcon,
  instagram: Instagram,
  tiktok: TiktokIcon,
  spinner: Loader2,
} as const;
