// Use browser API for Firefox and Chrome compatibility
const browser = window.browser || window.chrome;

// Configuration
const config = {
  debug: true,
  get API_URL() {
    const useDevBackend = localStorage.getItem('ufd_use_dev_backend') === 'true';
    const productionAPI = 'https://ufd.onrender.com/api/v1';
    const devAPI = 'http://localhost:8000/api/v1';
    
    return useDevBackend ? devAPI : productionAPI;
  },
  cookies: {
    cookieDomains: {
      youtube: ['.youtube.com', '.google.com', 'accounts.google.com', 'www.youtube.com', 'youtube.com', 'google.com', 'm.youtube.com'],
      facebook: ['.facebook.com', '.fb.com', 'www.facebook.com', 'facebook.com', 'm.facebook.com'],
      twitter: ['.twitter.com', '.x.com', 'twitter.com', 'www.twitter.com', 'x.com'],
      instagram: ['.instagram.com', '.cdninstagram.com', 'www.instagram.com', 'instagram.com'],
      tiktok: ['.tiktok.com', '.tiktokcdn.com', 'www.tiktok.com', 'tiktok.com'],
      reddit: ['.reddit.com', '.redd.it', 'www.reddit.com', 'reddit.com', 'old.reddit.com']
    },
    cookieNames: {
      youtube: [
        'SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID',
        'LOGIN_INFO', 'VISITOR_INFO1_LIVE', 'YSC', 'PREF', '__Secure-1PSIDTS', '__Secure-3PSIDTS',
        '__Secure-3PAPISID', 'SIDCC', '__Secure-1PAPISID', '__Secure-3PSIDCC', 'CONSENT'
      ],
      facebook: ['c_user', 'xs', 'fr', 'datr', 'sb', 'spin'],
      twitter: ['auth_token', 'ct0', 'twid', 'lang'],
      instagram: ['sessionid', 'ds_user_id', 'csrftoken', 'rur', 'mid'],
      tiktok: ['sessionid', 'tt_webid', 'tt_webid_v2', 'ttwid', 'msToken'],
      reddit: ['reddit_session', 'token', 'loid', 'csrf_token', 'session', 'session_tracker']
    },
    collectAllCookies: {
      youtube: true,
      facebook: true,
      twitter: true,
      instagram: true,
      tiktok: true,
      reddit: true
    }
  },
  userAgents: {
    desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    mobile: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  }
};

// Simple logging utility
const log = {
  debug: (...args) => console.debug("[UFD Background]", ...args),
  info: (...args) => console.info("[UFD Background]", ...args),
  error: (...args) => console.error("[UFD Background]", ...args),
  warn: (...args) => console.warn("[UFD Background]", ...args),
  api: (...args) => console.log("[UFD API Call]", ...args),
};

// State manager
const state = {
  ports: new Map(),
  currentDownload: null,
};

log.info("Background script initialized");
log.info(`Using API URL: ${config.API_URL}`);

