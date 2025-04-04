// Use browser API for Firefox and Chrome compatibility
const browser = window.browser || window.chrome;

// Configuration
const config = {
  debug: true,
  connectionTimeout: 2000,
  autoStartDownload: false, // Set to true to automatically start download when platform is detected
  autoFetchVideoInfo: true, // Automatically fetch video info when platform is detected
  platformMappings: {
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "facebook.com": "facebook",
    "fb.watch": "facebook",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "instagram.com": "instagram",
    "tiktok.com": "tiktok",
    "reddit.com": "reddit",
  },
  platformColors: {
    youtube: "#FF0000",
    facebook: "#1877F2",
    twitter: "#1DA1F2",
    instagram: "#E1306C",
    tiktok: "#000000",
    reddit: "#FF4500",
  },
};

// Logging utility
const log = {
  debug: (...args) => config.debug && console.log("[UFD Popup]", ...args),
  error: (...args) => console.error("[UFD Popup]", ...args),
  info: (...args) => console.info("[UFD Popup]", ...args),
  warn: (...args) => console.warn("[UFD Popup]", ...args),
};

// State manager
const state = {
  currentUrl: null,
  currentTitle: null,
  videoInfo: null,
  detectedPlatform: null,
  isConnected: false,
  isDownloading: false,
  downloadProgress: 0,
};

// UI elements
let elements;

// Connection manager
class ConnectionManager {
  constructor() {
    this.port = null;
    this.connected = false;
    this.connectionPromise = null;
    this.listeners = new Map();
    this.reconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 1000;
    this.apiUrl = null; // Track the API URL

    log.debug("Connection manager initialized");
  }

