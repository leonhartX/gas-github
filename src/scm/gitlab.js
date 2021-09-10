"use strict";

class Gitlab {
  constructor(baseUrl, user, token) {
    this.baseUrl = baseUrl;
    this.user = user;
    this.namesToIds = {
      repos: {},
      groups: {}
    };
    this.accessToken = token.token;
    if (token.type === 'oAuth') {
      this.tokenParam = `access_token=${this.accessToken}`;
      this.tokenHeader = {
        'Authorization': `Bearer ${this.accessToken}`
      };
    } else {
      this.tokenParam = `private_token=${this.accessToken}`;
      this.tokenHeader = {
        'Private-Token': this.accessToken
      };
    }
    this.namespaces = [user];
  }

  get name() {
    return 'gitlab';
  }

  get canUseGist() {
    return false;
  }

  commitFiles(repo, branch, parent, newFiles, changedFiles, deleteFiles, comment) {
    return new Promise((resolve, reject) => {
      const data = {
        branch: branch,
        commit_message: comment,
        actions: []
      };
      if (newFiles && newFiles.length > 0) {
        data.actions = data.actions.concat(newFiles.map((file) => {
          return {
            action: 'create',
            file_path: file.name,
            content: file.content
          }
        }));
      }
      if (changedFiles && changedFiles.length > 0) {
        data.actions = data.actions.concat(changedFiles.map((file) => {
          return {
            action: 'update',
            file_path: file.name,
            content: file.content
          }
        }));
      }
      if (deleteFiles && deleteFiles.length > 0) {
        data.actions = data.actions.concat(deleteFiles.map((file) => {
          return {
            action: 'delete',
            file_path: file
          }
        }));
      }
      let repoId = getRepo().id || this.namesToIds.repos[getRepo().fullName];
      $.ajax({
          url: `${this.baseUrl}/projects/${repoId}/repository/commits`,
          headers: this.tokenHeader,
          contentType: 'application/json',
          method: 'POST',
          crossDomain: true,
          traditional: true,
          data: JSON.stringify(data)
        })
        .then(resolve)
        .fail(reject);
    });
  }

  push(code) {
    const changed = $('.diff-file:checked').toArray().map(elem => elem.value);
    const changedFiles = changed.filter(f => code.gas[f]).map(f => {
      return {
        name: f,
        content: code.gas[f]
      }
    });
    const deleteFiles = changed.filter(f => !code.gas[f]);
    const newFileNames = changed.filter(f => !code.scm[f]);
    const updatedFileNames = changed.filter(f => !newFileNames.includes(f));

    const newFiles = changedFiles.filter(f => newFileNames.includes(f.name));
    const updatedFiles = changedFiles.filter(f => updatedFileNames.includes(f.name));

    const comment = $('#commit-comment').val();

    this.commitFiles(getRepo().fullName, getBranch(), null, newFiles, updatedFiles, deleteFiles, comment)
      .then(() => {
        showLog(`Successfully push to ${getBranch()} of ${getRepo().fullName}`);
      })
      .catch((err) => {
        showLog(`Failed to push: ${err}`, LEVEL_ERROR);
      });
  }

  getAllBranches() {
    let repoId = getRepo().id || this.namesToIds.repos[getRepo().fullName]; 
    return getAllItems(Promise.resolve({
        tokenParam: this.tokenParam,
        items: [],
        url: `${this.baseUrl}/projects/${repoId}/repository/branches?per_page=25`
      }),
      this.followPaginate,
      'gitlab'
    );
  }

  getCode() {
    let repoId = getRepo().id || this.namesToIds.repos[getRepo().fullName];
    return new Promise((resolve, reject) => {
        return $.getJSON(
            `${this.baseUrl}/projects/${repoId}/repository/tree?ref=${getBranch()}&recursive=true&${this.tokenParam}`, {}
          )
          .then(resolve)
          .fail(reject)
      })
      .then(response => {
        const config = getConfig();
        const re = new RegExp(`(\\${config.filetype}|\\.html${config.manifestEnabled ? '|^appsscript.json' : ''})$`);
        const promises = response.filter((tree) => {
            return tree.type === 'blob' && re.test(tree.path);
          })
          .map(tree => {
            return new Promise((resolve, reject) => {
              $.getJSON(`${this.baseUrl}/projects/${repoId}/repository/files/${encodeURIComponent(tree.path)}?ref=${getBranch()}&${this.tokenParam}`, {})
                .then((content) => {
                  resolve({
                    file: tree.path,
                    content: decodeURIComponent(escape(atob(content.content)))
                  });
                })
                .fail(reject)
            });
          });
        return Promise.all(promises);
      })
      .then(code => {
        return code.reduce((hash, elem) => {
          if (elem) {
            hash[elem.file] = elem.content;
          }
          return hash;
        }, {})
      })
  }

