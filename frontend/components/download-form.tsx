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
import { Icons } from "./icons";
import { cn } from "@/lib/utils";
import {
  Platform,
  Format,
  Quality,
  DownloadRequest,
  VideoInfo,
} from "@/app/types/download";
import { downloadService } from "@/services/download-service";

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
    domains: ["youtube.com", "youtu.be"],
  },
  facebook: {
    name: "Facebook",
    icon: "facebook",
    color: "text-blue-600",
    domains: ["facebook.com", "fb.watch"],
  },
  twitter: {
    name: "Twitter",
    icon: "twitter",
    color: "text-sky-500",
    domains: ["twitter.com", "x.com"],
  },
  reddit: {
    name: "Reddit",
    icon: "reddit",
    color: "text-orange-600",
    domains: ["reddit.com"],
  },
  instagram: {
    name: "Instagram",
    icon: "instagram",
    color: "text-pink-600",
    domains: ["instagram.com"],
  },
  tiktok: {
    name: "TikTok",
    icon: "tiktok",
    color: "text-purple-600",
    domains: ["tiktok.com"],
  },
};

export function DownloadForm() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform | null>(
    null
  );
  const [format, setFormat] = useState<Format>(Format.VIDEO);
  const [quality, setQuality] = useState<Quality>(Quality.HD720);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    console.log("Checking URL:", newUrl);
    const platform = downloadService.detectPlatform(newUrl);
    console.log("Detected platform:", platform);
    setDetectedPlatform(platform);
    setError(null);
    setVideoInfo(null);
  };

  const handleFormatChange = (value: string) => {
    const newFormat = value as Format;
    setFormat(newFormat);
    if (newFormat === Format.AUDIO) {
      setQuality(Quality.HIGHEST);
    }
  };

  const handleQualityChange = (value: string) => {
    setQuality(value as Quality);
  };

  const getVideoInfo = async () => {
    if (!url || !detectedPlatform) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: DownloadRequest = {
        url,
        platform: detectedPlatform,
        format,
        quality,
      };

      const info = await downloadService.getVideoInfo(request);
      setVideoInfo(info);
    } catch (error) {
      console.error("Error getting video info:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
      setVideoInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!url || !detectedPlatform) return;

    setIsLoading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      const request: DownloadRequest = {
        url,
        platform: detectedPlatform,
        format,
        quality,
      };

      console.log("Starting download request:", request);

      const { blob, filename } = await downloadService.downloadVideo(
        request,
        (progress) => {
          console.log("Download progress:", progress);
          setDownloadProgress(Math.round(progress));
        }
      );

      console.log("Download complete, creating blob URL...");

      // Create download URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);

      console.log("Triggering download...");
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);

      // Keep 100% progress for a moment so user sees it completed
      setDownloadProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsLoading(false);
      setDownloadProgress(0);
    } catch (error) {
      console.error("Download error:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
      setDownloadProgress(0);
    }
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
              onChange={handleUrlChange}
              className={cn(
                "bg-muted",
                error && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            <Button
              onClick={getVideoInfo}
              disabled={!url || !detectedPlatform || isLoading}
              variant="secondary"
            >
              {isLoading ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                "Get Info"
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
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
              <Select value={format} onValueChange={handleFormatChange}>
                <SelectTrigger className="bg-muted">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Format).map((f) => (
                    <SelectItem key={f} value={f}>
                      {f.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quality" className="text-muted-foreground">
                Quality
              </Label>
              <Select
                value={quality}
                onValueChange={handleQualityChange}
                disabled={format === Format.AUDIO}
              >
                <SelectTrigger className="bg-muted">
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Quality).map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {videoInfo && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex gap-4">
              {videoInfo.thumbnail && (
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="h-24 w-40 rounded object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold">{videoInfo.title}</h3>
                {videoInfo.duration && (
                  <p className="text-sm text-gray-500">
                    Duration: {Math.floor(videoInfo.duration / 60)}:
                    {(videoInfo.duration % 60).toString().padStart(2, "0")}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {downloadProgress > 0 && downloadProgress < 100 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              )}
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Icons.spinner className="h-4 w-4 animate-spin" />
                    {downloadProgress > 0
                      ? `Downloading... ${downloadProgress}%`
                      : "Starting download..."}
                  </div>
                ) : (
                  "Download"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
