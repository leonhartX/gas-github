'use strict';
function getId() {
  const match = window.location.href.match(/https:\/\/script\.google\.com(.*?)\/home\/projects\/([^/]*)\//);
  if (!match) return null;
  return match[2];
}

function getRepo() {
  const id = getId();
  return context.bindRepo[id].fullName;
}

function getAllItems(promise, followMethod, type) {
  return promise.then(followMethod)
    .then((data) => {
      return data.url ? getAllItems(Promise.resolve(data), followMethod, type) : data.items;
    });
}

function createSCM(item) {
  switch (item.scm) {
    case 'github':
      return new Github(item.baseUrl, item.user, item.token);
    case 'bitbucket':
      return new Bitbucket(item.baseUrl, item.user, item.token);
    case 'gitlab':
      return new Gitlab(item.baseUrl, item.user, item.token);
    default:
      return new Github(item.baseUrl, item.user, item.token);
  }
}

function getGitHubJSON(url, accessToken, data) {
  return $.ajax({
    url: url,
    headers: {
      'Authorization': `token ${accessToken}`
    },
    method: 'GET',
    crossDomain: true,
    dataType: 'json',
    data: data,
    contentType: 'application/json'
  })
}