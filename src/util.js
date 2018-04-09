'use strict';

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