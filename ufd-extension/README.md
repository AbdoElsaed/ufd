# Universal File Downloader Extension

A modern browser extension to download videos from popular platforms. This extension integrates with the UFD backend service to provide high-quality downloads.

## Features

- 🎨 Modern dark mode UI
- 🎬 Support for multiple platforms:
  - YouTube
  - Instagram
  - Facebook
  - Twitter
  - TikTok
  - Reddit
- 🎵 Multiple format options:
  - Video (MP4)
  - Audio (M4A)
- 📊 Quality selection:
  - Highest quality
  - 1080p
  - 720p
  - 480p
  - 360p
- ⚡ One-click download
- 🔄 Real-time progress tracking

## Installation

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select any file in the `ufd-extension` directory

### Chrome

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked"
5. Select the `ufd-extension` directory

## Usage

1. Navigate to a supported video site (YouTube, Facebook, etc.)
2. Click the UFD extension icon to open the popup
3. The extension will automatically detect the platform and fetch video information
4. Select your preferred format and quality
5. Click "Download" to start the download process
6. The browser's built-in download manager will handle the file saving

## Development

This extension communicates with the UFD backend API. It uses the following endpoints:
- `/api/v1/download/info` - Get video information
- `/api/v1/download/start` - Start a download

### API Endpoints

Both development (localhost) and production API endpoints are configured in the extension.

## License

MIT License 