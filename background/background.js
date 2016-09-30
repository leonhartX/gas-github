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
  if (msg.cmd === "request" && msg.param) {
    requestGapi(msg.param, callback);
  }
  return true;//tell sender this will be returned async
});