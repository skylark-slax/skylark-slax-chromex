'use strict';

var VIEWER_URL = chrome.extension.getURL('launcher/launcher.html');

function getViewerURL(slax_url) {
  return VIEWER_URL + '?file=' + encodeURIComponent(slax_url);
}

/**
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The property "url" is read.
 * @return {boolean} True if the slax file should be downloaded.
 */
function isSlaxDownloadable(details) {
  if (details.url.indexOf('slax.action=download') >= 0) {
    return true;
  }
  // Display the slax viewer regardless of the Content-Disposition header if the
  // file is displayed in the main frame, since most often users want to view
  // a slax, and servers are often misconfigured.
  // If the query string contains "=download", do not unconditionally force the
  // viewer to open the slax, but first check whether the Content-Disposition
  // header specifies an attachment. This allows sites like Google Drive to
  // operate correctly (#6106).
  if (details.type === 'main_frame' &&
      details.url.indexOf('=download') === -1) {
    return false;
  }
  var cdHeader = (details.responseHeaders &&
    getHeaderFromHeaders(details.responseHeaders, 'content-disposition'));
  return (cdHeader && /^attachment/i.test(cdHeader.value));
}

/**
 * Get the header from the list of headers for a given name.
 * @param {Array} headers responseHeaders of webRequest.onHeadersReceived
 * @return {undefined|{name: string, value: string}} The header, if found.
 */
function getHeaderFromHeaders(headers, headerName) {
  for (var i = 0; i < headers.length; ++i) {
    var header = headers[i];
    if (header.name.toLowerCase() === headerName) {
      return header;
    }
  }
}

/**
 * Check if the request is a slax file.
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The properties "responseHeaders" and "url"
 *                         are read.
 * @return {boolean} True if the resource is a slax file.
 */
function isSlaxFile(details) {
  var header = getHeaderFromHeaders(details.responseHeaders, 'content-type');
  if (header) {
    var headerValue = header.value.toLowerCase().split(';', 1)[0].trim();
    if (headerValue === 'application/slax') {
      return true;
    }
    if (headerValue === 'application/octet-stream') {
      if (details.url.toLowerCase().indexOf('.slax') > 0) {
        return true;
      }
      var cdHeader =
        getHeaderFromHeaders(details.responseHeaders, 'content-disposition');
      if (cdHeader && /\.slax(["']|$)/i.test(cdHeader.value)) {
        return true;
      }
    }
  }
}

/**
 * Takes a set of headers, and set "Content-Disposition: attachment".
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The property "responseHeaders" is read and
 *                         modified if needed.
 * @return {Object|undefined} The return value for the onHeadersReceived event.
 *                            Object with key "responseHeaders" if the headers
 *                            have been modified, undefined otherwise.
 */
function getHeadersWithContentDispositionAttachment(details) {
  var headers = details.responseHeaders;
  var cdHeader = getHeaderFromHeaders(headers, 'content-disposition');
  if (!cdHeader) {
    cdHeader = { name: 'Content-Disposition', };
    headers.push(cdHeader);
  }
  if (!/^attachment/i.test(cdHeader.value)) {
    cdHeader.value = 'attachment' + cdHeader.value.replace(/^[^;]+/i, '');
    return { responseHeaders: headers, };
  }
}

chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    if (details.method !== 'GET') {
      // Don't intercept POST requests until http://crbug.com/104058 is fixed.
      return;
    }
    if (!isSlaxFile(details)) {
      return;
    }
    if (isSlaxDownloadable(details)) {
      // Force download by ensuring that Content-Disposition: attachment is set
      return getHeadersWithContentDispositionAttachment(details);
    }

    var viewerUrl = getViewerURL(details.url);

    // Implemented in preserve-referer.js
    saveReferer(details);

    // Replace frame with viewer
    if (Features.webRequestRedirectUrl) {
      return { redirectUrl: viewerUrl, };
    }
    // Aww.. redirectUrl is not yet supported, so we have to use a different
    // method as fallback (Chromium <35).

    if (details.frameId === 0) {
      // Main frame. Just replace the tab and be done!
      chrome.tabs.update(details.tabId, {
        url: viewerUrl,
      });
      return { cancel: true, };
    }
    console.warn('Child frames are not supported in ancient Chrome builds!');
  },
  {
    urls: [
      '<all_urls>'
    ],
    types: ['main_frame', 'sub_frame'],
  },
  ['blocking', 'responseHeaders']);

