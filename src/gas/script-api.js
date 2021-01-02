'use strict';

const API_URL = "https://script.googleapis.com/v1/projects";

class ScriptApi {
  pull(code) {
    const config = getConfig();
    const changed = $('.diff-file:checked').toArray().map(elem => elem.value);
    const updatedFiles = changed.filter(f => code.scm[f]).map(f => {
      const suffix = f.substr(f.lastIndexOf("."));
      const file = f.substr(0, f.lastIndexOf("."));
      let type;
      switch (suffix) {
        case ".html":
          type = "HTML";
          break;
        case ".json":
          type = "JSON";
          break;
        case config.filetype:
          type = "SERVER_JS";
          break;
      }
      return {
        name: file,
        source: code.scm[f],
        type: type
      }
    });
    const deleteFiles = changed.filter(f => !code.scm[f]);
    const remainedFiles = Object.keys(code.gas)
      .filter(f => !deleteFiles.includes(f) && !changed.includes(f))
      .map(f => {
        const suffix = f.substr(f.lastIndexOf("."));
        const file = f.substr(0, f.lastIndexOf("."));
        let type;
        switch (suffix) {
          case ".html":
            type = "HTML";
            break;
          case ".json":
            type = "JSON";
            break;
          case config.filetype:
            type = "SERVER_JS";
            break;
        }
        return {
          name: file,
          source: code.gas[f],
          type: type
        }
      });
    const files = updatedFiles.concat(remainedFiles);
    console.log(files)

    this.updateToken()
      .then(() => {
        return new Promise((resolve, reject) => {
          $.ajax({
              url: `${API_URL}/${getId()}/content?access_token=${context.gapiToken}`,
              method: 'PUT',
              contentType: 'application/json',
              data: JSON.stringify({
                files: files
              })
            })
            .then(resolve)
            .fail(reject)
        })
      })
      .then(() => {
        showLog('Successfully pulled from scm');
        location.reload();
      })
      .catch((err) => {
        showLog(err.message, LEVEL_ERROR);
      });
  }

  getGasCode() {
    return this.updateToken()
      .then(() => {
        return new Promise((resolve, reject) => {
          $.getJSON(
              `${API_URL}/${getId()}/content`, {
                access_token: context.gapiToken
              }
            )
            .then(resolve)
            .fail(reject)
        })
      })
      .then(content => {
        const code = content.files.reduce((hash, elem) => {
          if (elem) {
            let type;
            switch (elem.type) {
              case "HTML":
                type = ".html"
                break;
              case "JSON":
                type = ".json"
                break;
              case "SERVER_JS":
                type = getConfig().filetype
                break;
            }
            hash[elem.name + type] = elem.source;
          }
          return hash;
        }, {});
        return code;
      });
  }

  updateGas() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `${API_URL}/${getId()}/content?access_token=${context.gapiToken}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
              files: files
            })
          })
          .then(resolve)
          .fail(reject)
      })
      .then(() => {
        showLog('Successfully pulled from scm');
        location.reload();
      })
      .catch((err) => {
        showLog(err.message, LEVEL_ERROR);
      });
  }

  updateToken() {
    if (context.gapiRefreshToken) {
      return new Promise((resolve, reject) => {
        const payload = {
          refresh_token: context.gapiRefreshToken,
          client_id: "971735641612-am059p55sofdp30p2t4djecn72l6kmpf.apps.googleusercontent.com",
          client_secret: "epw3f_WvEn0Uwqi6kE7DBQl7",
          redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
          grant_type: "refresh_token",
        }
        $.ajax({
            url: "https://www.googleapis.com/oauth2/v4/token",
            method: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify(payload)
          })
          .done(response => {
            context.gapiToken = response.access_token;
            chrome.storage.sync.set({
              gapiToken: response.access_token
            }, () => {
              resolve();
            });
          });
      })
    } else {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          cmd: 'login',
          interactive: false
        }, token => {
          context.gapiToken = token;
          resolve();
        })
      });
    }
  }
}