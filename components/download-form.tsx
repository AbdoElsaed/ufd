"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Icons } from "./ui/icons";
import { ChangeEvent } from "react";
import { cn } from "@/lib/utils";

interface PlatformInfo {
  name: string;
  icon: keyof typeof Icons;
  color: string;
  domains: string[];
}

const platforms: Record<string, PlatformInfo> = {
  youtube: { 
    name: "YouTube", 
    icon: "youtube", 
    color: "text-red-600",
    domains: ["youtube.com", "youtu.be"]
  },
  facebook: { 
    name: "Facebook", 
    icon: "facebook", 
    color: "text-blue-600",
    domains: ["facebook.com", "fb.watch"]
  },
  twitter: { 
    name: "Twitter", 
    icon: "twitter", 
    color: "text-sky-500",
    domains: ["twitter.com", "x.com"]
  },
  reddit: { 
    name: "Reddit", 
    icon: "reddit", 
    color: "text-orange-600",
    domains: ["reddit.com"]
  },
  instagram: { 
    name: "Instagram", 
    icon: "instagram", 
    color: "text-pink-600",
    domains: ["instagram.com"]
  },
  tiktok: { 
    name: "TikTok", 
    icon: "tiktok", 
    color: "text-purple-600",
    domains: ["tiktok.com"]
  },
};

export default function DownloadForm() {
  const [url, setUrl] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [format, setFormat] = useState("video");
  const [quality, setQuality] = useState("highest");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(false);

  const isValidHttpUrl = (string: string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const detectPlatform = (url: string) => {
    if (!isValidHttpUrl(url)) return null;
    
    for (const [platform, info] of Object.entries(platforms)) {
      if (info.domains.some(domain => url.includes(domain))) {
        return platform;
      }
    }
    return null;
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    const isValid = isValidHttpUrl(value);
    setIsValidUrl(isValid);
    setDetectedPlatform(isValid ? detectPlatform(value) : null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    // TODO: Implement download logic
    setTimeout(() => setIsLoading(false), 2000);
  };

  const IconComponent = ({
    name,
    className,
  }: {
    name: keyof typeof Icons;
    className?: string;
  }) => {
    const Icon = Icons[name];
    return <Icon className={className} />;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-muted">
      <CardHeader className="space-y-4">
        <div className="flex justify-center gap-6">
          {Object.entries(platforms).map(([key, platform]) => (
            <div key={key} className="text-center">
              <IconComponent
                name={platform.icon}
                className={cn(
                  "h-8 w-8 transition-all hover:scale-110",
                  detectedPlatform === key
                    ? platform.color
                    : "text-muted-foreground opacity-50 hover:opacity-75"
                )}
              />
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="url" className="text-muted-foreground">
            Paste your media URL here
          </Label>
          <div className="flex gap-2">
            <Input
              id="url"
              placeholder="https://"
              value={url}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleUrlChange(e.target.value)
              }
              className={cn(
                "bg-muted",
                !isValidUrl && url && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            <Button
              onClick={handleSubmit}
              disabled={!url || !isValidUrl || !detectedPlatform || isLoading}
              variant="secondary"
            >
              {isLoading ? (
                <>
                  <IconComponent
                    name="spinner"
                    className="mr-2 h-4 w-4 animate-spin"
                  />
                  Processing
                </>
              ) : (
                "Download"
              )}
            </Button>
          </div>
          {url && !isValidUrl && (
            <p className="text-sm text-red-500">Please enter a valid URL</p>
          )}
        </div>

        {detectedPlatform && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconComponent
                name={platforms[detectedPlatform].icon}
                className={`h-5 w-5 ${platforms[detectedPlatform].color}`}
              />
              <span className="text-muted-foreground">
                Platform detected: {platforms[detectedPlatform].name}
              </span>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Format</Label>
              <RadioGroup
                defaultValue="video"
                value={format}
                onValueChange={setFormat}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="video" id="video" />
                  <Label htmlFor="video" className="text-muted-foreground">
                    Video
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="audio" id="audio" />
                  <Label htmlFor="audio" className="text-muted-foreground">
                    Audio only
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quality" className="text-muted-foreground">
                Quality
              </Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger className="bg-muted">
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="highest">Highest</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                  <SelectItem value="360p">360p</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
