"use strict";

class Bitbucket {
  constructor(baseUrl, user, token) {
    this.baseUrl = baseUrl;
    this.user = user;
    this.token = token;
    this.accessToken = null;
    this.namespaces = [user];
  }

  get name() {
    return 'bitbucket';
  }

  get canUseGist() {
    return false;
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

  commitFiles(repo, branch, parent, files, deleteFiles, comment) {
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
      if (parent) {
        data.parents = parent;
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
      return { name: f.replace(/\.gs$/, context.filetype), content: code.gas[f] }
    });
    const deleteFiles = changed.filter(f => !code.gas[f]);
    const comment = $('#commit-comment').val();

    this.commitFiles(context.repo.fullName, context.branch, null, files, deleteFiles, comment)
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
      return getAllItems(Promise.resolve(
        {
          token: accessToken,
          items: [], 
          url: `${this.baseUrl}/repositories/${context.repo.fullName}/refs/branches?access_token=${accessToken}`
        }),
        this.followPaginate,
        'bitbucket'
      );
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
      return getAllItems(Promise.resolve(
        {
          token: this.accessToken,
          items: [], 
          urls: [],
          url: `${this.baseUrl}/repositories/${context.repo.fullName}/src/${response.target.hash}/?access_token=${this.accessToken}`
        }),
        this.followDirectory,
        'bitbucket'
      )
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

  getNamespaces() {
    return this.getAccessToken()
    .then(accessToken => {
      return getAllItems(Promise.resolve(
        {
          token: accessToken,
          items: [], 
          url: `${this.baseUrl}/teams?access_token=${accessToken}&role=contributor`
        }),
        this.followPaginate,
        'bitbucket'
      );
    })
    .then(teams => {
      this.namespaces = [this.user].concat(teams.map(team => team.username));
      return this.namespaces;
    })
    .catch((err) => {
      showAlert('Failed to get user info.', LEVEL_ERROR);
    });
  }

  getRepos() {
    return this.getAccessToken()
    .then(accessToken => {
      return getAllItems(Promise.resolve(
        {
          token: accessToken,
          items: [], 
          url: `${this.baseUrl}/repositories/?access_token=${accessToken}&q=scm="git"&role=contributor`
        }),
        this.followPaginate,
        'bitbucket'
      );
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
    const owner = $('#new-repo-owner').val();
    const name = $('#new-repo-name').val();
    const desc = $('#new-repo-desc').val();
    const isPrivate = $('#new-repo-type').val() !== 'public';
    const payload = {
      scm: 'git',
      description : desc,
      is_private: isPrivate
    }
    if (!name || name === '') return;
    return this.getAccessToken()
    .then(() => {
      return $.ajax({
        url: `${this.baseUrl}/repositories/${owner}/${name}`,
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
    .then(response => {
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
      return this.commitFiles(repo, 'master', null, [{name: "README.md", content: "initialed by gas-github"}], null, 'initial commit')
      .then(() => {
        return repo;
      });
    })
    .catch((err) => {
      throw new Error('Failed to create new repository.');
    });
  }

  createBranch() {
    const branch = $('#new-branch-name').val();
    if (!branch || branch === '') return;
    return this.getAccessToken()
    .then(() => {
      return $.getJSON(
        `${this.baseUrl}/repositories/${context.repo.fullName}/refs/branches/${context.branch}`,
        { access_token: this.accessToken }
      );
    })
    .then(res => {
      const parent = res.target? res.target.hash : null;
      return this.commitFiles(context.repo.fullName, branch, parent, [], null, `create new branch ${branch}`);
    })
    .then(() => {
      context.branch = branch;
      Object.assign(context.bindBranch, { [context.id] : branch });
      chrome.storage.sync.set({ bindBranch: context.bindBranch });
      return branch;
    })
    .catch(err => {
      throw new Error('Failed to create new branch.');
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
          url = link;
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
        const re = new RegExp(`(\\${context.filetype}|\\.html)$`);
        const files = response.values.filter(src => {
          return src.type === 'commit_file' && re.test(src.path);
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
