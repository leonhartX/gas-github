"use strict";
let context = {};
let baseUrl, accessToken, user;
const LEVEL_ERROR = "warning";
const LEVEL_WARN = "info";
const LEVEL_INFO = "promo";
const observer = new MutationObserver(() => {
  $('.github-alert').remove();
  observer.disconnect();
});

$(() => {
  initContext()
  .then(initPageContent)
  .then(getGithubRepos)
  .then(updateRepo)
  .then(updateBranch)
  .then(initPageEvent)
  .catch((err) => {
    switch (err.message) {
      case "need login" :
        initLoginContent();
        break;
      case "nothing" :
        break;
      default:
        showAlert("Unknow Error", LEVEL_ERROR);
        break;
    }
  });
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
  //bind global ui event handler
  $(document).mouseup((event) => {
    ['repo', 'branch'].forEach((type) => {
      const container = $(`.${type}-menu`);
      const button = $(`#${type}Select`);
      if (!container.is(event.target) 
        && !button.is(event.target)
        && container.has(event.target).length === 0
        && button.has(event.target).length == 0) {
        container.hide();
        $(`#${type}Select`).removeClass('goog-toolbar-menu-button-open');
      }
    });
  });

  $(document).on('mouseover', '.github-item', (event) => {
    let target = $(event.target);
    if (!target.hasClass('github-item')) {
      target = target.parent('.github-item');
    }
    target.addClass('goog-menuitem-highlight');
  });

  $(document).on('mouseleave', '.github-item', (event) => {
    let target = $(event.target);
    if (!target.hasClass('github-item')) {
      target = target.parent('.github-item');
    }
    target.removeClass('goog-menuitem-highlight');
  });

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
  });

  $(document).on('click', '.github-item', (event) => {
    let target = $(event.target);
    if (!target.hasClass('goog-menuitem-content')) {
      target = target.children();
    }
    const type = target.attr('github-content');
    let content;
    let label;
    switch (type) {
      case 'repo' :
        if (context.repo && target.text() === context.repo.name) return;
        //update context.repo with name and fullName
        const name = target.text();
        const fullName = target.attr('data');
        content = {
          name: name,
          fullName : fullName
        }
        label = name;
        break;
      case 'branch' :
        if (context[type] && target.text() === context[type]) return;
        content = target.text();
        label = target.text();
        break;
      default:
        return;
    } 
    context[type] = content;
    const bindName = `bind${type.capitalize()}`;
    Object.assign(context[bindName], { [context.id] : content });
    chrome.storage.sync.set({ [bindName]: context[bindName] }, () => {
      $(`#${type}Select`).removeClass('goog-toolbar-menu-button-open');
      $(`.${type}-menu`).hide();
      $(`#github-bind-${type}`).text(`${type.capitalize()}: ${label}`);
      if (type === 'repo') updateBranch();
    });
  });

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
    const ids = initData.filter((data) => { return /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(data) });
    context.projectId = initData[initData.indexOf(ids[0]) + 1];
    if (!/\w{33}/.test(context.projectId)) {
      reject(new Error('cant not get project ID'));
    }
    const promises = ids.map((id) => {
      return new Promise((resolve, reject) => {
        const payload = `7|1|8|https://script.google.com/macros/d/${context.projectId}/gwt/\|${context.gasToken}|_|getFileContent|j|${id}|${context.projectId}|k|1|2|3|4|1|5|5|6|7|8|0|0|`;
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
          resolve({file : codeContent[codeContent.length - 6], content: codeContent[codeContent.length - 10], id : id });
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
  });
}

function prepareCode(gasFiles) {
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
  })
  .then((data) => {
    const files = $('.item').toArray().reduce((hash, e) => {
      const match = e.innerText.match(/(.*?)\.(gs|html)$/);
      if (!match || !match[1] || !match[2]) return hash;
      hash[match[1]] = match[0];
      return hash;
    }, {});
    const code = {
      gas: gasFiles.reduce((hash, elem) => {
        if (elem) hash[files[elem.file]] = elem.content;
        return hash;
      }, {}),
      github: data.reduce((hash, elem) => {
        if (elem) hash[elem.file] = elem.content;
        return hash;
      }, {})
    }
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
    }
    let fileDiff = JsDiff.createPatch(file, oldCode[file] || "", newCode[file]);
    if (fileDiff.indexOf('@@') < 0) return diff; //no diff
    let diffArr = fileDiff.split('\n');
    diffArr.splice(0, 2, `diff --git a/${file} b/${file}`);
    if (mode) {
      diffArr.splice(1, 0, mode);
    }
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
    } else {
      $('.github-comment').hide();
    }
  }
  $('#github-diff-handler').text(type.capitalize()).off().click(() => {
    changeModalState('diff', false);
    this(code);
  });
  changeModalState('diff', true);
}

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
  })
  .then(() => {
    showAlert("Successfully pulled from github");
    location.reload();
  })
  .catch((err) => {
    showAlert(err.message, LEVEL_ERROR);
  });
}

