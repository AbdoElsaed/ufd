# Universal File Downloader (UFD)

A browser extension for downloading videos from various social media platforms with support for different formats and qualities.

![UFD Logo](ufd-extension/icons/icon128.png)

## Project Structure

- **ufd-extension**: The browser extension (Firefox and Chrome)
- **backend** (optional): The FastAPI backend for video processing

## Extension Features

- 🎥 Support for multiple platforms:
  - YouTube
  - Instagram
  - Facebook
  - Twitter
  - TikTok
  - Reddit
- 🎬 Multiple format options:
  - Video (MP4)
  - Audio (M4A)
- 📊 Quality selection:
  - Highest quality
  - 1080p
  - 720p
  - 480p
  - 360p
- 🚀 Easy-to-use interface
- 🔒 Respects privacy - all data stays in your browser

## Extension Installation

### Firefox

1. Download the latest release or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file in the `ufd-extension` directory

### Chrome

1. Download the latest release or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked"
5. Select the `ufd-extension` directory

## Using the Extension

1. Navigate to a supported video site (YouTube, Facebook, etc.)
2. Click the UFD extension icon to open the popup
3. The extension will automatically detect the platform and fetch video information
4. Select your preferred format and quality
5. Click "Download" to start the download process

## Backend Configuration

By default, the extension uses our hosted backend at `https://ufd.onrender.com/api/v1`. **No local setup is required.**

### Switching Between Backends

The extension includes a built-in feature to toggle between the production and development backends:

1. Double-click on the status text at the bottom of the popup
2. Click the "Reload Extension" button that appears

### Running a Local Backend (Optional)

If you want to run your own backend:

#### Prerequisites
- Python 3.10+
- FFmpeg
- yt-dlp

#### Setup
1. Clone this repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Start the backend server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

## Troubleshooting

- **YouTube extraction errors**: Sometimes YouTube updates their systems, which can break yt-dlp extraction. If you see errors like "Failed to extract player response," try:
  - Waiting for a backend update (yt-dlp needs to be updated)
  - Using a different video
  - Making sure you're logged in to YouTube
  
- **Authentication issues**: For age-restricted or private videos, make sure you're logged in to the platform in your browser so the extension can use your cookies.

- **Download failures**: If downloads fail, check:
  - Your internet connection
  - That you're using a supported platform and URL format
  - Browser console logs for detailed error information
  - That your backend service is running (if using a local backend)

## Updating the Backend

If you're running your own backend and experience yt-dlp extraction errors, you should update yt-dlp:

1. SSH into your server or open a terminal in your local backend environment
2. Activate your virtual environment if you're using one
3. Run: `pip install -U yt-dlp`
4. Restart your backend server

For the hosted backend on Render, these updates are managed automatically.

## License

MIT License 