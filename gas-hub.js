"use strict";
let context = {};
let baseUrl, accessToken, user;
const LEVEL_ERROR = "error";
const LEVEL_WARN = "warning";
const LEVEL_INFO = "info";
const CREATE_FUNC = {
  repo : githubCreateRepo,
  branch : githubCreateBranch
};

$(() => {
  initContext()
  .then(initPageContent)
  .then(getGithubRepos)
  .then(updateRepo)
  .then(updateBranch)
  .then(setObserver)
  .catch((err) => {
    switch (err.message) {
      case "need login" :
        initLoginContent();
        break;
      case "nothing" :
        break;
      default:
        console.log(err);
        // showAlert("Unknow Error", LEVEL_ERROR);
        break;
    }
  });
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

  $(document).on('click', `.github-diff-modal-close`, (event) => {
    changeModalState("diff", false);
  });

  $(document).on('click', `#test`, (event) => {
    initProjectContext()
    .then(prepareCode)
    .then((data) => showDiff(data, 'Pull',null));
    // chrome.runtime.sendMessage({
    //   cmd: "request",
    //   param : {
    //     path: `drive/v3/files/${context.id}/export`,
    //     params: { mimeType: 'application/vnd.google-apps.script+json' }
    //   }
    // }, (response) => {
    //   console.log(response);
    // });
    // $.get(chrome.runtime.getURL('content/modal.html'))
    // .then((content) => {
    //   $('body').children().last().after(content);
    // });
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
      if (type === 'repo') {
        updateBranch();
      }
    });
  });
});

function prepareCode() {
  const files = $('.item').toArray().map((e) => {
    const fileInfo = e.innerText.split('.');
    return { 
      name: fileInfo[0], 
      type: fileInfo[1] 
    };
  });

  const gasPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      const payload = `7|1|8|https://script.google.com/macros/d/${context.projectId}/gwt/\|${context.gasToken}|_|getFileContent|j|${context.fileIds[file.name]}|${context.projectId}|k|1|2|3|4|1|5|5|6|7|8|0|0|`;
      $.ajax({
        url: context.gasUrl,
        headers: context.gasHeaders,
        method: 'POST',
        crossDomain: true,
        data: payload,
        dataType: 'text'
      })
      .then((response) => {
        if (!response.startsWith('//OK')) throw new Error('Init failed');
        //evil eval, but it's simple to get the object since it's not valid json object
        const codeContent = eval(response.slice(4)).filter((e) => {
          return typeof(e) === 'object';
        })[0];
        resolve({file : `${file.name}.${file.type}`, content: codeContent[codeContent.length - 10]});
      });
    })
  });

  return Promise.all([
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
          return tree.type === 'blob';
        })
        .map((tree) => {
          return $.getJSON(tree.url, {access_token: accessToken })
          .then((content) => {
            return { file: tree.path, content: decodeURIComponent(escape(atob(content.content)))};
          });
        })
      );
    })
  ])
  .then((data) => {
    const code = {
      gas: data[0].reduce((hash, elem) => {
        if (elem) hash[elem.file] = elem.content;
        return hash;
      }, {}),
      github: data[1].reduce((hash, elem) => {
        if (elem) hash[elem.file] = elem.content;
        return hash;
      }, {})
    }
    return code;
  })
  .catch((err) => {
    if (!context.repo || !context.branch) {
      showAlert("Have not bind Github repository or branch.", LEVEL_WARN);
    } else {
      showAlert("Unknow error.", LEVEL_ERROR);
    }
  })
}

function showDiff(code, type, handler) {
  if (Object.keys(code.github).length === 0 && type === "Pull") {
    showAlert("There is nothing to pull", LEVEL_WARN);
    return;
  }
  //setting the diff model
  const oldCode = type === "Push" ? code.github : code.gas;
  const newCode = type === "Push" ? code.gas : code.github;
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
      mode = 'deleted file mode 100644';
    }
    let fileDiff = JsDiff.createPatch(file, oldCode[file] || "", newCode[file] || "");
    let diffArr = fileDiff.split('\n');
    if (mode) {
      diffArr.splice(0, 2, `diff --git a/${file} b/${file}`, mode);
    }
    else {
      diffArr.splice(0, 2, `diff --git a/${file} b/${file}`);
    }
    fileDiff = diffArr.join('\n');   
    return diff + fileDiff;
  }, "");
  console.log(diff);
  const diffHtml = new Diff2HtmlUI({diff : diff});
  diffHtml.draw('.github-diff', {inputFormat: 'json', showFiles: false});
  diffHtml.highlightCode('.github-diff');
  // $('#commit-comment').off().val("");
  // $('#github-diff-handler').prop("disabled", false).removeClass('awsui-button-disabled');
  // if (oldCode === newCode) {
  //   $('#github-diff-handler').prop("disabled", true).addClass('awsui-button-disabled');
  //   $('.github-comment').hide();
  // } else {
  //   if (type === 'Push') { //push must have commit comment
  //     $('.github-comment').show();
  //     $('#github-diff-handler').prop("disabled", true).addClass('awsui-button-disabled');
  //     $('#commit-comment').on('input propertychange', (event) => {
  //       if (event.target.value === "") {
  //         $(`#github-diff-handler`).prop("disabled", true).addClass('awsui-button-disabled');
  //       } else {
  //         $(`#github-diff-handler`).prop("disabled", false).removeClass('awsui-button-disabled');
  //       }
  //     });
  //   } else {
  //     $('.github-comment').hide();
  //   }
  // }
  $('#github-diff-handler').text(type).off().click(() => {
    changeModalState('diff', false);
    handler(code);
  });
  // $('#diffModal').show();
  changeModalState('diff', true);
}

