"use strict";

class Bitbucket {
  constructor(baseUrl, user, token) {
    this.baseUrl = baseUrl;
    this.user = user;
    this.token = token;
    this.accessToken = null;
  }

  getAccessToken() {
    return new Promise((resolve, reject) => {
      $.ajax({
        url: 'https://bitbucket.org/site/oauth2/access_token',
        headers: {
          Authorization: `Basic RmZIVE02ZnN5NDJQQlJDRjRQOmVDZDN0TTh5TUpUeTJSMld4bTJWUzZoYWVKdnpuNzdw`
        },
        method: 'POST',
        dataType: 'json',
        contentType: 'application/x-www-form-urlencoded',
        data: {
          grant_type: 'refresh_token',
          refresh_token: this.token
        }
      })
      .then(resolve)
      .fail(reject)
    })
    .then(response => {
      chrome.storage.sync.set({ token: response.refresh_token });
      this.accessToken = response.access_token;
      return response.access_token;
    })
    .catch(err => {
      showAlert('Failed to refresh access token.', LEVEL_ERROR);
    })
  }

  commitFiles(repo, branch, files, deleteFiles, comment) {
    return new Promise((resolve, reject) => {
      let data = files.reduce((hash, f) => {
        hash[f.name] = f.content;
        return hash;
      }, {});
      data.message = comment;
      if (deleteFiles && deleteFiles.length > 0) {
        data.files = deleteFiles;
      }
      if (branch) {
        data.branch = branch;
      }
      $.ajax({
        url: `${this.baseUrl}/repositories/${repo}/src`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}` 
        },
        contentType: 'application/x-www-form-urlencoded',
        method: 'POST',
        crossDomain: true,
        traditional: true,
        data: data,
      })
      .then(resolve)
      .fail(reject);
    });
  }

  push(code){
    const changed = $('.diff-file:checked').toArray().map(elem => elem.value);
    const files = changed.filter(f => code.gas[f]).map(f => {
      return { name: f, content: code.gas[f] }
    });
    const deleteFiles = changed.filter(f => !code.gas[f]);
    const comment = $('#commit-comment').val();

    this.commitFiles(context.repo.fullName, context.branch, files, deleteFiles, comment)
    .then(() => {
      showAlert(`Successfully push to ${context.branch} of ${context.repo.fullName}`);
    })
    .catch((err) => {
      showAlert('Failed to push', LEVEL_ERROR);
    });
  }

  getAllBranches() {
    return this.getAccessToken()
    .then(accessToken => {
      return getAllItems(Promise.resolve({
        token: accessToken,
        items: [], 
        url: `${this.baseUrl}/repositories/${context.repo.fullName}/refs/branches?access_token=${accessToken}`
      }),
      this.followPaginate,
      'bitbucket');
    });
  }

  getCode() {
    return this.getAccessToken()
    .then(accessToken => {
      return $.getJSON(
        `${this.baseUrl}/repositories/${context.repo.fullName}/refs/branches/${context.branch}`,
        { access_token: accessToken }
      )
    })
    .then(response => {
      return getAllItems(Promise.resolve({
        token: this.accessToken,
        items: [], 
        urls: [],
        url: `${this.baseUrl}/repositories/${context.repo.fullName}/src/${response.target.hash}/?access_token=${this.accessToken}`
      }),
      this.followDirectory,
      'bitbucket')
      .then(response => {
        const promises = response.map(src => {
          return new Promise((resolve, reject) => {
            $.get(src.links.self.href, { access_token: this.accessToken })
            .then(content => {
              resolve({ file: src.path, content: content});
            })
            .fail(reject)
          });
        });
        return Promise.all(promises);
      });
    });
  }

  getRepos() {
    return this.getAccessToken()
    .then(accessToken => {
      return getAllItems(Promise.resolve({
        token: accessToken,
        items: [], 
        url: `${this.baseUrl}/repositories/?access_token=${accessToken}&q=scm="git"&role=contributor`
      }),
      this.followPaginate,
      'bitbucket');
    })
    .then(response => {
      const repos = response.map(repo => repo.full_name);
      //if current bind still existed, use it
      const repo = context.bindRepo[context.id];
      if (repo && $.inArray(repo.fullName, repos) >= 0) {
        context.repo = repo;
      }
      return repos;
    });
  }

  createRepo() {
    const repo = $('#new-repo-name').val();
    const desc = $('#new-repo-desc').val();
    const isPrivate = $('#new-repo-type').val() !== 'public';
    const payload = {
      scm: 'git',
      description : desc,
      is_private: isPrivate
    }
    if (!repo || repo === '') return;
    this.getAccessToken()
    .then(() => {
      return $.ajax({
        url: `${this.baseUrl}/repositories/${this.user}/${repo}`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        method: 'POST',
        crossDomain: true,
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify(payload)
      })
    })
    .then((response) => {
      const repo = {
        fullName : response.full_name
      };
      context.repo = repo;
      Object.assign(context.bindRepo, { [context.id] : repo });
      if (context.bindBranch[context.id]) {
        delete context.bindBranch[context.id];
      }
      chrome.storage.sync.set({ bindRepo: context.bindRepo });
      return response.full_name;
    })
    .then(repo => {
      return this.commitFiles(repo, 'master', [{name: "README.md", content: "initialed by gas-github"}], null, 'initial commit');
    })
    .then(this.getRepos.bind(this))
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

  createBranch() {
    const branch = $('#new-branch-name').val();
    if (!branch || branch === '') return;
    context.branch = branch;
    this.getAccessToken()
    .then(() => {
      return this.commitFiles(context.repo.fullName, branch, [], null, `create new branch ${branch}`);
    })
    .then(() => {
      Object.assign(context.bindBranch, { [context.id] : branch });
      chrome.storage.sync.set({ bindBranch: context.bindBranch });
      return branch;
    })
    .then(updateBranch)
    .then(() => {
      $('#new-branch-name').val('');
      showAlert(`Successfully create new branch: ${branch}`);
    })
    .catch(err => {
      showAlert('Failed to create new branch.', LEVEL_ERROR);
    });
    
  }

  followPaginate(data) {
    return new Promise((resolve, reject) => {
      $.getJSON(data.url)
      .then(response => {
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

  followDirectory(data) {
    return new Promise((resolve, reject) => {
      $.getJSON(data.url)
      .then(response => {
        const dirs = response.values.filter(src => {
          return src.type === 'commit_directory';
        }).map(dir => {
          return `${dir.links.self.href}?access_token=${data.token}`;
        })
        const files = response.values.filter(src => {
          return src.type === 'commit_file' && /(\.gs|\.html)$/.test(src.path);
        });
        data.items = data.items.concat(files);
        data.urls = data.urls.concat(dirs);
        let link = response.next;
        if (link) {
          data.urls.push(`${link}&access_token=${data.token}`);
        }
        data.url = data.urls.shift();
        resolve(data);
      })
      .fail(reject);
    })
  }
}