// Handle connections from popup
browser.runtime.onConnect.addListener((port) => {
  try {
    log.info(`New port connection received: ${port.name}`);
    
    // Store the port
    state.ports.set(port.name, port);
    log.debug(`Port connected and stored. Total active ports: ${state.ports.size}`);
    
    // Set up message listener
    port.onMessage.addListener((message) => {
      try {
        log.debug(`Received message from port ${port.name}:`, message.type);
        
        // Handle different message types
        switch (message.type) {
          case "init":
            log.debug("Received init message, sending connection confirmation");
            
            // Check cookie API availability first
            const cookieApiAvailable = !!(browser.cookies && browser.cookies.getAll);
            
            // Send detailed connection status
            port.postMessage({ 
              type: "connected",
              status: {
                cookieApiAvailable,
                totalPorts: state.ports.size,
                backgroundReady: true,
                apiUrl: config.API_URL
              }
            });
            
            // Test cookies access right away to see if we can get YouTube cookies
            if (cookieApiAvailable) {
              browser.cookies.getAll({ domain: 'youtube.com' })
                .then(cookies => {
                  log.debug(`Quick cookie test: Found ${cookies.length} YouTube cookies`);
                  if (cookies.length === 0) {
                    log.warn('No YouTube cookies found - user may not be logged in or cookies not accessible');
                  }
                })
                .catch(err => {
                  log.error('Error in cookie test:', err);
                });
            }
            break;
            
          case "getCurrentTab":
            log.debug("Handling getCurrentTab request");
            handleGetCurrentTab(port);
            break;
            
          case "getVideoInfo":
            log.debug(`Handling getVideoInfo request for ${message.data?.url}`);
            handleGetVideoInfo(message.data, port);
            break;
            
          case "downloadVideo":
            log.debug(`Handling downloadVideo request for ${message.data?.url}`);
            handleDownloadVideo(message.data, port);
            break;
            
          default:
            log.warn(`Unknown message type received: ${message.type}`);
        }
      } catch (error) {
        log.error(`Error handling message ${message.type}:`, error);
        
        // Try to send error back to port
        try {
          if (port && state.ports.has(port.name)) {
            port.postMessage({
              type: "error",
              error: error.message || "An error occurred processing your request"
            });
          }
        } catch (e) {
          log.error("Failed to send error message to port:", e);
        }
      }
    });

    // Set up disconnect listener
    port.onDisconnect.addListener(() => {
      try {
        log.info(`Port disconnected: ${port.name}`);

        // Check for error
        const error = browser.runtime.lastError;
        if (error) {
          log.error(`Port disconnection error: ${error.message}`);
        }

        // Remove the port from the map
        state.ports.delete(port.name);
        log.debug(
          `Port removed from storage. Remaining ports: ${state.ports.size}`
        );
      } catch (e) {
        log.error("Error in disconnect handler:", e);
      }
    });
  } catch (error) {
    log.error("Error setting up port connection:", error);
  }
});

// Handler for getting current tab information
async function handleGetCurrentTab(port) {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const currentTab = tabs[0];
    log.debug("Current tab:", currentTab);

    if (!currentTab) {
      throw new Error("No active tab found");
    }

    port.postMessage({
      type: "currentTab",
      data: {
        url: currentTab.url,
        title: currentTab.title,
      },
    });
  } catch (error) {
    log.error("Error getting current tab:", error);
    port.postMessage({
      type: "error",
      error: error.message || "Failed to get current tab information",
    });
  }
}

// Helper function to get cookies for a specific platform
async function getPlatformCookies(platform) {
  try {
    if (!platform) {
      log.warn("No platform specified for cookie collection");
      return null;
    }

    if (!browser.cookies || !browser.cookies.getAll) {
      log.warn("Cookie API not available");
      return null;
    }

    log.debug(`Collecting cookies for platform: ${platform}`);

    // If we don't have domain configs for this platform, return null
    if (!config.cookies.cookieDomains[platform]) {
      log.warn(`No cookie domains configured for platform: ${platform}`);
      return null;
    }

    let allCookies = [];
    const domains = config.cookies.cookieDomains[platform];
    const cookieNames = config.cookies.cookieNames[platform] || [];
    const collectAll = config.cookies.collectAllCookies[platform] || false;

    log.debug(`Checking ${domains.length} domains for ${platform} cookies. Collect all: ${collectAll}`);
    
    // Get cookies for each domain
    for (const domain of domains) {
      try {
        const cookies = await browser.cookies.getAll({ domain });
        log.debug(`Found ${cookies.length} cookies for domain ${domain}`);
        
        // Filter by cookie names if specified and not collecting all
        if (cookieNames.length > 0 && !collectAll) {
          const filteredCookies = cookies.filter(cookie => 
            cookieNames.includes(cookie.name)
          );
          log.debug(`Filtered to ${filteredCookies.length} relevant cookies for ${domain}`);
          allCookies = [...allCookies, ...filteredCookies];
        } else {
          // Include all cookies if collectAll is true or no filter specified
          allCookies = [...allCookies, ...cookies];
        }
      } catch (err) {
        log.error(`Error getting cookies for domain ${domain}:`, err);
      }
    }

    // Log cookie names we found for debugging
    if (allCookies.length > 0) {
      const cookieNames = [...new Set(allCookies.map(c => c.name))];
      log.debug(`Cookie names found: ${cookieNames.join(', ')}`);
    }

    if (allCookies.length === 0) {
      log.warn(`No cookies found for platform: ${platform}`);
      return null;
    }

    // Remove duplicate cookies (same name)
    const uniqueCookies = [];
    const cookieMap = new Map();
    for (const cookie of allCookies) {
      if (!cookieMap.has(cookie.name)) {
        cookieMap.set(cookie.name, cookie);
        uniqueCookies.push(cookie);
      }
    }

    log.debug(`Collected ${uniqueCookies.length} unique cookies for ${platform} (from ${allCookies.length} total)`);
    log.api(`Authentication: Collected ${uniqueCookies.length} cookies for ${platform} to use with ${config.API_URL}`);

    // Format cookies for header
    const cookieHeader = uniqueCookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    return cookieHeader;
  } catch (error) {
    log.error("Error getting platform cookies:", error);
    return null;
  }
}

