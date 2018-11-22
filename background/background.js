"use strict";

let accessToken;

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            urlContains: 'script.google.com'
          }
        })
      ],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, callback) => {
  if (!msg.cmd) return;
  switch (msg.cmd) {
    case "tab":
      chrome.storage.local.set({
        tab: sender.tab.id
      });
      return;
    case "login":
      if (accessToken) {
        chrome.identity.removeCachedAuthToken({token: accessToken}, () => {
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

chrome.webRequest.onBeforeRequest.addListener((details) => {
    const body = String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes));
    if (body.indexOf('getInitialEditorState') > 0) {
      const match = body.match(/gwt\/\|(\w+)\|\_\|getInitialEditorState/);
      if (match && match[1]) {
        chrome.storage.local.set({
          gasToken: match[1],
          requestBody: body
        });
      }
    }
  }, {
    urls: ["https://script.google.com/*/gwt/ideService"],
    types: ["xmlhttprequest"]
  },
  [
    "requestBody"
  ]);

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    const needHeaders = [
      'X-Framework-Xsrf-Token',
      'Lib-id',
      'Content-Type',
      'X-GWT-Permutation',
      'X-GWT-Module-Base',
      'X-Client-Data'
    ];
    const headers = details.requestHeaders
      .filter((header) => {
        if (needHeaders.indexOf(header.name) >= 0) return header;
      })
      .reduce((hash, header) => {
        hash[header.name] = header.value;
        return hash;
      }, {});
    chrome.storage.local.set({
      requestUrl: details.url,
      requestHeaders: headers
    });
    console.log(headers);
  }, {
    urls: ["https://script.google.com/*/gwt/ideService"],
    types: ["xmlhttprequest"]
  },
  [
    "requestHeaders"
  ]);

function auth(interactive, callback) {
  chrome.identity.getAuthToken({interactive: interactive}, function (token) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError);
      callback(null);
    } else {
      chrome.storage.sync.set({
        accessToken: token
      });
      console.log(`token updated: ${token}`);
      callback(token);
    }
  });
}