  getNamespaces() {
    return getAllItems(Promise.resolve({
          tokenParam: this.tokenParam,
          items: [],
          url: `${this.baseUrl}/groups?per_page=25`
        }),
        this.followPaginate,
        'gitlab'
      )
      .then(groups => {
        this.namespaces = [this.user].concat(groups.map(group => group.name));
        this.namesToIds.groups = groups.reduce((obj, item) => (obj[item.name] = item.id, obj), {});
        return this.namespaces;
      })
      .catch((err) => {
        showLog('Failed to get user info.', LEVEL_ERROR);
      });
  }

  getRepos() { // Named Projects in gitlab
    return getAllItems(Promise.resolve({
          tokenParam: this.tokenParam,
          items: [],
          url: `${this.baseUrl}/projects?per_page=25&membership=true`
        }),
        this.followPaginate,
        'gitlab'
      )
      .then(response => {
        this.namesToIds.repos = response.reduce((obj, item) => (obj[item.path_with_namespace] = item.id, obj), {});
        return Object.keys(this.namesToIds.repos);
      });
  }

  createRepo() {
    const owner = $('#selected-repo-owner').text();
    const name = $('#new-repo-name').val();
    const desc = $('#new-repo-desc').val();
    const visibility = ($('#selected-repo-type').val() !== 'Public') ? 'private' : 'public';
    const payload = {
      path: name,
      description: desc,
      visibility: visibility
    };
    if (this.namesToIds.groups[owner]) {
      payload.namespace_id = this.namesToIds.groups[owner];
    }
    if (!name || name === '') return;
    return new Promise((resolve, reject) => {
        return $.ajax({
            url: `${this.baseUrl}/projects`,
            headers: this.tokenHeader,
            method: 'POST',
            crossDomain: true,
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify(payload)
          })
          .then(resolve)
          .fail(reject);
      })
      .then(response => {
        const repo = {
          fullName: response.path_with_namespace,
          id: response.id
        };
        Object.assign(context.bindRepo, {
          [getId()]: repo
        });
        if (context.bindBranch[getId()]) {
          delete context.bindBranch[getId()];
        }
        chrome.storage.sync.set({
          bindRepo: context.bindRepo
        });
        return response.path_with_namespace;
      })
      .then(repo => {
        return this.commitFiles(repo, 'master', null, [{
            name: "README.md",
            content: "initialed by gas-github"
          }], null, null, 'initial commit')
          .then(() => {
            return repo;
          });
      })
      .catch((err) => {
        throw new Error(`Failed to create new repository: ${err}`);
      });
  }

  createBranch() {
    const branch = $('#new-branch-name').val();
    const payload = {
      branch: branch,
      ref: getBranch()
    };
    if (!branch || branch === '') return;
    let repoId = getRepo().id || this.namesToIds.repos[getRepo().fullName];
    return new Promise((resolve, reject) => {
        return $.ajax({
            url: `${this.baseUrl}/projects/${repoId}/repository/branches`,
            headers: this.tokenHeader,
            method: 'POST',
            crossDomain: true,
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify(payload)
          })
          .then(resolve)
          .fail(reject);
      })
      .then(response => {
        Object.assign(context.bindBranch, {
          [getId()]: branch
        });
        chrome.storage.sync.set({
          bindBranch: context.bindBranch
        });
        return branch;
      })
      .catch(err => {
        throw new Error('Failed to create new branch.');
      });
  }

  followPaginate(data) {
    return new Promise((resolve, reject) => {
      $.getJSON(`${data.url}&${data.tokenParam}`)
        .then((response, status, xhr) => {
          data.items = data.items.concat(response);
          const link = xhr.getResponseHeader('Link');
          let url = null;
          if (link) {
            const match = link.match(/<([^ ]*?)>; rel="next"/);
            url = match && match[1] ? match[1] : null;
          }
          resolve({
            items: data.items,
            url: url
          });
        })
        .fail(reject);
    })
  }
}
