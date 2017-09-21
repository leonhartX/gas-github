'use strict';

function followGithubPaginate(data) {
  return new Promise((resolve, reject) => {
    $.getJSON(data.url)
    .then((response, status, xhr) => {
      data.items = data.items.concat(response);
      const link = xhr.getResponseHeader('Link');
      let url = null;
      if (link) {
        const match = link.match(/<(.*?)>; rel="next"/);
        url = match && match[1] ? match[1] : null;
      }
      resolve({ items: data.items, url: url });
    })
    .fail(reject);
  });
}

function followBitbucketPaginate(data) {
  return new Promise((resolve, reject) => {
    $.getJSON(data.url)
    .then((response) => {
      data.items = data.items.concat(response.values);
      const link = response.next;
      let url = null;
      if (link) {
        url = `${link}&access_token=${data.token}`;
      }
      resolve({ items: data.items, url: url });
    })
    .fail(reject);
  })
}

function getAllItems(promise, type) {
  let method;
  switch (type) {
    case 'github':
      method = followGithubPaginate;
      break;
    case 'bitbucket':
      method = followBitbucketPaginate;
      break;
    default:
      method = followGithubPaginate;
      break;
  }
  return promise.then(method)
  .then((data) => {
    return data.url ? getAllItems(Promise.resolve(data), type) : data.items;
  });
}

function createSCM(item) {
  switch (item.scm) {
    case 'github':
      return new Github(item.baseUrl, item.user, item.token);
    case 'bitbucket':
      return new Bitbucket(item.baseUrl, item.user, item.token);
    default:
      return new Github(item.baseUrl, item.user, item.token);
  }
}