function githubPull(data) {
  const payload = {
    operation: "updateFunctionCode",
    codeSource: "inline",
    functionName: context.id,
    handler: context.current.handler,
    runtime: context.current.runtime,
    inline: data.github
  };
  $.ajax({
    url: 'https://' + context.endpoint + '/lambda/services/ajax?operation=updateFunctionCode',
    headers: {
      "X-Csrf-Token" : context.csrf
    },
    method: 'POST',
    crossDomain: true,
    contentType: 'application/json',
    data: JSON.stringify(payload)
  })
  .then(() => {
    location.reload();
  })
  .fail((err) => {
    showAlert("Failed to pull", LEVEL_ERROR);
  });
}

function githubPush(data) {
  const payload = {
    content: data.lambda,
    encoding: "utf-8"
  };
  Promise.all([
     $.ajax({
      url: `${baseUrl}/repos/${context.repo.fullName}/git/blobs`,
      headers: {
        "Authorization": `token ${accessToken}`
      },
      method: 'POST',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(payload)
    }),
    $.getJSON(
      `${baseUrl}/repos/${context.repo.fullName}/branches/${context.branch}`,
      { access_token: accessToken }
    )
  ])
  .then((responses) => {
    const payload = {
      base_tree: responses[1].commit.commit.tree.sha,
      tree : [{
        path: context.file,
        mode: "100644",
        type: "blob",
        sha: responses[0].sha
      }]
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

function githubCreateFile() {
  const file = $('#new-file-name').val();
  if (!file || file === "") return;
  $('#github-bind-file').text(`File: ${file}`);
  //update context and storage
  context.file = file;
  Object.assign(context.file, { [context.id] : file });
  chrome.storage.sync.set({ bindFile: context.bindFile }, () => {
    $('#new-file-name').val("");
  });
}

function showCreateContent(type) {
  $(`.github-${type}-dropdown`).hide();
  changeModalState(type, true);
}

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

function setObserver() {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const target = $(mutation.target);
        if (target.hasClass('item selected')) {
          context.file = target.text();
          console.log(context.file);
        }
      });
    });
    const config = { attributes: true, attributeFilter:['class'], subtree: true, attributeOldValue: true };
    const checkMenu = setInterval(() => {
      if ($('.project-items-list').length > 0) {
        observer.observe($('.project-items-list')[0], config);
        clearInterval(checkMenu);
        resolve();
      }
    }, 1000);
  });
}

/*
 * get project context with google rpc
 * this is very volatile since it is juse inferred from code
 */
function initProjectContext() {
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
    for (let i = 0; i < initData.length; i++) {
      if (/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(initData[i])) { //get file id;
        if (!found) { //the first file
          found = true;
          projectId = initData[i + 1]; //id is the next one of the first file id
          fileIds[initData[i - 2]] = initData[i];
        } else {
          fileIds[initData[i - 1]] = initData[i];
        }
      }
    }
    context.projectId = projectId;
    context.fileIds = fileIds;
    console.log(context);
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
    ['repo','branch'].forEach((type) => {
      $(`#${type}Select`).hover((event) => {
        $(`#${type}Select`).addClass('goog-toolbar-menu-button-hover');
      }, (event) => {
        $(`#${type}Select`).removeClass('goog-toolbar-menu-button-hover'); 
      });
      $(`#${type}Select`).click(() => {
        $(`#${type}Select`).toggleClass('goog-toolbar-menu-button-open');
        $(`.${type}-menu`).css("left", $(`#${type}Select`).position().left + 55).toggle();
      });
    });
    ['pull', 'push'].forEach((type) => {
      $(`#${type}Button`).hover(() => {
        $(`#${type}Button`).addClass('goog-toolbar-button-hover');
      }, () => {
        $(`#${type}Button`).removeClass('goog-toolbar-button-hover'); 
      });
    });
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

function updateRepo(repos) {
  $('.repo-menu').empty().append('<div class="goog-menuitem"><div class="goog-menuitem-content">Create new repo</div></div>');
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
    $('.branch-menu').empty().append('<div class="goog-menuitem"><div class="goog-menuitem-content">Create new branch</div></div>');
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
  }
}

function changeButtonState(type, value) {
  if (!value || value === "") {
    $(`#github-create-${type}`).prop("disabled", true).addClass('awsui-button-disabled');
  } else {
    $(`#github-create-${type}`).prop("disabled", false).removeClass('awsui-button-disabled');
  }
}

//show alert using aws ui
//level: info, warning, error
function showAlert(message, level=LEVEL_INFO) {
  $.get(chrome.runtime.getURL('content/alert.html'))
  .then((content) => {
    $('.content').before(content.replace(/_INFO_/g, level).replace(/_MESSAGE_/, message));
  });
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}