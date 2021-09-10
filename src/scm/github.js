'use strict';

class Github {
  constructor(baseUrl, user, accessToken) {
    this.baseUrl = baseUrl;
    this.user = user;
    this.accessToken = accessToken;
    this.namespaces = [user];
  }

  get name() {
    return 'github';
  }

  get canUseGist() {
    return true;
  }


  push(code) {
    if (isGist()) return this.pushToGist(code);
    return this.pushToRepo(code);
  }

  pushToRepo(code) {
    const changed = $('.diff-file:checked').toArray().map(elem => elem.value);
    const promises = changed.filter(f => code.gas[f]).map((file) => {
      const payload = {
        content: code.gas[file],
        encoding: 'utf-8'
      };
      return $.ajax({
          url: `${this.baseUrl}/repos/${getRepo().fullName}/git/blobs`,
          headers: {
            'Authorization': `token ${this.accessToken}`
          },
          method: 'POST',
          crossDomain: true,
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify(payload)
        })
        .then(response => {
          return {
            file: file,
            blob: response
          };
        })
    });
    if (changed.length === 0) {
      showLog('Nothing to do', LEVEL_INFO);
      return;
    }

    Promise.all([
        Promise.all(promises),
        getGitHubJSON(
          `${this.baseUrl}/repos/${getRepo().fullName}/branches/${getBranch()}`,
          this.accessToken)
      ])
      .then(responses => {
        return getGitHubJSON(
            responses[1].commit.commit.tree.url,
            this.accessToken, {
              recursive: 1
            }
          )
          .then(baseTree => {
            const tree = responses[0].map((data) => {
                return {
                  path: data.file,
                  mode: '100644',
                  type: 'blob',
                  sha: data.blob.sha
                }
              })
              .concat(baseTree.tree.filter((t) => {
                return (t.type != 'tree') && (changed.indexOf(t.path) < 0);
              }));
            return {
              tree: tree
            };
          })
          .then(payload => {
            return $.ajax({
              url: `${this.baseUrl}/repos/${getRepo().fullName}/git/trees`,
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
          .then(response => {
            return Object.assign(response, {
              parent: responses[1].commit.sha
            })
          })
          .fail(err => {
            throw err;
          });
      })
      .then(response => {
        const payload = {
          message: $('#commit-comment').val(),
          tree: response.sha,
          parents: [
            response.parent
          ]
        };
        return $.ajax({
          url: `${this.baseUrl}/repos/${getRepo().fullName}/git/commits`,
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
      .then(response => {
        const payload = {
          force: true,
          sha: response.sha
        };
        return $.ajax({
          url: `${this.baseUrl}/repos/${getRepo().fullName}/git/refs/heads/${getBranch()}`,
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
        showLog(`Successfully push to ${getBranch()} of ${getRepo().fullName}`);
      })
      .catch(err => {
        showLog(`Failed to push: ${err}`, LEVEL_ERROR);
      });
  }

  pushToGist(code) {
    const files = $('.diff-file:checked').toArray().map((elem) => elem.value);
    if (files.length === 0) {
      showLog('Nothing to do', LEVEL_INFO);
      return;
    }
    const payload = {
      files: {}
    };
    files.forEach(file => {
      payload.files[file] = {
        content: code.gas[file]
      };
    });
    if (code.scm['init_by_gas_hub.html']) {
      payload.files['init_by_gas_hub.html'] = null;
    }
    if ($('#gist-desc').val() !== '') {
      payload.description = $('#gist-desc').val();
    }
    return $.ajax({
        url: `${this.baseUrl}/gists/${getBranch()}`,
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
        showLog(`Successfully update gist: ${getBranch()}`);
      })
      .fail(err => {
        showLog(`Failed to update: ${err}`, LEVEL_ERROR);
      });
  }

  getAllGists() {
    return getAllItems(
      Promise.resolve({
        accessToken: this.accessToken,
        items: [],
        url: `${this.baseUrl}/users/${this.user}/gists`
      }),
      this.followPaginate,
      'github'
    );
  }

  getAllBranches() {
    return getAllItems(
      Promise.resolve({
        accessToken: this.accessToken,
        items: [],
        url: `${this.baseUrl}/repos/${getRepo().fullName}/branches`
      }),
      this.followPaginate,
      'github'
    );
  }

  getCode() {
    let code;
    if (isGist()) {
      code = this.getGistCode();
    } else {
      code = this.getRepoCode();
    }
    return code.then(code => {
      return code.reduce((hash, elem) => {
        if (elem) {
          hash[elem.file] = elem.content;
        }
        return hash;
      }, {})
    });
  }

  getRepoCode() {
    return new Promise((resolve, reject) => {
        getGitHubJSON(
            `${this.baseUrl}/repos/${getRepo().fullName}/branches/${getBranch()}`,
            this.accessToken)
          .then(resolve)
          .fail(reject);
      })
      .then(response => {
        return getGitHubJSON(
          `${this.baseUrl}/repos/${getRepo().fullName}/git/trees/${response.commit.commit.tree.sha}`,
          this.accessToken, {
            recursive: 1
          }
        );
      })
      .then(response => {
        const config = getConfig();
        const re = new RegExp(`(\\${config.filetype}|\\.html${config.manifestEnabled ? '|^appsscript.json' : ''})$`);
        const promises = response.tree.filter((tree) => {
            return tree.type === 'blob' && re.test(tree.path);
          })
          .map(tree => {
            return new Promise((resolve, reject) => {
              getGitHubJSON(`${tree.url}?ts=${new Date().getTime()}`, this.accessToken)
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
      });
  }

  getGistCode() {
    return new Promise((resolve, reject) => {
        getGitHubJSON(`${this.baseUrl}/gists/${getBranch()}`, this.accessToken)
          .then(resolve)
          .fail(reject);
      })
      .then((response) => {
        const promises = Object.keys(response.files).map((filename) => {
          let file = response.files[filename];
          return new Promise((resolve, reject) => {
            if (file.truncated) {
              getGitHubJSON(file.raw_url, this.accessToken)
                .then((content) => {
                  resolve({
                    file: filename,
                    content: content
                  });
                })
                .fail(reject)
            } else {
              resolve({
                file: filename,
                content: file.content
              });
            }
          });
        });
        return Promise.all(promises);
      });
  }

  getRepos() {
    return getAllItems(
        Promise.resolve({
          accessToken: this.accessToken,
          items: [],
          url: `${this.baseUrl}/user/repos`
        }),
        this.followPaginate,
        'github'
      )
      .then(response => {
        const repos = response.map(repo => repo.full_name);
        const repo = getRepo();
        if (repo && !repo.gist && !($.inArray(repo.fullName, repos) >= 0)) {
          delete context.bindRepo[getId()];
          chrome.storage.sync.set({
            bindRepo: context.bindRepo
          });
        }
        return repos;
      });
  }

  getNamespaces() {
    return getAllItems(
        Promise.resolve({
          accessToken: this.accessToken,
          items: [],
          url: `${this.baseUrl}/user/orgs`
        }),
        this.followPaginate,
        'github'
      )
      .then(orgs => {
        this.namespaces = [this.user].concat(orgs.map(org => org.login));
        return this.namespaces;
      })
      .catch((err) => {
        showLog(`Failed to get user info: ${err}`, LEVEL_ERROR);
      });
  }

  createRepo() {
    const owner = $('#selected-repo-owner').text();
    const name = $('#new-repo-name').val();
    const desc = $('#new-repo-desc').val();
    const isPrivate = $('#selected-repo-type').val() !== 'Public';
    const payload = {
      name: name,
      description: desc,
      auto_init: true,
      private: isPrivate
    }
    const path = owner === this.user ? '/user/repos' : `/orgs/${owner}/repos`;
    if (!name || name === '') return;
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `${this.baseUrl}${path}`,
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
      .then(response => {
        const repo = {
          fullName: response.full_name,
          scm: this.name
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
        return response.full_name;
      })
      .catch(err => {
        throw new Error('Failed to create new repository.');
      });
  }

  createGist() {
    const desc = $('#new-gist-name').val();
    const isPublic = $('#new-gist-public').val() !== 'secret';
    const payload = {
      'description': desc,
      'public': isPublic,
      'files': {
        'init_by_gas_hub.html': {
          'content': 'init by gas-hub, just delete this file.'
        }
      }
    };

    return new Promise((resolve, reject) => {
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
      .then(response => {
        const gist = response.id;
        Object.assign(context.bindBranch, {
          [getId()]: gist
        });
        chrome.storage.sync.set({
          bindBranch: context.bindBranch
        });
        return response;
      })
      .catch(err => {
        throw new Error('Failed to create new gist.');
      });
  }

  createBranch() {
    const branch = $('#new-branch-name').val();
    if (!branch || branch === '') return;
    return new Promise((resolve, reject) => {
        getGitHubJSON(
            `${this.baseUrl}/repos/${getRepo().fullName}/git/refs/heads/${getBranch()}`,
            this.accessToken)
          .then(resolve)
          .fail(reject)
      })
      .then(response => {
        if (response.object) {
          return response.object.sha;
        } else {
          return getGitHubJSON(
              `${this.baseUrl}/repos/${getRepo().fullName}/git/refs/heads`,
              this.accessToken)
            .then(response => {
              return response[0].object.sha;
            })
        }
      })
      .then(sha => {
        const payload = {
          ref: `refs/heads/${branch}`,
          sha: sha
        };
        return $.ajax({
          url: `${this.baseUrl}/repos/${getRepo().fullName}/git/refs`,
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
        if (err.status === 409) {
          throw new Error('Cannot create branch in empty repository with API, try to create branch in Github.');
        } else {
          throw new Error('Failed to create new branch.');
        }
      });
  }

  followPaginate(data) {
    return new Promise((resolve, reject) => {
      getGitHubJSON(data.url, data.accessToken)
        .then((response, status, xhr) => {
          data.items = data.items.concat(response);
          const link = xhr.getResponseHeader('Link');
          let url = null;
          if (link) {
            const match = link.match(/.*<(.*?)>; rel="next"/);
            url = match && match[1] ? match[1] : null;
          }
          resolve({
            items: data.items,
            url: url,
            accessToken: data.accessToken
          });
        })
        .fail(reject);
    });
  }
}