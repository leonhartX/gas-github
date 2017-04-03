"use strict";

function push(code){
  if (context.gist) return pushToGist(code);
  return pushToRepo(code);
}

function pushToRepo(code) {
  const promises = $('.diff-file:checked').toArray().map((elem) => {
    const file = elem.value;
    const payload = {
      content: code.gas[file],
      encoding: "utf-8"
    };
    return $.ajax({
      url: `${baseUrl}/repos/${context.repo.fullName}/git/blobs`,
      headers: {
        "Authorization": `token ${accessToken}`
      },
      method: 'POST',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    })
    .then((response) => {
      return {file: file, blob: response};
    })
  });
  if (promises.length === 0) {
    showAlert("Nothing to do", LEVEL_WARN);
    return;
  }

  Promise.all([
    Promise.all(promises),
    $.getJSON(
      `${baseUrl}/repos/${context.repo.fullName}/branches/${context.branch}`,
      { access_token: accessToken }
    )
  ])
  .then((responses) => {
    const tree = responses[0].map((data) => {
      return {
        path: data.file,
        mode: "100644",
        type: "blob",
        sha: data.blob.sha
      }
    });
    const payload = {
      base_tree: responses[1].commit.commit.tree.sha,
      tree: tree
    };
    return $.ajax({
      url: `${baseUrl}/repos/${context.repo.fullName}/git/trees`,
      headers: {
        "Authorization": `token ${accessToken}`
      },
      method: 'POST',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    })
    .then((response) => {
      return Object.assign(response, { parent: responses[1].commit.sha })
    })
    .fail((err) => {
      throw err;
    })
  })
  .then((response) => {
    const payload = {
      message: $('#commit-comment').val(),
      tree: response.sha,
      parents: [
        response.parent
      ]
    };
    return $.ajax({
      url: `${baseUrl}/repos/${context.repo.fullName}/git/commits`,
      headers: {
        "Authorization": `token ${accessToken}`
      },
      method: 'POST',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    });
  })
  .then((response) => {
     const payload = {
      force: true,
      sha: response.sha
    };
    return $.ajax({
      url: `${baseUrl}/repos/${context.repo.fullName}/git/refs/heads/${context.branch}`,
      headers: {
        "Authorization": `token ${accessToken}`
      },
      method: 'PATCH',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    });
  })
  .then(() => {
    showAlert(`Successfully push to ${context.branch} of ${context.repo.name}`);
  })
  .catch((err) => {
    showAlert("Failed to push", LEVEL_ERROR);
  });
}

function pushToGist(code) {
  const files = $('.diff-file:checked').toArray().map((elem) => elem.value);
  if (files.length === 0) {
    showAlert("Nothing to do", LEVEL_WARN);
    return;
  }
  const payload = {
    files: {}
  };
  files.forEach((file) => {
    payload.files[file] = {
      content: code.gas[file]
    };
  })
  if (code.github['init_by_gas_hub.html']) {
    payload.files['init_by_gas_hub.html'] = null;
  }
  if ($('#gist-desc').val() !== "") {
    payload.description = $('#gist-desc').val();
  }
  console.log(payload);
  return $.ajax({
    url: `${baseUrl}/gists/${context.branch}`,
    headers: {
      "Authorization": `token ${accessToken}`
    },
    method: 'PATCH',
    crossDomain: true,
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify(payload)
  })
  .then(() => {
    showAlert(`Successfully update gist: ${context.branch}`);
  })
  .fail((err) => {
    showAlert("Failed to update", LEVEL_ERROR);
  });
}

function getGithubCode() {
  if (context.gist) return getGistCode();
  return getRepoCode();
}

function getRepoCode() {
  return new Promise((resolve, reject) => {
    $.getJSON(
      `${baseUrl}/repos/${context.repo.fullName}/branches/${context.branch}`,
      { access_token: accessToken }
    )
    .then(resolve)
    .fail(reject);
  })
  .then((response) => {
    return $.getJSON(
      `${baseUrl}/repos/${context.repo.fullName}/git/trees/${response.commit.commit.tree.sha}`,
      { recursive: 1, access_token: accessToken }
    );
  })
  .then((response) => {
    const promises = response.tree.filter((tree) => {
      return tree.type === 'blob' && /(\.gs|\.html)$/.test(tree.path);
    })
    .map((tree) => {
      return new Promise((resolve, reject) => {
        $.getJSON(tree.url, {access_token: accessToken })
        .then((content) => {
          resolve({ file: tree.path, content: decodeURIComponent(escape(atob(content.content)))});
        })
        .fail(reject)
      });
    });
    return Promise.all(promises);
  });
}

function getGistCode() {
  return new Promise((resolve, reject) => {
    $.getJSON(
      `${baseUrl}/gists/${context.branch}`,
      { access_token: accessToken }
    )
    .then(resolve)
    .fail(reject);
  })
  .then((response) => {
    const promises = Object.keys(response.files).map((filename) => {
      let file = response.files[filename];
      return new Promise((resolve, reject) => {
        if (file.truncated) {
          $.getJSON(file.raw_url, {access_token: accessToken })
          .then((content) => {
            resolve({ file: filename, content: content});
          })
          .fail(reject)
        } else {
          resolve({file: filename, content: file.content});
        }
      });
    });
    return Promise.all(promises);
  });
}

