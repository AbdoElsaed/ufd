# Universal File Downloader Extension

A modern browser extension to download videos from popular platforms. This extension connects to the UFD backend service which is hosted on Render.

## Features

- 🎨 Modern UI with dark mode
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

## Usage

1. Navigate to a supported video site (YouTube, Facebook, etc.)
2. Click the UFD extension icon to open the popup
3. The extension will automatically detect the platform and fetch video information
4. Select your preferred format and quality
5. Click "Download" to start the download process
6. The browser's built-in download manager will handle the file saving

## Backend Configuration

By default, the extension uses the hosted backend at `https://ufd.onrender.com/api/v1`.

### Running a Local Backend (Optional)

If you want to run your own backend:

1. Clone the backend repository:
   ```
   git clone https://github.com/yourusername/ufd-backend.git
   ```

2. Install the requirements:
   ```
   cd ufd-backend
   pip install -r requirements.txt
   ```

3. Start the backend server:
   ```
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

4. Switch the extension to use the local backend:
   - Right-click the extension icon and select "Inspect popup"
   - In the console, type: `localStorage.setItem("ufd_use_dev_backend", "true")`
   - Reload the extension

To switch back to the hosted backend:
   - In the console, type: `localStorage.setItem("ufd_use_dev_backend", "false")`
   - Or: `localStorage.removeItem("ufd_use_dev_backend")`

## Troubleshooting

### Common Issues

- **YouTube extraction errors**: Sometimes YouTube updates their systems, which can break yt-dlp extraction. If you see errors like "Failed to extract player response," try:
  - Waiting for a backend update (yt-dlp needs to be updated)
  - Using a different video
  - Making sure you're logged in to YouTube
  - Switching backends using the double-click toggle (see below)
  
  This error occurs when YouTube changes their website structure, which happens periodically. The backend needs to update its yt-dlp library to handle these changes. This is a common issue with all YouTube downloaders.
  
- **Authentication issues**: For age-restricted or private videos, make sure you're logged in to the platform in your browser so the extension can use your cookies.

- **Download failures**: If downloads fail, check:
  - Your internet connection
  - That you're using a supported platform and URL format
  - Browser console logs for detailed error information
  - That your backend service is running (if using a local backend)

### Switching Between Backends

If you experience issues with the Render hosted backend, you can try the following:

1. Double-click on the status text at the bottom of the popup to toggle between backends
2. Click the "Reload Extension" button that appears
3. Try your download again

Alternatively, you can use browser developer tools:
1. Right-click the extension icon and select "Inspect popup" 
2. Check the Console tab for error messages
3. The "Network" tab can show API requests to help diagnose connection issues

## License

MIT License 