function githubPush(code) {
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
    });
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

function githubCreateRepo() {
  const repo = $('#new-repo-name').val();
  const desc = $('#new-repo-desc').val();
  const payload = {
    name : repo,
    description : desc,
    auto_init : true
  }
  if (!repo || repo === "") return;
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
  .fail((err) => {
    showAlert("Failed to create new repository.", LEVEL_ERROR);
  });
}

function githubCreateBranch() {
  const branch = $('#new-branch-name').val();
  if (!branch || branch === "") return;
  $.getJSON(
    `${baseUrl}/repos/${context.repo.fullName}/git/refs/heads/master`,
    { access_token: accessToken }
  )
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
  .fail((err) => {
    showAlert("Failed to create new branch.", LEVEL_ERROR);
  });
}

function updateRepo(repos) {
  $('.repo-menu').empty().append('<div class="github-new-repo github-item goog-menuitem"><div class="goog-menuitem-content">Create new repo</div></div>');
  repos.forEach((repo) => {
    let content = `<div class="github-item goog-menuitem"><div class="goog-menuitem-content" github-content="repo" data="${repo.fullName}">${repo.name}</div></div>`
    $('.repo-menu').append(content);
  });
  if (context.repo) {
    $('#github-bind-repo').text(`Repo: ${context.repo.name}`);
    return context.repo.name;
  }
  return null;
}

function updateBranch() {
  if (!context.repo) {
    return null;
  }
  return $.getJSON(
    `${baseUrl}/repos/${context.repo.fullName}/branches`,
    { access_token: accessToken }
  )
  .done((branches) => {
    $('.branch-menu').empty().append('<div class="github-new-branch github-item goog-menuitem"><div class="goog-menuitem-content">Create new branch</div></div>');
    branches.forEach((branch) => {
      let content = `<div class="github-item goog-menuitem"><div class="goog-menuitem-content" github-content="branch" data="${branch.name}">${branch.name}</div></div>`
      $('.branch-menu').append(content);
    });
    let branch = context.bindBranch[context.id];
    if (!branch && branches.length === 0) {
      branch = "";
      showAlert("This repository do not has any branch yet, try to create a new branch such as [master].", LEVEL_WARN);
    } else if ($.inArray(branch, branches.map(branch => branch.name)) < 0) {
      branch = ($.inArray("master", branches.map(branch => branch.name)) >= 0) ? "master" : branches[0].name;
    }
    $('#github-bind-branch').text(`Branch: ${branch}`);
    //update context and storage
    context.branch = branch;
    Object.assign(context.bindBranch, { [context.id] : branch });
    chrome.storage.sync.set({ bindBranch: context.bindBranch });
    return branch;
  });
}

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
    .then((response) => {
      if (!response.startsWith('//OK')) reject(new Error(`Create file '${file}.${type}' failed`));
      const responseData = eval(response.slice(4)).filter((e) => {
        return typeof(e) === 'object';
      })[0];
      const id = responseData.filter((data) => { return /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(data) });
      if (id.length > 0) {
        context.fileIds[file] = id[0];
        resolve();
      } else {
        reject(new Error('can not parse response'));
      }
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
}

function changeButtonState(type, value) {
  if (!value || value === "") {
    $(`#github-create-${type}`).prop("disabled", true);
    $(`#new-${type}-name`).css('border-color', '#e0331e');
  } else {
    $(`#github-create-${type}`).prop("disabled", false);
    $(`#new-${type}-name`).css('border-color', '');
  }
}

/* show alert using gas ui
 * level: info, warning, error
 * but the class is promo. info, warning
 */
function showAlert(message, level=LEVEL_INFO) {
  $.get(chrome.runtime.getURL('content/alert.html'))
  .then((content) => {
    $('#docs-butterbar-container').empty().append(content.replace(/_LEVEL_/g, level).replace(/_MESSAGE_/, message));
    observer.observe(document.getElementById('docs-butterbar-container'), { childList: true });
  });
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}