  connect() {
    if (this.connected && this.port) {
      log.debug("Already connected to background script");
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      log.debug("Connection already in progress");
      return this.connectionPromise;
    }

    this.reconnecting = this.reconnectAttempts > 0;
    log.debug(
      `${
        this.reconnecting ? "Reconnecting" : "Connecting"
      } to background script (attempt ${this.reconnectAttempts + 1})`
    );

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const portName = `ufd_popup_${Date.now()}_${Math.floor(
          Math.random() * 10000
        )}`;
        log.debug(`Creating port with name: ${portName}`);

        this.port = browser.runtime.connect({ name: portName });

        // Set up message listener
        this.port.onMessage.addListener(this.handleMessage.bind(this));

        // Set up disconnection listener
        this.port.onDisconnect.addListener(() => {
          const error = browser.runtime.lastError;
          log.debug(
            "Port disconnected",
            error ? `Error: ${error.message}` : ""
          );

          this.connected = false;
          this.port = null;
          this.connectionPromise = null;

          // Try to reconnect automatically if not manually disconnecting
          this.attemptReconnect();

          // Call any registered disconnect listeners
          if (this.listeners.has("disconnect")) {
            this.listeners
              .get("disconnect")
              .forEach((callback) => callback(error));
          }
        });

        // Send init message
        log.debug("Sending init message");
        this.port.postMessage({ type: "init" });

        // Set up connection timeout
        const timeoutId = setTimeout(() => {
          if (!this.connected) {
            log.error("Connection timeout");
            reject(new Error("Connection timeout"));
          }
        }, config.connectionTimeout);

        // Create a one-time listener for connection confirmation
        const confirmListener = (message) => {
          if (message.type === "connected") {
            log.debug("Connection confirmed by background script");
            
            if (message.status) {
              log.debug("Connection status details:", message.status);
              
              // Store the API URL
              if (message.status.apiUrl) {
                this.apiUrl = message.status.apiUrl;
                log.info(`Connected to backend API: ${this.apiUrl}`);
                
                // Update the UI with the API URL once elements are available
                setTimeout(() => {
                  if (elements && elements.statusText) {
                    elements.statusText.textContent = `Connected to: ${this.apiUrl}`;
                  }
                }, 500);
              }
              
              // Check cookie API availability and show a warning if needed
              if (!message.status.cookieApiAvailable) {
                log.error("Cookie API not available - authentication will fail!");
                setTimeout(() => {
                  // Display this warning in the UI once elements are available
                  if (elements && elements.errorText) {
                    showError("Cookie access is unavailable. Authentication with YouTube may not work properly. Please make sure you've granted the extension permission to access website data.");
                  }
                }, 500);
              }
            }
            
            clearTimeout(timeoutId);
            this.connected = true;
            this.reconnectAttempts = 0;
            resolve();

            // Remove this one-time listener
            this.removeMessageListener("message", confirmListener);
          }
        };

        // Add the confirmation listener
        this.addMessageListener("message", confirmListener);
      } catch (error) {
        log.error("Error connecting to background script:", error);
        reject(error);
        this.attemptReconnect();
      }
    });

    // Clear the promise if it fails
    this.connectionPromise.catch(() => {
      this.connectionPromise = null;
      this.attemptReconnect();
    });

    return this.connectionPromise;
  }

  // Attempt to reconnect with exponential backoff
  attemptReconnect() {
    if (this.reconnecting) return;

    this.reconnecting = true;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      log.debug(
        `Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
      );

      setTimeout(() => {
        this.reconnecting = false;
        if (!this.connected) {
          this.connect().catch((err) => {
            log.error("Reconnection failed:", err);
          });
        }
      }, delay);
    } else {
      log.error(
        `Max reconnection attempts (${this.maxReconnectAttempts}) reached`
      );
      this.reconnecting = false;
    }
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto reconnect
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (error) {
        log.error("Error disconnecting port:", error);
      }
    }

    this.connected = false;
    this.port = null;
    this.connectionPromise = null;
  }

  handleMessage(message) {
    log.debug("Received message from background:", message);

    // Call any registered message listeners
    if (this.listeners.has("message")) {
      this.listeners.get("message").forEach((callback) => callback(message));
    }

    // Call specific message type listeners
    if (message.type && this.listeners.has(message.type)) {
      this.listeners.get(message.type).forEach((callback) => callback(message));
    }
  }

  addMessageListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type).add(callback);
  }

  removeMessageListener(type, callback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(callback);
    }
  }

  async sendMessage(message) {
    if (!this.connected || !this.port) {
      await this.connect();
    }

    log.debug("Sending message to background:", message);
    this.port.postMessage(message);
  }
}

// Create connection manager instance
const connection = new ConnectionManager();

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  log.debug("Popup opened");

  // Get UI elements
  elements = {
    urlDisplay: document.getElementById("urlDisplay"),
    platformBadge: document.getElementById("platformBadge"),
    format: document.getElementById("format"),
    quality: document.getElementById("quality"),
    downloadButton: document.getElementById("downloadButton"),
    progressContainer: document.getElementById("progressContainer"),
    progressBar: document.getElementById("progressBar"),
    statusText: document.getElementById("statusText"),
    errorText: document.getElementById("errorText"),
    videoInfoContainer: document.getElementById("videoInfoContainer"),
    videoThumbnail: document.getElementById("videoThumbnail"),
    videoTitle: document.getElementById("videoTitle"),
    videoDuration: document.getElementById("videoDuration"),
  };

  // Set up event listeners
  elements.format.addEventListener("change", handleFormatChange);
  elements.downloadButton.addEventListener("click", handleDownload);

  // Set up connection message listeners
  connection.addMessageListener("currentTab", handleCurrentTabMessage);
  connection.addMessageListener("videoInfo", handleVideoInfoMessage);
  connection.addMessageListener("downloadStatus", handleDownloadStatusMessage);
  connection.addMessageListener("error", handleErrorMessage);
  connection.addMessageListener("disconnect", handleDisconnection);

  // Try to connect and get current tab info
  try {
    await connection.connect();
    state.isConnected = true;
    elements.statusText.textContent = "Connected";

    // Get current tab information
    connection.sendMessage({ type: "getCurrentTab" });
  } catch (error) {
    state.isConnected = false;
    log.error("Failed to connect to background script:", error);
    showError(
      "Failed to connect to extension background script. Please try refreshing the popup."
    );
  }

  // Setup backend status display
  updateBackendStatusDisplay();
});

// Clean up on unload
window.addEventListener("unload", () => {
  log.debug("Popup closing");
  connection.disconnect();
});

// Format change handler
function handleFormatChange() {
  const isAudio = elements.format.value === "audio";

  // If audio is selected, set quality to highest and disable the select
  if (isAudio) {
    elements.quality.value = "highest";
    elements.quality.disabled = true;
  } else {
    elements.quality.disabled = false;
  }

  updateUI();
}

// Handle download button click
async function handleDownload() {
  if (!state.currentUrl || !state.detectedPlatform) {
    showError("Invalid URL or unsupported platform");
    return;
  }

  // Clear previous info and errors
  hideElement(elements.errorText);
  elements.statusText.textContent = "Starting download...";

  // Show loading indicator in button
  const buttonText = elements.downloadButton.querySelector("span");
  buttonText.innerHTML = '<div class="loader"></div> Starting download...';

  // Show progress bar
  elements.progressBar.style.width = "0%";
  showElement(elements.progressContainer);

  // Disable download button while downloading
  elements.downloadButton.disabled = true;
  state.isDownloading = true;

  try {
    // Create request data
    const data = {
      url: state.currentUrl,
      platform: state.detectedPlatform,
      format: elements.format.value,
      quality: elements.quality.value,
    };

    // Send message to background script
    await connection.sendMessage({
      type: "downloadVideo",
      data: data,
    });
  } catch (error) {
    log.error("Error sending downloadVideo request:", error);
    showError("Failed to send download request");
    elements.downloadButton.disabled = false;
    state.isDownloading = false;
    buttonText.textContent = "Download";
  }
}

// Handle current tab message
function handleCurrentTabMessage(message) {
  const { url, title } = message.data;

  state.currentUrl = url;
  state.currentTitle = title;

  // Display URL
  elements.urlDisplay.textContent = url;

  // Detect platform from URL
  const platform = detectPlatform(url);
  state.detectedPlatform = platform;

  if (platform) {
    // Update platform badge
    elements.platformBadge.textContent =
      platform.charAt(0).toUpperCase() + platform.slice(1);
    elements.platformBadge.style.backgroundColor = `${config.platformColors[platform]}20`; // 20% opacity
    elements.platformBadge.style.color = config.platformColors[platform];
    showElement(elements.platformBadge);

    // Auto-fetch video info if configured
    if (config.autoFetchVideoInfo) {
      getVideoInfo();
    }
  } else {
    hideElement(elements.platformBadge);
  }

  // Update UI based on detected platform
  updateUI();
}

// Get video info - automatically called after platform detection
async function getVideoInfo() {
  if (!state.currentUrl || !state.detectedPlatform) {
    elements.statusText.textContent = "Unsupported platform";
    return;
  }

  // Clear previous info
  hideElement(elements.videoInfoContainer);
  hideElement(elements.errorText);
  elements.statusText.textContent = "Fetching video information...";

  try {
    // Log API URL (if available from connection)
    if (connection.apiUrl) {
      log.info(`Fetching video info using API: ${connection.apiUrl}`);
      elements.statusText.textContent = `Fetching info via ${connection.apiUrl}...`;
    } else {
      log.warn("API URL not available from connection");
    }

    // Create request data
    const data = {
      url: state.currentUrl,
      platform: state.detectedPlatform,
      format: elements.format.value,
      quality: elements.quality.value,
    };

    // Send message to background script
    await connection.sendMessage({
      type: "getVideoInfo",
      data: data,
    });
  } catch (error) {
    log.error("Error sending getVideoInfo request:", error);
    showError("Failed to get video information");
    elements.downloadButton.disabled = false;
  }
}

// Handle video info message
function handleVideoInfoMessage(message) {
  const videoInfo = message.data;
  state.videoInfo = videoInfo;

  // Clear status
  elements.statusText.textContent = "";

  // Show video info container
  if (videoInfo.thumbnail) {
    elements.videoThumbnail.src = videoInfo.thumbnail;
    showElement(elements.videoInfoContainer);
  }

  elements.videoTitle.textContent = videoInfo.title;

  // Format duration if available
  if (videoInfo.duration) {
    const minutes = Math.floor(videoInfo.duration / 60);
    const seconds = Math.floor(videoInfo.duration % 60);
    elements.videoDuration.textContent = `Duration: ${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
  } else {
    elements.videoDuration.textContent = "";
  }

  // Enable download button
  elements.downloadButton.disabled = false;
  elements.statusText.textContent = "Ready to download";

  // Auto-start download if configured
  if (config.autoStartDownload) {
    handleDownload();
  }
}

// Handle download status message
function handleDownloadStatusMessage(message) {
  const { status, progress, error, filename } = message.data;
  const buttonText = elements.downloadButton.querySelector("span");

  switch (status) {
    case "starting":
      elements.statusText.textContent = "Preparing download...";
      elements.progressBar.style.width = "10%";
      buttonText.innerHTML = '<div class="loader"></div> Preparing...';
      break;

    case "progress":
      elements.statusText.textContent = `Downloading: ${progress}%`;
      elements.progressBar.style.width = `${progress}%`;
      buttonText.innerHTML = '<div class="loader"></div> Downloading...';
      break;

    case "completed":
      elements.statusText.textContent = `Download complete${
        filename ? `: ${filename}` : "!"
      }`;
      elements.progressBar.style.width = "100%";
      elements.downloadButton.disabled = false;
      state.isDownloading = false;
      buttonText.textContent = "Download Complete";

      // Reset button after a delay
      setTimeout(() => {
        buttonText.textContent = "Download";
      }, 3000);

      // Hide progress bar after a delay
      setTimeout(() => {
        if (!state.isDownloading) {
          hideElement(elements.progressContainer);
        }
      }, 3000);
      break;

    case "error":
      // Hide progress bar
      hideElement(elements.progressContainer);
      
      // Enable download button
      elements.downloadButton.disabled = false;
      state.isDownloading = false;
      buttonText.textContent = "Retry Download";
      
      // Show specific error messages based on the error type
      if (error && error.includes("interrupted")) {
        showError("Download was interrupted. This can happen if you canceled the download or if there was a browser issue.");
        
        // Create a retry button directly under the error message
        const retryButton = document.createElement("button");
        retryButton.textContent = "Try download again";
        retryButton.className = "error-action";
        retryButton.onclick = handleDownload;
        
        // Insert after error text
        const errorElement = elements.errorText;
        if (errorElement.nextSibling) {
          errorElement.parentNode.insertBefore(retryButton, errorElement.nextSibling);
        } else {
          errorElement.parentNode.appendChild(retryButton);
        }
      } else if (error && error.includes("network")) {
        showError(`Network error during download: ${error}. Check your internet connection and try again.`);
      } else if (error && error.includes("permission")) {
        showError(`Permission denied: ${error}. Make sure the extension has download permissions.`);
      } else {
        showError(`Download failed: ${error || "Unknown error"}`);
      }
      break;
  }
}

// Handle error message
function handleErrorMessage(message) {
  const error = message.error || "Unknown error";

  // Special messages for common YouTube errors
  if (
    error.includes("Sign in to confirm you're not a bot") ||
    error.includes("YouTube requires sign-in")
  ) {
    showError(
      "YouTube requires authentication. Please make sure you are signed in to YouTube in your browser, then try again. We will try to use your cookies for authentication."
    );
    
    // Add a direct sign-in button if the platform is YouTube
    if (state.detectedPlatform === "youtube") {
      const signInButton = document.createElement("button");
      signInButton.textContent = "Open YouTube to sign in";
      signInButton.className = "error-action";
      signInButton.onclick = () => browser.tabs.create({ url: "https://youtube.com/signin" });
      
      // Insert after error text
      const errorElement = elements.errorText;
      if (errorElement.nextSibling) {
        errorElement.parentNode.insertBefore(signInButton, errorElement.nextSibling);
      } else {
        errorElement.parentNode.appendChild(signInButton);
      }
    }
    
    elements.statusText.textContent = "Waiting for retry...";
  } else if (error.includes("Failed to extract any player response") || error.includes("yt-dlp") || error.includes("DownloadError")) {
    // This is a specific yt-dlp extraction error
    showError(
      "The backend is having trouble extracting this video. This may be due to YouTube's updates or restrictions. Please try the following:\n\n" + 
      "1. Try a different video\n" +
      "2. Make sure you're signed in to YouTube\n" +
      "3. Try again later as the backend may need to be updated"
    );

    // Add a button to open the video in the browser
    const openButton = document.createElement("button");
    openButton.textContent = "Open video in browser";
    openButton.className = "error-action";
    openButton.onclick = () => browser.tabs.create({ url: state.currentUrl });
    
    // Insert after error text
    const errorElement = elements.errorText;
    if (errorElement.nextSibling) {
      errorElement.parentNode.insertBefore(openButton, errorElement.nextSibling);
    } else {
      errorElement.parentNode.appendChild(openButton);
    }
    
    elements.statusText.textContent = "Extraction error";
  } else if (error.includes("sign in") && state.detectedPlatform) {
    showError(
      `${state.detectedPlatform} requires authentication. Please make sure you are signed in to ${state.detectedPlatform} in your browser, then try again.`
    );
    elements.statusText.textContent = "Waiting for retry...";
  } else if (error.includes("API") || error.includes("Server error")) {
    showError(`Server error: ${error}\nPlease try again later.`);
    
    // Add a reload button
    const reloadButton = document.createElement("button");
    reloadButton.textContent = "Reload extension";
    reloadButton.className = "error-action";
    reloadButton.onclick = () => window.location.reload();
    
    // Insert after error text
    const errorElement = elements.errorText;
    if (errorElement.nextSibling) {
      errorElement.parentNode.insertBefore(reloadButton, errorElement.nextSibling);
    } else {
      errorElement.parentNode.appendChild(reloadButton);
    }
  } else if (error.includes("network") || error.includes("fetch") || error.includes("Failed to fetch")) {
    showError(`Network error: ${error}\nPlease check your internet connection and make sure the backend server is running at ${connection.apiUrl || "the configured URL"}.`);
  } else {
    showError(error);
  }

  elements.downloadButton.disabled = false;
  state.isDownloading = false;
  const buttonText = elements.downloadButton.querySelector("span");
  buttonText.textContent = "Retry Download";
}

// Simple error display
function showError(message) {
  elements.errorText.textContent = message;
  showElement(elements.errorText);
  elements.statusText.textContent = "";

  // Remove any existing action buttons
  const existingButton = elements.errorText.nextElementSibling;
  if (existingButton && existingButton.classList.contains("error-action")) {
    existingButton.remove();
  }
}

// Handle disconnection
function handleDisconnection(error) {
  state.isConnected = false;

  if (error) {
    showError(`Connection to extension lost: ${error.message}`);
  } else {
    showError("Connection to extension lost. Please refresh the popup.");
  }

  elements.downloadButton.disabled = true;
}

// Detect platform from URL
function detectPlatform(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check each platform domain
    for (const [domain, platform] of Object.entries(config.platformMappings)) {
      if (hostname.includes(domain)) {
        return platform;
      }
    }

    return null;
  } catch (error) {
    log.error("Error parsing URL:", error);
    return null;
  }
}

