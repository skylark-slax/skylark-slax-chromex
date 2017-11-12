(function() {
  'use strict';

  if (!chrome.fileBrowserHandler) {
    // Not on Chromium OS, bail out
    return;
  }
  chrome.fileBrowserHandler.onExecute.addListener(onExecuteFileBrowserHandler);

  /**
   * Invoked when "Run as slax application" is chosen in the File browser.
   *
   * @param {String} id      Application launch action ID as specified in
   *                         manifest.json
   * @param {Object} details Object of type FileHandlerExecuteEventDetails
   */
  function onExecuteFileBrowserHandler(id, details) {
    if (id !== 'run-as-slax') {
      return;
    }
    var fileEntries = details.entries;
    // "tab_id" is the currently documented format, but it is inconsistent with
    // the other Chrome APIs that use "tabId" (http://crbug.com/179767)
    var tabId = details.tab_id || details.tabId;
    if (tabId > 0) {
      chrome.tabs.get(tabId, function(tab) {
        openRunner(tab && tab.windowId, fileEntries);
      });
    } else {
      // Re-use existing window, if available.
      chrome.windows.getLastFocused(function(chromeWindow) {
        var windowId = chromeWindow && chromeWindow.id;
        if (windowId) {
          chrome.windows.update(windowId, { focused: true, });
        }
        openRunner(windowId, fileEntries);
      });
    }
  }

  /**
   * Open the slax Runner for the given list of slax files.
   *
   * @param {number} windowId
   * @param {Array} fileEntries List of Entry objects (HTML5 FileSystem API)
   */
  function openRunner(windowId, fileEntries) {
    if (!fileEntries.length) {
      return;
    }
    var fileEntry = fileEntries.shift();
    var url = fileEntry.toURL();
    // Use drive: alias to get shorter (more human-readable) URLs.
    url = url.replace(/^filesystem:chrome-extension:\/\/[a-p]{32}\/external\//,
                      'drive:');
    url = getViewerURL(url);

    if (windowId) {
      chrome.tabs.create({
        windowId: windowId,
        active: true,
        url: url,
      }, function() {
        openRunner(windowId, fileEntries);
      });
    } else {
      chrome.windows.create({
        type: 'normal',
        focused: true,
        url: url,
      }, function(chromeWindow) {
        openRunner(chromeWindow.id, fileEntries);
      });
    }
  }
})();