// Get basic authentication status based on current tab
async function getAuthStatus(platform) {
  try {
    // Get the current tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) {
      log.warn("No active tab found for auth check");
      return null;
    }
    
    // Only perform check if tab is on the relevant domain
    const url = tabs[0].url;
    const domainMatch = {
      youtube: /(youtube\.com|youtu\.be)/i,
      reddit: /reddit\.com/i,
      facebook: /(facebook\.com|fb\.watch)/i,
      twitter: /(twitter\.com|x\.com)/i,
      instagram: /instagram\.com/i,
      tiktok: /tiktok\.com/i
    };
    
    if (!domainMatch[platform] || !domainMatch[platform].test(url)) {
      log.debug(`Current tab (${url}) is not on ${platform} domain, skipping auth check`);
      return null;
    }
    
    // Execute script to get basic info about authentication status
    const results = await browser.tabs.executeScript(tabs[0].id, {
      code: `
        // Return authentication information
        (function() {
          const info = {};
          
          if (window.location.host.includes('youtube.com')) {
            info.isLoggedIn = !!document.querySelector('ytd-masthead #avatar-btn');
            info.isAgeRestricted = !!document.querySelector('.ytd-player-error-message-renderer');
            info.title = document.title;
            info.videoElement = !!document.querySelector('video');
            info.userAgent = navigator.userAgent;
          } else if (window.location.host.includes('reddit.com')) {
            info.isLoggedIn = !!document.querySelector('header [data-testid="reddit-avatar"]');
            info.title = document.title;
            info.userAgent = navigator.userAgent;
          }
          
          return info;
        })();
      `
    });
    
    if (results && results[0]) {
      log.debug(`Authentication status for ${platform}:`, results[0]);
      return results[0];
    }
    
    return null;
  } catch (error) {
    log.error(`Error getting auth status: ${error}`);
    return null;
  }
}