function followPaginate(data) {
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

function getAllItems(promise) {
  return promise.then(followPaginate)
  .then((data) => {
    return data.url ? getAllItems(Promise.resolve(data), followPaginate) : data.items;
  })
}

function getGithubRepos() {
  return getAllItems(Promise.resolve({items: [], url: `${baseUrl}/user/repos?access_token=${accessToken}`}))
  .then((response) => {
    const repos = response.map((repo) => {
      return { name : repo.name, fullName : repo.full_name }
    });
    //if current bind still existed, use it
    const repo = context.bindRepo[context.id];
    if (repo && $.inArray(repo.name, repos.map(repo => repo.name)) >= 0 ) {
      context.repo = repo;
    } else if (context.gist) {
      context.repo = {
        name: "Using Gist",
        fullName: "gist",
        gist: true
      }
    }
    return repos;
  })
}

function githubCreateRepo() {
  const repo = $('#new-repo-name').val();
  const desc = $('#new-repo-desc').val();
  const payload = {
    name : repo,
    description : desc,
    auto_init : true
  }
  if (!repo || repo === "") return;
  new Promise((resolve, reject) => {
    $.ajax({
      url: `${baseUrl}/user/repos`,
      headers: {
        "Authorization": `token ${accessToken}`
      },
      method: 'POST',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    })
    .then(resolve)
    .fail(reject);
  })
  .then((response) => {
    const repo = {
      name : response.name,
      fullName : response.full_name
    };
    context.repo = repo;
    Object.assign(context.bindRepo, { [context.id] : repo });
    if (context.bindBranch[context.id]) {
      delete context.bindBranch[context.id];
    }
    chrome.storage.sync.set({ bindRepo: context.bindRepo });
    return response;
  })
  .then(getGithubRepos)
  .then(updateRepo)
  .then(updateBranch)
  .then(() => {
    $('#new-repo-name').val("");
    $('#new-repo-desc').val("");
    showAlert(`Successfully create new repository ${repo}`);
  })
  .catch((err) => {
    showAlert("Failed to create new repository.", LEVEL_ERROR);
  });
}

function githubCreateGist() {
  const desc = $('#new-gist-name').val();
  const isPublic = $('#new-gist-public').val() !== 'secret';
  const payload = {
    "description" : desc,
    "public": isPublic,
    "files": {
      "init_by_gas_hub.html" : {
        "content": "init by gas-hub, just delete this file."
      }
    }
  };

  new Promise((resolve, reject) => {
    $.ajax({
      url: `${baseUrl}/gists`,
      headers: {
        "Authorization": `token ${accessToken}`
      },
      method: 'POST',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    })
    .then(resolve)
    .fail(reject);
  })
  .then((response) => {
    const gist = response.id;
    context.branch = gist;
    Object.assign(context.bindBranch, { [context.id] : gist });
    chrome.storage.sync.set({ bindBranch: context.bindBranch });
    return response;
  })
  .then(updateGist)
  .then(() => {
    $('#new-gist-name').val("");
    $('#new-gist-public').val("public");
    showAlert(`Successfully create new gist.`);
  })
  .catch((err) => {
    showAlert("Failed to create new gist.", LEVEL_ERROR);
  });
}

function githubCreateBranch() {
  const branch = $('#new-branch-name').val();
  if (!branch || branch === "") return;
  new Promise((resolve, reject) => {
    $.getJSON(
      `${baseUrl}/repos/${context.repo.fullName}/git/refs/heads/master`,
      { access_token: accessToken }
    )
    .then(resolve)
    .fail(reject)  
  })
  .then((response) => {
    if (response.object) {
      return response.object.sha;
    }
    else {
      return $.getJSON(
        `${baseUrl}/repos/${context.repo.fullName}/git/refs/heads`,
        { access_token: accessToken }
      )
      .then((response) => {
        return response[0].object.sha;
      })
    }
  })
  .then((sha) => {
    const payload = {
      ref: `refs/heads/${branch}`,
      sha: sha
    };
    return $.ajax({
      url: `${baseUrl}/repos/${context.repo.fullName}/git/refs`,
      headers: {
        "Authorization": `token ${accessToken}`
      },
      method: 'POST',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    });
  })
  .then((response) => {
    context.branch = branch;
    Object.assign(context.bindBranch, { [context.id] : branch });
    chrome.storage.sync.set({ bindBranch: context.bindBranch });
    return context.repo.name;
  })
  .then(updateBranch)
  .then(() => {
    $('#new-branch-name').val("");
    showAlert(`Successfully create new branch: ${branch}`);
  })
  .catch((err) => {
    if (err.status === 409) {
      showAlert("Cannot create branch in empty repository with API, try to create branch in Github.", LEVEL_ERROR);
    } else {
      showAlert("Failed to create new branch.", LEVEL_ERROR);
    }
  });
}