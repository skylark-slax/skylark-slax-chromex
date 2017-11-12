'use strict';

// Do not reload the extension when an update becomes available, UNLESS the slax
// viewer is not displaying any slax files. Otherwise the tabs would close, which
// is quite disruptive (crbug.com/511670).
chrome.runtime.onUpdateAvailable.addListener(function() {
    if (chrome.extension.getViews({ type: 'tab', }).length === 0) {
        chrome.runtime.reload();
    }
});