// Handler for getting video information
async function handleGetVideoInfo(data, port) {
  try {
    log.info("Getting video info for:", data.url);
    
    // Get basic authentication status
    const authStatus = await getAuthStatus(data.platform);
    if (authStatus) {
      log.info(`Got auth status for ${data.platform}: logged in = ${authStatus.isLoggedIn}`);
      data.authInfo = authStatus;
    }

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": config.userAgents.desktop // Use a consistent user agent
    };

    // Try to get cookies for the platform
    let cookieHeader = null;
    try {
      log.debug(`Collecting authentication cookies for ${data.platform}...`);
      cookieHeader = await getPlatformCookies(data.platform);
      
      if (cookieHeader) {
        headers["Cookie"] = cookieHeader;
        // Log cookie header length for debugging, but not the actual content for privacy
        log.info(`Added cookie header with length: ${cookieHeader.length} characters`);
        
        // Add referer header for better authentication (especially for YouTube and Reddit)
        if (data.platform === 'youtube') {
          headers["Referer"] = "https://www.youtube.com/";
          headers["Origin"] = "https://www.youtube.com";
          headers["X-YouTube-Client-Name"] = "1";
          headers["X-YouTube-Client-Version"] = "2.20240401.00.00";
        } else if (data.platform === 'reddit') {
          headers["Referer"] = "https://www.reddit.com/";
          headers["Origin"] = "https://www.reddit.com";
        }
      } else {
        log.warn(`No cookies collected for ${data.platform} - authentication may fail`);
      }
    } catch (cookieError) {
      log.error("Error collecting cookies:", cookieError);
      // Continue without cookies
    }

    log.info(`Sending request to ${config.API_URL}/download/info`);
    log.debug(`Request headers: ${Object.keys(headers).join(', ')}`);

    const response = await fetch(`${config.API_URL}/download/info`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      credentials: 'omit' // Don't send browser credentials automatically, we handle cookies manually
    });

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          if (typeof errorData.detail === "object" && errorData.detail.error) {
            errorMessage = errorData.detail.error;
          } else if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          }
        }
        
        // Handle specific errors with friendly messages
        if (errorMessage.includes("Sign in to confirm you're not a bot")) {
          log.warn("Authentication required error detected");
          errorMessage = "YouTube requires sign-in for this video. Please sign in to your YouTube account in the browser first.";
        } else if (errorMessage.includes("This video is private")) {
          errorMessage = "This video is private and cannot be accessed.";
        } else if (errorMessage.includes("Video unavailable")) {
          errorMessage = "This video is unavailable or may have been removed.";
        } else if (errorMessage.includes("Failed to extract any player response") || 
                   errorMessage.includes("yt-dlp") || 
                   errorMessage.includes("DownloadError")) {
          log.warn("yt-dlp extraction error detected:", errorMessage);
          errorMessage = "Failed to extract video information. YouTube may have updated their systems. Please try a different video or try again later.";
        }
      } catch (e) {
        log.error("Error parsing error response:", e);
      }

      log.error("Error getting video info:", errorMessage);
      
      if (port && state.ports.has(port.name)) {
        port.postMessage({
          type: "error",
          error: errorMessage,
        });
      }
      
      throw new Error(errorMessage);
    }

    const videoInfo = await response.json();
    log.info("Video info received successfully");

    if (port && state.ports.has(port.name)) {
      port.postMessage({
        type: "videoInfo",
        data: videoInfo,
      });
    }
  } catch (error) {
    log.error("Error getting video info:", error);
    
    if (port && state.ports.has(port.name)) {
      port.postMessage({
        type: "error",
        error: error.message || "Failed to get video information",
      });
    }
  }
}