chrome.webRequest.onBeforeRequest.addListener(
  function onBeforeRequestForFTP(details) {
    if (!Features.extensionSupportsFTP) {
      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequestForFTP);
      return;
    }
    if (isSlaxDownloadable(details)) {
      return;
    }
    var viewerUrl = getViewerURL(details.url);
    return { redirectUrl: viewerUrl, };
  },
  {
    urls: [
      'ftp://*/*.slax',
      'ftp://*/*.SLAX'
    ],
    types: ['main_frame', 'sub_frame'],
  },
  ['blocking']);

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (isSlaxDownloadable(details)) {
      return;
    }

    // NOTE: The manifest file has declared an empty content script
    // at file://*/* to make sure that the viewer can load the slax file
    // through XMLHttpRequest. Necessary to deal with http://crbug.com/302548
    var viewerUrl = getViewerURL(details.url);

    return { redirectUrl: viewerUrl, };
  },
  {
    urls: [
      'file://*/*.slax',
      'file://*/*.SLAX'
    ],
    types: ['main_frame', 'sub_frame'],
  },
  ['blocking']);

chrome.extension.isAllowedFileSchemeAccess(function(isAllowedAccess) {
  if (isAllowedAccess) {
    return;
  }
  // If the user has not granted access to file:-URLs, then the webRequest API
  // will not catch the request. It is still visible through the webNavigation
  // API though, and we can replace the tab with the viewer.
  // The viewer will detect that it has no access to file:-URLs, and prompt the
  // user to activate file permissions.
  chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
    if (details.frameId === 0 && !isSlaxDownloadable(details)) {
      chrome.tabs.update(details.tabId, {
        url: getViewerURL(details.url),
      });
    }
  }, {
    url: [{
      urlPrefix: 'file://',
      pathSuffix: '.slax',
    }, {
      urlPrefix: 'file://',
      pathSuffix: '.SLAX',
    }],
  });
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message && message.action === 'getParentOrigin') {
    // getParentOrigin is used to determine whether it is safe to embed a
    // sensitive (local) file in a frame.
    if (!sender.tab) {
      sendResponse('');
      return;
    }
    // TODO: This should be the URL of the parent frame, not the tab. But
    // chrome-extension:-URLs are not visible in the webNavigation API
    // (https://crbug.com/326768), so the next best thing is using the tab's URL
    // for making security decisions.
    var parentUrl = sender.tab.url;
    if (!parentUrl) {
      sendResponse('');
      return;
    }
    if (parentUrl.lastIndexOf('file:', 0) === 0) {
      sendResponse('file://');
      return;
    }
    // The regexp should always match for valid URLs, but in case it doesn't,
    // just give the full URL (e.g. data URLs).
    var origin = /^[^:]+:\/\/[^/]+/.exec(parentUrl);
    sendResponse(origin ? origin[1] : parentUrl);
    return true;
  }
  if (message && message.action === 'isAllowedFileSchemeAccess') {
    chrome.extension.isAllowedFileSchemeAccess(sendResponse);
    return true;
  }
  if (message && message.action === 'openExtensionsPageForFileAccess') {
    var url = 'chrome://extensions/?id=' + chrome.runtime.id;
    if (message.data.newTab) {
      chrome.tabs.create({
        windowId: sender.tab.windowId,
        index: sender.tab.index + 1,
        url: url,
        openerTabId: sender.tab.id,
      });
    } else {
      chrome.tabs.update(sender.tab.id, {
        url: url,
      });
    }
  }
});
