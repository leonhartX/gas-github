"use strict";
let head = document.getElementsByTagName('head')[0];
let script = document.createElement('script');
script.type = 'text/javascript';
script.src = "https://apis.google.com/js/client.js?onload=callbackFunction";
head.appendChild(script);

function requestGapi(param, callback) {
  new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ 'interactive': true }, (token) => {
      resolve(token);
    });
  })
  .then((token) => {
    Object.assign(param, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    return gapi.client.request(param);
  })
  .then((response) => {
    callback(response);
  })
  .catch((err) => {
    callback(err);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.identity.getAuthToken({ 'interactive': true }, (token) => {
    console.log(token);
  });

  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
  chrome.declarativeContent.onPageChanged.addRules([
    {
    conditions: [
      new chrome.declarativeContent.PageStateMatcher({
      pageUrl: { urlContains: 'script.google.com' }
      })
    ],
    actions: [ new chrome.declarativeContent.ShowPageAction() ]
    }
  ]);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, callback) => {
  if (!msg.cmd) return;
  switch(msg.cmd) {
    case "request": 
      if (!msg.param) return;
      requestGapi(msg.param, callback);
      return true;//tell sender this will be returned async
    case "tab":
      chrome.storage.local.set({tab: sender.tab.id});
      return;
    default:
      return;
  }
});

chrome.webRequest.onBeforeRequest.addListener((details) => {
  const body = String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes));
  if (body.indexOf('getInitialEditorState') > 0) {
    const match = body.match(/gwt\/\|(\w+)\|\_\|getInitialEditorState/);
    if (match && match[1]) {
      chrome.storage.local.set({ gasToken: match[1], requestBody: body });
    }
  }
},
{ 
  urls: [ "https://script.google.com/*/gwt/ideService" ],
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
  chrome.storage.local.set({ requestUrl: details.url, requestHeaders: headers });
  console.log(headers);
},
{ 
  urls: [ "https://script.google.com/*/gwt/ideService" ],
  types: ["xmlhttprequest"]
},
[
  "requestHeaders"
]);