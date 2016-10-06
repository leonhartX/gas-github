const LEVEL_ERROR = "warning";
const LEVEL_WARN = "info";
const LEVEL_INFO = "promo";
const observer = new MutationObserver(() => {
  $('.github-alert').remove();
  observer.disconnect();
});
  .then(initPageEvent)
        showAlert("Unknow Error", LEVEL_ERROR);
});

function initContext() {
  context = {};
  const match = window.location.href.match(/https:\/\/script\.google\.com.*?\/d\/([^/]*)\//);
  if (!match) return null;
  context.id = match[1];

  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["token","user", "baseUrl", "bindRepo", "bindBranch"], (item) => {
      if (!item.token) {
        reject(new Error("need login"));
      }
      accessToken = item.token;
      user = item.user;
      baseUrl = item.baseUrl;
      context.bindRepo = item.bindRepo || {};
      context.bindBranch = item.bindBranch || {};
      context.bindFile = item.bindFile || {};
      resolve();
    });
  })
}

function initPageContent() {
  return Promise.all([
    $.get(chrome.runtime.getURL('content/button.html')),
    $.get(chrome.runtime.getURL('content/menu.html')),
    $.get(chrome.runtime.getURL('content/modal.html'))
  ])
  .then((content) => {
    $('#functionSelect').after(content[0]);
    $('body').children().last().after(content[1]);
    $('body').children().last().after(content[2]);
  })
  .then(() => {
    chrome.runtime.sendMessage({ cmd: "tab" });
  });
}

function initLoginContent() {
  $.get(chrome.runtime.getURL('content/login.html'))
  .then((content) => {
    $('#functionSelect').after(content);
    $('#login').hover(() => {
      $('#login').addClass('goog-toolbar-menu-button-hover');
    }, () => {
      $('#login').removeClass('goog-toolbar-menu-button-hover'); 
    });
    $('#login').click(() => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options/options.html'));
      }  
    });
    chrome.runtime.sendMessage({ cmd: "tab" });
  });
}

function initPageEvent() {
  ['repo', 'branch'].forEach((type) => {
    $(document).on('click', `.github-new-${type}`, () => {
      $(`.${type}-menu`).hide();
      changeModalState(type, true);
    });
    $(document).on('input propertychange', `#new-${type}-name`, (event) => {
      changeButtonState(type, event.target.value);
    });
    $(document).on('mouseover', `#${type}Select`, () => {
      $(`#${type}Select`).addClass('goog-toolbar-menu-button-hover');
    });
    $(document).on('mouseleave', `#${type}Select`, () => {
      $(`#${type}Select`).removeClass('goog-toolbar-menu-button-hover');
    });
    $(document).on('click', `#${type}Select`, () => {
      $(`#${type}Select`).toggleClass('goog-toolbar-menu-button-open');
      $(`.${type}-menu`).css("left", $(`#${type}Select`).position().left + 55).toggle();
    });
    $(document).on('click', `#github-create-${type}`, () => {
      changeModalState(type, false);
      window[`githubCreate${type.capitalize()}`]();
    });
  });

  ['repo', 'branch', 'diff'].forEach((type) => {
    $(document).on('click', `.github-${type}-modal-close`, () => {
      changeModalState(type, false);
    });
  });

  ['pull', 'push'].forEach((type) => {
    $(document).on('mouseover', `#${type}Button`, () => {
      $(`#${type}Button`).addClass('goog-toolbar-button-hover');
    });
    $(document).on('mouseleave', `#${type}Button`, () => {
      $(`#${type}Button`).removeClass('goog-toolbar-button-hover');
    });
    $(document).on('click', `#${type}Button`, () => {
      initProjectContext()
      .then(prepareCode)
      .then((data) => { showDiff.call(window[`github${type.capitalize()}`], data, type) }) //get more performance over callback
      .catch((err) => { showAlert(err.message, LEVEL_ERROR) });
    });
      if (type === 'repo') updateBranch();
  $(document).on('click', '.github-alert-dismiss', () => {
    $('.github-alert').remove();
  });
}

/*
 * get project context with google rpc
 * this is very volatile since it is juse inferred from code
 */
function initProjectContext() {
  const files = $('.item').toArray().map((e) => {
    const match = e.innerText.match(/(.*?)\.(gs|html)$/);
    if (!match || !match[1] || !match[2]) return;
    return match[1];
  });
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['requestUrl' ,'requestHeaders', 'requestBody', 'gasToken'], resolve);
  })
  .then((param) => {
    context.gasUrl = param.requestUrl;
    context.gasHeaders = param.requestHeaders;
    context.gasToken = param.gasToken;
    return $.ajax({
      url: param.requestUrl,
      headers: param.requestHeaders,
      method: 'POST',
      crossDomain: true,
      data: param.requestBody,
      dataType: 'text'
    })
  })
  .then((response) => {
    if (!response.startsWith('//OK')) throw new Error('Init failed');
    //evil eval, but it's simple to get the object since it's not valid json object
    const initData = eval(response.slice(4)).filter((e) => {
      return typeof(e) === 'object';
    })[0];
    let found = false;
    let projectId;
    let fileIds = {};
    let fileStack = [];
    for (let i = 0; i < initData.length; i++) {
      if (files.indexOf(initData[i]) >= 0) fileStack.push(initData[i]);
      if (/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(initData[i])) { //get file id;
        if (!found) { //the first file
          found = true;
          projectId = initData[i + 1]; //id is the next one of the first file id
        }
        fileIds[fileStack.pop()] = initData[i];
      }
    };
    context.projectId = projectId;
    context.fileIds = fileIds;
    return files;
  });
}