// Handler for downloading video
async function handleDownloadVideo(data, port) {
  try {
    log.info("Starting download for:", data.url);

    // Notify about download start
    if (port && state.ports.has(port.name)) {
      port.postMessage({
        type: "downloadStatus",
        data: {
          status: "starting",
          progress: 0,
        },
      });
    }

    // Get basic authentication status
    const authStatus = await getAuthStatus(data.platform);
    if (authStatus) {
      log.info(`Got auth status for ${data.platform}: logged in = ${authStatus.isLoggedIn}`);
      data.authInfo = authStatus;
    }
    
    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": config.userAgents.desktop // Use a consistent user agent
    };

    // Try to get cookies for the platform
    let cookieHeader = null;
    try {
      log.debug(`Collecting authentication cookies for ${data.platform}...`);
      cookieHeader = await getPlatformCookies(data.platform);
      
      if (cookieHeader) {
        headers["Cookie"] = cookieHeader;
        // Log cookie header length for debugging, but not the actual content for privacy
        log.info(`Added cookie header with length: ${cookieHeader.length} characters`);
        
        // Add referer header for better authentication (especially for YouTube and Reddit)
        if (data.platform === 'youtube') {
          headers["Referer"] = "https://www.youtube.com/";
          headers["Origin"] = "https://www.youtube.com";
          headers["X-YouTube-Client-Name"] = "1";
          headers["X-YouTube-Client-Version"] = "2.20240401.00.00";
        } else if (data.platform === 'reddit') {
          headers["Referer"] = "https://www.reddit.com/";
          headers["Origin"] = "https://www.reddit.com";
        }
      } else {
        log.warn(`No cookies collected for ${data.platform} - authentication may fail`);
      }
    } catch (cookieError) {
      log.error("Error collecting cookies:", cookieError);
      // Continue without cookies
    }

    log.info(`Sending download request to ${config.API_URL}/download/start`);
    log.debug(`Request headers: ${Object.keys(headers).join(', ')}`);

    // Start the download via API
    const response = await fetch(`${config.API_URL}/download/start`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      credentials: 'omit' // Don't send browser credentials automatically, we handle cookies manually
    });

    log.info(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          if (typeof errorData.detail === "object" && errorData.detail.error) {
            errorMessage = errorData.detail.error;
          } else if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          }
        }
        
        // Handle specific errors with friendly messages
        if (errorMessage.includes("Sign in to confirm you're not a bot")) {
          log.warn("Authentication required error detected");
          errorMessage = "YouTube requires sign-in for this video. Please sign in to your YouTube account in the browser first.";
        } else if (errorMessage.includes("This video is private")) {
          errorMessage = "This video is private and cannot be accessed.";
        } else if (errorMessage.includes("Video unavailable")) {
          errorMessage = "This video is unavailable or may have been removed.";
        } else if (errorMessage.includes("Failed to extract any player response") || 
                   errorMessage.includes("yt-dlp") || 
                   errorMessage.includes("DownloadError")) {
          log.warn("yt-dlp extraction error detected:", errorMessage);
          errorMessage = "Failed to extract video information. YouTube may have updated their systems. Please try a different video or try again later.";
        }
      } catch (e) {
        log.error("Error parsing error response:", e);
      }

      throw new Error(errorMessage);
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get("content-disposition");
    let filename = "download.mp4";
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      } else {
        const altMatch = contentDisposition.match(/filename=([^;]+)/);
        if (altMatch && altMatch[1]) {
          filename = altMatch[1].trim();
        }
      }
    }
    
    filename = filename.replace(/[/\\?%*:|"<>]/g, '-');
    
    if (!filename.includes('.')) {
      const isAudio = data.format === 'audio';
      filename += isAudio ? '.m4a' : '.mp4';
    }

    // Process the response
    let blob;
    
    try {
      blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("Received empty response from server");
      }
      log.info(`Blob created with size: ${blob.size} bytes`);
    } catch (blobError) {
      log.error("Error processing response:", blobError);
      throw blobError;
    }
    
    // Create object URL and download
    const downloadUrl = URL.createObjectURL(blob);
    
    try {
      log.info(`Starting download for ${filename}`);
      const downloadId = await browser.downloads.download({
        url: downloadUrl,
        filename: filename,
        saveAs: true
      });
      
      log.info(`Download started with ID: ${downloadId}`);
      
      // Update UI to completed state
      if (port && state.ports.has(port.name)) {
        port.postMessage({
          type: "downloadStatus",
          data: {
            status: "completed",
            progress: 100,
            filename: filename,
          },
        });
      }
      
      // Clean up the object URL after a delay
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      
    } catch (downloadError) {
      log.error("Browser download API error:", downloadError);
      
      // Try alternative approach
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
      
      // Notify the popup
      if (port && state.ports.has(port.name)) {
        port.postMessage({
          type: "downloadStatus",
          data: {
            status: "completed",
            progress: 100,
            filename: filename,
          },
        });
      }
    }
  } catch (error) {
    log.error("Error downloading video:", error);
    
    // Notify about download error
    if (port && state.ports.has(port.name)) {
      port.postMessage({
        type: "downloadStatus",
        data: {
          status: "error",
          error: error.message || "Failed to download video",
        },
      });
    }
  }
}
