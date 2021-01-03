"use strict";

let googleApiKey;

chrome.runtime.onMessage.addListener((msg, sender, callback) => {
  if (!msg.cmd) return;
  switch (msg.cmd) {
    case "tab":
      chrome.storage.local.set({
        tab: sender.tab.id
      });
      return;
    case "login":
      if (googleApiKey) {
        chrome.identity.removeCachedAuthToken({
          token: googleApiKey
        }, () => {
          auth(msg.interactive, callback);
        })
      } else {
        auth(msg.interactive, callback);
      }
      return true;
    default:
      return;
  }
});

function auth(interactive, callback) {
  chrome.identity.getAuthToken({
    interactive: interactive
  }, function (token) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError);
      callback(null);
    } else {
      chrome.storage.sync.set({
        googleApiKey: token
      });
      console.log(`token updated: ${token}`);
      callback(token);
    }
  });
}