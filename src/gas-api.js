'use strict';

class Gas {
  pull(code) {
    const changed = $('.diff-file:checked').toArray().map(e => e.value);
    const updatePromises = changed.filter(f => code.scm[f])
    .map((file) => {
      const regex = new RegExp(`(.*?)(${context.config.filetype}|\.json|\.html)$`)
      const match = file.match(regex);
      if (!match || !match[1] || !match[2]) {
        showAlert('Unsupported file type.', LEVEL_ERROR);
        return;
      } 
      if (match[2] === 'json' && match[1] !== 'appsscript') {
        showAlert('Unsupported file type', LEVEL_ERROR);
        return; 
      }
      const name = match[1];
      const type = match[2];

      if (!code.gas[file]) {
        return () => this.gasCreateFile(name, type)
        .then(() => {
          return this.gasUpdateFile(name, code.scm[file]);
        })
      } else {
        return () => this.gasUpdateFile(name, code.scm[file]);
      }
    })
    .filter(n => n != undefined);

    const deletePromises = changed.filter(f => !code.scm[f])
    .map((file) => {
      const regex = new RegExp(`(.*?)(${context.config.filetype}|\.html)$`)
      const match = file.match(regex);
      if (!match || !match[1] || !match[2]) {
        showAlert('Unknow Error', LEVEL_ERROR);
        return;
      }
      const name = match[1];
      return () => this.gasDeleteFile(name);
    });

    if (updatePromises.length === 0 && deletePromises.length === 0) {
      showAlert('Nothing to do', LEVEL_WARN);
      return;
    }

    this.getGasContext()
    .then(() => {
      return Promise.all(updatePromises.map(f => f()))
      .then(() => {
        return Promise.all(deletePromises.map(f => f()));
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

  /*
  * get project context with google rpc
  * this is very volatile since it is just inferred from code
  */
  getGasContext() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['requestUrl' ,'requestHeaders', 'requestBody', 'gasToken'], resolve);
    })
    .then((param) => {
      context.gasUrl = param.requestUrl;
      context.gasHeaders = param.requestHeaders;
      context.gasToken = param.gasToken;
      return param.requestBody;
    });
  }

  getGasCode() {
    return this.getGasContext()
    .then((requestBody) => {
      return $.ajax({
        url: context.gasUrl,
        headers: context.gasHeaders,
        method: 'POST',
        crossDomain: true,
        data: requestBody,
        dataType: 'text'
      })
    })
    .then((response) => {
      if (!response.startsWith('//OK')) throw new Error('Init failed');
      //evil eval, but it's simple to get the object since it's not valid json object
      const initData = eval(response.slice(4)).filter((e) => {
        return typeof(e) === 'object';
      })[0];
      const ids = initData.filter((data) => { return /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(data) });
      context.projectId = initData[initData.indexOf(ids[0]) + 2];
      if (context.projectId === context.id)  {
        // for bounded script
        context.id = initData[initData.indexOf(ids[0]) + 1]; 
      }

      if (context.projectId.length != 33) {
        reject(new Error('cant not get project ID'));
      }
      const promises = ids.map((id) => {
        return new Promise((resolve, reject) => {
          const payload = `7|1|9|${getBaseUrl()}\|${context.gasToken}|_|getFileContent|l|${id}|${context.id}|${context.projectId}|m|1|2|3|4|1|5|5|6|7|8|9|0|0|`;
          $.ajax({
            url: context.gasUrl,
            headers: context.gasHeaders,
            method: 'POST',
            crossDomain: true,
            data: payload,
            dataType: 'text'
          })
          .then((response) => {
            if (!response.startsWith('//OK'))  reject(new Error('get apps script code failed'));
            //evil eval, but it's simple to get the object since it's not valid json object
            const codeContent = eval(response.slice(4)).filter((e) => {
              return typeof(e) === 'object';
            })[0];
            resolve({file : codeContent[codeContent.length - 7], content: codeContent[codeContent.length - 10], id : id });
          })
          .fail(reject);
        })
      });
      return Promise.all(promises);
    })
    .then((responses) => {
      context.fileIds = responses.reduce((hash, elem) => {
        if (elem) hash[elem.file] = elem.id;
        return hash;
      }, {});
      return responses;
    })
  }

  gasCreateFile(file, type) {
    const typeId = type === context.config.filetype ? 0 : 2;
    const payload = `7|1|7|${getBaseUrl()}\|${context.gasToken}|_|makeNewFile|1a|i|${file}|1|2|3|4|2|5|6|7|6|${typeId}|`;
    return new Promise((resolve, reject) => {
      $.ajax({
        url: context.gasUrl,
        headers: context.gasHeaders,
        method: 'POST',
        crossDomain: true,
        data: payload,
        dataType: 'text'
      })
      .then(resolve)
      .fail((err) => {reject(new Error('Create file failed'))})
    })
    .then((response) => {
      if (!response.startsWith('//OK')) throw(new Error(`Create file '${file}.${type}' failed`));
      const responseData = eval(response.slice(4)).filter((e) => {
        return typeof(e) === 'object';
      })[0];
      const id = responseData.filter((data) => { return /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(data) });
      if (id.length > 0) {
        context.fileIds[file] = id[0];
        return id[0];
      } else {
        throw new Error('can not parse response');
      }
    });
  }

  gasUpdateFile(file, code) {
    const escapedCode = code.replace(/\\/g, '\\\\').replace(/\|/g, '\\!');
    const payload = `7|1|7|${getBaseUrl()}\|${context.gasToken}|_|updateFile|1a|${file}|${escapedCode}|1|2|3|4|2|5|5|6|7|`;
    let headers = context.gasHeaders;
    Object.assign(headers, { 'file-id': context.fileIds[file]});
    return new Promise((resolve, reject) => {
      $.ajax({
        url: context.gasUrl,
        headers: headers,
        method: 'POST',
        crossDomain: true,
        data: payload,
        dataType: 'text'
      })
      .then((response) => {
        if (!response.startsWith('//OK')) reject(new Error('Update file failed'));
        resolve();
      })
      .fail((err) => {
        reject(new Error('Update file failed'));
      });
    });
  }

  gasDeleteFile(file) {
    const payload = `7|1|4|${getBaseUrl()}\|${context.gasToken}|_|deleteFile|1|2|3|4|0|`;
    let headers = context.gasHeaders;
    Object.assign(headers, { 'file-id': context.fileIds[file]});
    return new Promise((resolve, reject) => {
      $.ajax({
        url: context.gasUrl,
        headers: headers,
        method: 'POST',
        crossDomain: true,
        data: payload,
        dataType: 'text'
      })
      .then((response) => {
        if (!response.startsWith('//OK')) reject(new Error('Delete file failed'));
        resolve();
      })
      .fail((err) => {
        reject(new Error('Update file failed'));
      });
    });
  }
}