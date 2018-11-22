'use strict';

const API_URL = "https://script.googleapis.com/v1/projects";

class ScriptApi {
  pull(code) {
    const changed = $('.diff-file:checked').toArray().map(elem => elem.value);
    const updatedFiles = changed.filter(f => code.scm[f]).map(f => {
      const suffix = f.substr(f.lastIndexOf("."));
      const file = f.substr(0, f.lastIndexOf("."));
      let type;
      switch(suffix) {
        case ".html" :
          type = "HTML";
          break;
        case ".json" :
          type = "JSON";
          break;
        case context.config.filetype :
          type = "SERVER_JS";
          break;
      }
      return { name: file, source: code.scm[f], type: type }
    });
    const deleteFiles = changed.filter(f => !code.scm[f]);
    const remainedFiles = Object.keys(code.gas)
      .filter(f => !deleteFiles.includes(f) && !changed.includes(f))
      .map(f => {
        const suffix = f.substr(f.lastIndexOf("."));
        const file = f.substr(0, f.lastIndexOf("."));
        let type;
        switch(suffix) {
          case ".html" :
            type = "HTML";
            break;
          case ".json" :
            type = "JSON";
            break;
          case context.config.filetype :
            type = "SERVER_JS";
            break;
        }
        return { name: file, source: code.gas[f], type: type }
      });
    const files = updatedFiles.concat(remainedFiles);
    console.log(files)

    this.updateToken()
    .then(() => {
      return new Promise((resolve, reject) => {
        $.ajax({
          url: `${API_URL}/${context.id}/content?access_token=${context.gapiToken}`,
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
      showAlert('Successfully pulled from scm');
      location.reload();
    })
    .catch((err) => {
      showAlert(err.message, LEVEL_ERROR);
    });
  }

  getGasCode() {
    return this.updateToken()
    .then(() => {
      return new Promise((resolve, reject) => {
        $.getJSON(
          `${API_URL}/${context.id}/content`,
          { access_token: context.gapiToken }
        )
        .then(resolve)
        .fail(reject)
      })
    })
    .then(content => {
      const code = content.files.reduce((hash, elem) => {
          if (elem) {
            let type;
            switch(elem.type) {
              case "HTML" :
                type = ".html"
                break;
              case "JSON" :
                type = ".json"
                break;
              case "SERVER_JS" :
                type = context.config.filetype
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
        url: `${API_URL}/${context.id}/content?access_token=${context.gapiToken}`,
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
      showAlert('Successfully pulled from scm');
      location.reload();
    })
    .catch((err) => {
      showAlert(err.message, LEVEL_ERROR);
    });
  }


  updateToken() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ cmd: 'login', interactive: false }, token => {
        context.gapiToken = token;
        resolve();
      })
    });
  }
}