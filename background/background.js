'use strict';

(function PageActionClosure() {
  /**
   * @param {number} tabId - ID of tab where the page action will be shown.
   * @param {string} url - URL to be displayed in page action.
   */
  function showPageAction(tabId, displayUrl) {
    // rewriteUrlClosure in viewer.js ensures that the URL looks like
    // chrome-extension://[extensionid]/http://example.com/file.slax
    var url = /^chrome-extension:\/\/[a-p]{32}\/([^#]+)/.exec(displayUrl);
    if (url) {
      url = url[1];
      chrome.pageAction.setPopup({
        tabId: tabId,
        popup: '/pageAction/popup.html?file=' + encodeURIComponent(url),
      });
      chrome.pageAction.show(tabId);
    } else {
      console.log('Unable to get slax url from ' + displayUrl);
    }
  }

  chrome.runtime.onMessage.addListener(function(message, sender) {
    if (message === 'showPageAction' && sender.tab) {
      showPageAction(sender.tab.id, sender.tab.url);
    }
  });
})();
