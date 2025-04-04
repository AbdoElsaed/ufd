/* 
 * This is a simplified browser compatibility polyfill for extensions
 * It provides a unified API for Chrome and Firefox extensions
 */

(function() {
  if (typeof globalThis.browser !== 'undefined') {
    // Firefox already has a browser object
    return;
  }

  // Use Chrome's chrome object as the basis for the browser object
  if (typeof globalThis.chrome !== 'undefined') {
    globalThis.browser = {
      runtime: {},
      tabs: {},
      downloads: {}
    };

    // runtime.connect
    if (chrome.runtime && chrome.runtime.connect) {
      browser.runtime.connect = function(connectInfo) {
        return chrome.runtime.connect(connectInfo);
      };
    }

    // runtime.sendMessage
    if (chrome.runtime && chrome.runtime.sendMessage) {
      browser.runtime.sendMessage = function(message, responseCallback) {
        return chrome.runtime.sendMessage(message, responseCallback);
      };
    }

    // runtime.onMessage
    if (chrome.runtime && chrome.runtime.onMessage) {
      browser.runtime.onMessage = chrome.runtime.onMessage;
    }

    // tabs.query
    if (chrome.tabs && chrome.tabs.query) {
      browser.tabs.query = function(queryInfo) {
        return new Promise((resolve) => {
          chrome.tabs.query(queryInfo, (tabs) => {
            resolve(tabs);
          });
        });
      };
    }

    // downloads.download
    if (chrome.downloads && chrome.downloads.download) {
      browser.downloads.download = function(options) {
        return new Promise((resolve, reject) => {
          chrome.downloads.download(options, (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(downloadId);
            }
          });
        });
      };
    }

    // Add chrome object for compatibility
    browser.chrome = chrome;
  }
})(); 