function prepareCode() {
  const files = $('.item').toArray().map((e) => {
    const match = e.innerText.match(/(.*?)\.(gs|html)$/);
    if (!match || !match[1] || !match[2]) return;
    return { 
      name: match[1], 
      type: match[2]
    };
  });
  const gasPromises = files.map((file) => {
      const payload = `7|1|8|https://script.google.com/macros/d/${context.projectId}/gwt/\|${context.gasToken}|_|getFileContent|j|${context.fileIds[file.name]}|${context.projectId}|k|1|2|3|4|1|5|5|6|7|8|0|0|`;
      $.ajax({
        url: context.gasUrl,
        headers: context.gasHeaders,
        method: 'POST',
        crossDomain: true,
        data: payload,
        dataType: 'text'
      .then((response) => {
        if (!response.startsWith('//OK'))  reject(new Error('get apps script code failed'));
        //evil eval, but it's simple to get the object since it's not valid json object
        const codeContent = eval(response.slice(4)).filter((e) => {
          return typeof(e) === 'object';
        })[0];
        resolve({file : `${file.name}.${file.type}`, content: codeContent[codeContent.length - 10]});
    })

    Promise.all(gasPromises),
    $.getJSON(
      `${baseUrl}/repos/${context.repo.fullName}/branches/${context.branch}`,
      { access_token: accessToken }
    )
    .then((response) => {
      return $.getJSON(
        `${baseUrl}/repos/${context.repo.fullName}/git/trees/${response.commit.commit.tree.sha}`,
        { recursive: 1, access_token: accessToken }
      );
    })
    .then((response) => {
      return Promise.all(
        response.tree.filter((tree) => {
          return tree.type === 'blob' && /(\.gs|\.html)$/.test(tree.path);
        })
        .map((tree) => {
          return $.getJSON(tree.url, {access_token: accessToken })
          .then((content) => {
            return { file: tree.path, content: decodeURIComponent(escape(atob(content.content)))};
          });
        })
      );
      gas: data[0].reduce((hash, elem) => {
        if (elem) hash[elem.file] = elem.content;
        return hash;
      }, {}),
      github: data[1].reduce((hash, elem) => {
        if (elem) hash[elem.file] = elem.content;
        return hash;
      }, {})
    return code;
  })
}

function showDiff(code, type) {
  if (Object.keys(code.github).length === 0 && type === "pull") {
    showAlert("There is nothing to pull", LEVEL_WARN);
    return;
  }
  //setting the diff model
  const oldCode = type === "push" ? code.github : code.gas;
  const newCode = type === "push" ? code.gas : code.github;
  const gasFiles = Object.keys(code.gas);
  const githubFiles = Object.keys(code.github);
  let diff = gasFiles.concat(githubFiles.filter((e) => {
    return gasFiles.indexOf(e) < 0;
  }))
  .reduce((diff, file) => {
    let mode = null;
    if (!oldCode[file]) {
      mode = 'new file mode 100644';
    } else if (!newCode[file]) {
      return diff;
    let fileDiff = JsDiff.createPatch(file, oldCode[file] || "", newCode[file]);
    if (fileDiff.indexOf('@@') < 0) return diff; //no diff
    let diffArr = fileDiff.split('\n');
    diffArr.splice(0, 2, `diff --git a/${file} b/${file}`);
    if (mode) {
      diffArr.splice(1, 0, mode);
    fileDiff = diffArr.join('\n');   
    return diff + fileDiff;
  }, "");

  if (diff === "") {
    showAlert("Everything already up-to-date", LEVEL_WARN);
    return;
  }

  const diffHtml = new Diff2HtmlUI({diff : diff});
  diffHtml.draw('.github-diff', {inputFormat: 'json', showFiles: false});
  diffHtml.highlightCode('.github-diff');
  $('.d2h-file-name-wrapper').each((i, e) => {
    const filename = $(e).children('.d2h-file-name').text();
    $(e).prepend(`<span><input type="checkbox" class="diff-file" checked="true" value="${filename}" style="margin-right: 10px;"></span>`);
  });
  $('#commit-comment').off().val("");
  $('#github-diff-handler').prop("disabled", false);
  if (oldCode === newCode) {
    $('#github-diff-handler').prop("disabled", true);
    $('.github-comment').hide();
  } else {
    if (type === 'push') { //push must have commit comment
      $('.github-comment').show();
      $('#github-diff-handler').prop("disabled", true);
      $('#commit-comment').on('input propertychange', (event) => {
        if (event.target.value === "") {
          $(`#github-diff-handler`).prop("disabled", true);
        } else {
          $(`#github-diff-handler`).prop("disabled", false);
        }
      });
      $('.github-comment').hide();
  }
  $('#github-diff-handler').text(type.capitalize()).off().click(() => {
    changeModalState('diff', false);
    this(code);
  });
  changeModalState('diff', true);
function githubPull(code) {
  const promises = $('.diff-file:checked').toArray().map((elem) => {
    const file = elem.value;
    const match = file.match(/(.*?)\.(gs|html)$/);
    if (!match || !match[1] || !match[2]) {
      showAlert('Unknow Error', LEVEL_ERROR);
      return;
    }
    const name = match[1];
    const type = match[2];
    
    if (!code.gas[file]) {
      return gasCreateFile(name, type)
      .then(() => {
        return gasUpdateFile(name, code.github[file]);
      })
    } else {
      return gasUpdateFile(name, code.github[file]);
    }
  });
  initProjectContext()
  .then(() => {
    return Promise.all(promises);
    showAlert("Successfully pulled from github");
  .catch((err) => {
    showAlert(err.message, LEVEL_ERROR);
function githubPush(code) {
  const promises = $('.diff-file:checked').toArray().map((elem) => {
    const file = elem.value;
    const payload = {
      content: code.gas[file],
      encoding: "utf-8"
    };
    return $.ajax({
    })
    .then((response) => {
      return {file: file, blob: response};
    })
  });

  Promise.all([
    Promise.all(promises),
    const tree = responses[0].map((data) => {
      return {
        path: data.file,
        sha: data.blob.sha
      }
    });
    const payload = {
      base_tree: responses[1].commit.commit.tree.sha,
      tree: tree
function getGithubRepos() {
  return $.ajax({
    url: `${baseUrl}/user/repos`,
    headers: {
      "Authorization": `token ${accessToken}`
    },
    method: 'GET',
    crossDomain: true,
    dataType: 'json',
    contentType: 'application/json'
  })
  .then((response) => {
    const repos = response.map((repo) => {
      return { name : repo.name, fullName : repo.full_name }
    });
    //if current bind still existed, use it
    const repo = context.bindRepo[context.id];
    if (repo && $.inArray(repo.name, repos.map(repo => repo.name)) >= 0 ) {
      context.repo = repo;
    }
    return repos;
  })
}

  $('.repo-menu').empty().append('<div class="github-new-repo github-item goog-menuitem"><div class="goog-menuitem-content">Create new repo</div></div>');
    $('.branch-menu').empty().append('<div class="github-new-branch github-item goog-menuitem"><div class="goog-menuitem-content">Create new branch</div></div>');
function gasCreateFile(file, type) {
  const typeId = type === 'gs' ? 0 : 2;
  const payload = `7|1|7|https://script.google.com/macros/d/${context.projectId}/gwt/\|${context.gasToken}|_|makeNewFile|18|g|${file}|1|2|3|4|2|5|6|7|6|${typeId}|`;
  return new Promise((resolve, reject) => {
    $.ajax({
      url: context.gasUrl,
      headers: context.gasHeaders,
      method: 'POST',
      crossDomain: true,
      data: payload,
      dataType: 'text'
    })
    .done((response) => {
      if (!response.startsWith('//OK')) reject(new Error(`Create file '${file}.${type}' failed`));
      const responseData = eval(response.slice(4)).filter((e) => {
        return typeof(e) === 'object';
      })[0];
      for (let i = 0; i < responseData.length; i++) {
        if (/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(responseData[i])) {
          context.fileIds[file] = responseData[i];
          resolve();
        }
      }
      reject(new Error('can not parse response'));
    })
    .fail((err) => {
      reject(new Error('Create file failed'));
    });
  });
}

function gasUpdateFile(file, code) {
  const escapedCode = code.replace(/\\/g, "\\\\").replace(/\|/g, '\\!');
  const payload = `7|1|8|https://script.google.com/macros/d/${context.projectId}/gwt/\|${context.gasToken}|_|updateFile|18|${file}||${escapedCode}|1|2|3|4|3|5|5|5|6|7|8|`;
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
    .done((response) => {
      if (!response.startsWith('//OK')) reject(new Error('Update file failed'));
      resolve();
    })
    .fail((err) => {
      reject(new Error('Update file failed'));
    });
  });
}

function changeModalState(type, toShow) {
  if (toShow) {
    const width = $('body').width();
    const height = $('body').height();
    const left = (width - 600) / 2
    $(`#${type}Modal`).before(`<div class="github-modal-bg modal-dialog-bg" style="opacity: 0.5; width: ${width}px; height: ${height}px;" aria-hidden="true"></div>`);
    $(`#${type}Modal`).css("left", left).show();
  } else {
    $(`#${type}Modal`).hide();
    $('.github-modal-bg').remove();
    $(`#new-${type}-name`).css('border-color', '');
  }
    $(`#github-create-${type}`).prop("disabled", true);
    $(`#new-${type}-name`).css('border-color', '#e0331e');
    $(`#github-create-${type}`).prop("disabled", false);
    $(`#new-${type}-name`).css('border-color', '');
/* show alert using gas ui
 * level: info, warning, error
 * but the class is promo. info, warning
 */
    $('#docs-butterbar-container').empty().append(content.replace(/_LEVEL_/g, level).replace(/_MESSAGE_/, message));
    observer.observe(document.getElementById('docs-butterbar-container'), { childList: true });