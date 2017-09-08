'use strict';

const Github = class Github {
  constructor(baseUrl, user, accessToken) {
    this.baseUrl = baseUrl;
    this.user = user;
    this.accessToken = accessToken;
  }

  push(code){
    if (context.gist) return this.pushToGist(code);
    return this.pushToRepo(code);
  }

  pushToRepo(code) {
    const changed = $('.diff-file:checked').toArray().map(elem => elem.value);
    const unchanged = Object.keys(code.gas).filter((f) => changed.indexOf(f) < 0 );
    const promises = changed.filter(f => code.gas[f]).map((file) => {
      const payload = {
        content: code.gas[file],
        encoding: 'utf-8'
      };
      return $.ajax({
        url: `${this.baseUrl}/repos/${context.repo.fullName}/git/blobs`,
        headers: {
          'Authorization': `token ${this.accessToken}`
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
    if (changed.length === 0) {
      showAlert('Nothing to do', LEVEL_WARN);
      return;
    }

    Promise.all([
      Promise.all(promises),
      $.getJSON(
        `${this.baseUrl}/repos/${context.repo.fullName}/branches/${context.branch}`,
        { access_token: this.accessToken }
      )
    ])
    .then((responses) => {
      return $.getJSON(
        responses[1].commit.commit.tree.url,
        { 
          recursive: 1,
          access_token: this.accessToken 
        }
      )
      .then((baseTree) => {
        const tree = responses[0].map((data) => {
          return {
            path: data.file,
            mode: '100644',
            type: 'blob',
            sha: data.blob.sha
          }
        })
        .concat(baseTree.tree.filter((t) =>  {
          return (t.type != 'tree') && (!/.(gs|html)$/.test(t.path) || unchanged.indexOf(t.path) >= 0);
        }));
        return {
          tree: tree
        };
      })
      .then((payload) => {
        return $.ajax({
          url: `${this.baseUrl}/repos/${context.repo.fullName}/git/trees`,
          headers: {
            'Authorization': `token ${this.accessToken}`
          },
          method: 'POST',
          crossDomain: true,
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify(payload)
        });
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
        url: `${this.baseUrl}/repos/${context.repo.fullName}/git/commits`,
        headers: {
          'Authorization': `token ${this.accessToken}`
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
        url: `${this.baseUrl}/repos/${context.repo.fullName}/git/refs/heads/${context.branch}`,
        headers: {
          'Authorization': `token ${this.accessToken}`
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
      showAlert('Failed to push', LEVEL_ERROR);
    });
  }

  pushToGist(code) {
    const files = $('.diff-file:checked').toArray().map((elem) => elem.value);
    if (files.length === 0) {
      showAlert('Nothing to do', LEVEL_WARN);
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
    if ($('#gist-desc').val() !== '') {
      payload.description = $('#gist-desc').val();
    }
    console.log(payload);
    return $.ajax({
      url: `${this.baseUrl}/gists/${context.branch}`,
      headers: {
        'Authorization': `token ${this.accessToken}`
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
      showAlert('Failed to update', LEVEL_ERROR);
    });
  }

  getAllGists() {
    return getAllItems(Promise.resolve({items: [], url: `${this.baseUrl}/users/${this.user}/gists?access_token=${this.accessToken}`}))
  }

  getAllBranches() {
    return getAllItems(Promise.resolve({items: [], url: `${this.baseUrl}/repos/${context.repo.fullName}/branches?access_token=${this.accessToken}`}))
  }

  getCode() {
    if (context.gist) return this.getGistCode();
    return this.getRepoCode();
  }

  getRepoCode() {
    return new Promise((resolve, reject) => {
      $.getJSON(
        `${this.baseUrl}/repos/${context.repo.fullName}/branches/${context.branch}`,
        { access_token: this.accessToken }
      )
      .then(resolve)
      .fail(reject);
    })
    .then((response) => {
      return $.getJSON(
        `${this.baseUrl}/repos/${context.repo.fullName}/git/trees/${response.commit.commit.tree.sha}`,
        { recursive: 1, access_token: this.accessToken }
      );
    })
    .then((response) => {
      const promises = response.tree.filter((tree) => {
        return tree.type === 'blob' && /(\.gs|\.html)$/.test(tree.path);
      })
      .map((tree) => {
        return new Promise((resolve, reject) => {
          $.getJSON(tree.url, {access_token: this.accessToken })
          .then((content) => {
            resolve({ file: tree.path, content: decodeURIComponent(escape(atob(content.content)))});
          })
          .fail(reject)
        });
      });
      return Promise.all(promises);
    });
  }

  getGistCode() {
    return new Promise((resolve, reject) => {
      $.getJSON(
        `${this.baseUrl}/gists/${context.branch}`,
        { access_token: this.accessToken }
      )
      .then(resolve)
      .fail(reject);
    })
    .then((response) => {
      const promises = Object.keys(response.files).map((filename) => {
        let file = response.files[filename];
        return new Promise((resolve, reject) => {
          if (file.truncated) {
            $.getJSON(file.raw_url, {access_token: this.accessToken })
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

  getRepos() {
    return getAllItems(Promise.resolve({items: [], url: `${this.baseUrl}/user/repos?access_token=${this.accessToken}`}))
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
          name: 'Using Gist',
          fullName: 'gist',
          gist: true
        }
      }
      return repos;
    })
  }

  createRepo() {
    const repo = $('#new-repo-name').val();
    const desc = $('#new-repo-desc').val();
    const isPrivate = $('#new-repo-type').val() !== 'public';
    const payload = {
      name : repo,
      description : desc,
      auto_init : true,
      private: isPrivate
    }
    if (!repo || repo === '') return;
    new Promise((resolve, reject) => {
      $.ajax({
        url: `${this.baseUrl}/user/repos`,
        headers: {
          'Authorization': `token ${this.accessToken}`
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
      $('#new-repo-name').val('');
      $('#new-repo-desc').val('');
      $('#new-repo-type').val('public');
      showAlert(`Successfully create new repository ${repo}`);
    })
    .catch((err) => {
      showAlert('Failed to create new repository.', LEVEL_ERROR);
    });
  }

  createGist() {
    const desc = $('#new-gist-name').val();
    const isPublic = $('#new-gist-public').val() !== 'secret';
    const payload = {
      'description' : desc,
      'public': isPublic,
      'files': {
        'init_by_gas_hub.html' : {
          'content': 'init by gas-hub, just delete this file.'
        }
      }
    };

    new Promise((resolve, reject) => {
      $.ajax({
        url: `${this.baseUrl}/gists`,
        headers: {
          'Authorization': `token ${this.accessToken}`
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
      $('#new-gist-name').val('');
      $('#new-gist-public').val('public');
      showAlert(`Successfully create new gist.`);
    })
    .catch((err) => {
      showAlert('Failed to create new gist.', LEVEL_ERROR);
    });
  }

  createBranch() {
    const branch = $('#new-branch-name').val();
    if (!branch || branch === '') return;
    new Promise((resolve, reject) => {
      $.getJSON(
        `${this.baseUrl}/repos/${context.repo.fullName}/git/refs/heads/master`,
        { access_token: this.accessToken }
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
          `${this.baseUrl}/repos/${context.repo.fullName}/git/refs/heads`,
          { access_token: this.accessToken }
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
        url: `${this.baseUrl}/repos/${context.repo.fullName}/git/refs`,
        headers: {
          'Authorization': `token ${this.accessToken}`
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
      $('#new-branch-name').val('');
      showAlert(`Successfully create new branch: ${branch}`);
    })
    .catch((err) => {
      if (err.status === 409) {
        showAlert('Cannot create branch in empty repository with API, try to create branch in Github.', LEVEL_ERROR);
      } else {
        showAlert('Failed to create new branch.', LEVEL_ERROR);
      }
    });
  }
}