// Update UI based on state
function updateUI() {
  // Enable/disable buttons based on URL and platform
  const validUrl = !!state.currentUrl;
  const supportedPlatform = !!state.detectedPlatform;

  elements.downloadButton.disabled =
    !validUrl ||
    !supportedPlatform ||
    !state.isConnected ||
    state.isDownloading;

  // Update status text
  if (!validUrl) {
    elements.statusText.textContent = "Invalid URL";
  } else if (!supportedPlatform) {
    elements.statusText.textContent = "Unsupported platform";
  } else if (!state.isConnected) {
    elements.statusText.textContent = "Not connected to extension";
  } else if (!state.videoInfo) {
    elements.statusText.textContent = "Getting video info...";
  } else {
    elements.statusText.textContent = "Ready to download";
  }

  // Update backend status display
  updateBackendStatusDisplay();
}

// Hide element
function hideElement(element) {
  element.classList.add("hidden");
}

// Show element
function showElement(element) {
  element.classList.remove("hidden");
}

// Setup backend status display
function updateBackendStatusDisplay() {
  try {
    // Check localStorage for backend preference
    const usingDevBackend = localStorage.getItem("ufd_use_dev_backend") === "true";
    
    // Get the status text element
    const statusTextElement = document.getElementById("statusText");
    if (statusTextElement) {
      const currentBackend = usingDevBackend ? "Development (localhost:8000)" : "Production (Render)";
      statusTextElement.textContent = `Status: ${state.connectionStatus || "Disconnected"} | Backend: ${currentBackend}`;
      
      // Add double-click handler to toggle backend
      statusTextElement.title = "Double-click to toggle between production and development backend";
      statusTextElement.style.cursor = "pointer";
      
      if (!statusTextElement.hasDBClickListener) {
        statusTextElement.addEventListener("dblclick", toggleBackend);
        statusTextElement.hasDBClickListener = true;
      }
    }
  } catch (e) {
    console.error("Error updating backend status:", e);
  }
}

// Toggle between development and production backend
function toggleBackend() {
  try {
    const currentSetting = localStorage.getItem("ufd_use_dev_backend") === "true";
    localStorage.setItem("ufd_use_dev_backend", !currentSetting);
    
    const statusTextElement = document.getElementById("statusText");
    if (statusTextElement) {
      const newBackend = !currentSetting ? "Development (localhost:8000)" : "Production (Render)";
      statusTextElement.textContent = `Status: ${state.connectionStatus || "Disconnected"} | Backend: ${newBackend}`;
      
      // Show reload instruction
      showError("Backend changed to " + newBackend + ". Please reload the extension to apply this change.");
      
      // Create reload button
      const reloadButton = document.createElement("button");
      reloadButton.textContent = "Reload Extension";
      reloadButton.className = "error-action";
      reloadButton.addEventListener("click", () => {
        browser.runtime.reload();
      });
      
      // Add reload button
      const errorElement = elements.errorText;
      if (errorElement.nextSibling) {
        errorElement.parentNode.insertBefore(reloadButton, errorElement.nextSibling);
      } else {
        errorElement.parentNode.appendChild(reloadButton);
      }
    }
  } catch (e) {
    console.error("Error toggling backend:", e);
  }
}
