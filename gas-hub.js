"use strict";
let context = {};
let baseUrl, accessToken, user;
const LEVEL_ERROR = "error";
const LEVEL_WARN = "warning";
const LEVEL_INFO = "info";
const CREATE_FUNC = {
  repo : githubCreateRepo,
  branch : githubCreateBranch,
  file : githubCreateFile
};

chrome.runtime.onMessage.addListener(() => {
  if ($('.github').length === 0) {
    initContext()
    .then(initLambdaList)
    .then(initPageContent)
    .then(getGithubRepos)
    .then(updateRepo)
    .then(updateBranch)
    .then(updateFile)
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
  }
});

$(() => {
  //bind ui event handler
  $.get(chrome.runtime.getURL('content/buttons.html'))
  .then((content) => {
    $('#docs-toolbar').append(content);
  })
  .then(() => {
    ['repo','branch','file'].forEach((type) => {
      $(`#${type}Select`).hover(() => {
        $(`#${type}Select`).addClass('goog-toolbar-menu-button-hover');
      }, () => {
        $(`#${type}Select`).removeClass('goog-toolbar-menu-button-hover'); 
      });
    });
    ['pull', 'push'].forEach((type) => {
      $(`#${type}Button`).hover(() => {
        $(`#${type}Button`).addClass('goog-toolbar-button-hover');
      }, () => {
        $(`#${type}Button`).removeClass('goog-toolbar-button-hover'); 
      });
    })
  });

  $(document).on('click', `#test`, (event) => {
    chrome.runtime.sendMessage({
      cmd: "request",
      param : {
        path: 'drive/v3/files'
      }
    }, (response) => {
      console.log(response);
    });
  });

/*
  $.ajaxSetup({ cache: false });
  ['repo', 'branch', 'file'].forEach((type) => {
    $(document).on('click', `#github-bind-${type}`, (event) => {
      $(`.github-${type}-dropdown`).show();
    });
    $(document).on('click', `#github-new-${type}`, (event) => { 
      showCreateContent(type) 
    });
    $(document).on('input propertychange', `#new-${type}-name`, (event) => {
      changeButtonState(type, event.target.value);
    });
    $(document).on('click', `.github-${type}-model-dismiss`, (event) => {
      changeModelState(type, false);
    });
    $(document).on('click', `#github-create-${type}`, (event) => {
      changeModelState(type, false);
      CREATE_FUNC[type]();
    });
  })

  $(document).on('click', '.github-diff-model-dismiss', () => {
    changeModelState('diff', false);
  })

  $(document).on('click', '.github-alert-dismiss', () => {
    $(event.target).parents('.github-alert').remove();
  });

  $(document).on('click', '#github-pull', () => {
    showDiff('Pull', githubPull);
  });
  $(document).on('click', '#github-push', () => {
    showDiff('Push', githubPush);
  });
  $(document).on('click', '#github-login', (event) => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  $(document).on('click', '.github-repo', (event) => {
    if (context.repo && event.target.text === context.repo.name) return;
    //update context.repo with name and fullName
    const name = event.target.text;
    const fullName = event.target.attributes.data.value;
    const repo = {
      name: name,
      fullName : fullName
    }
    context.repo = repo;
    Object.assign(context.bindRepo, { [context.functionName] : repo });
    if (context.bindBranch[context.functionName]) {
      delete context.bindBranch[context.functionName];
    }
    if (context.bindFile[context.functionName]) {
      delete context.bindFile[context.functionName];
    }
    chrome.storage.sync.set({ bindRepo: context.bindRepo }, () => {
      $('#github-bind-repo').text(`Repo: ${name}`);
      $('.github-repo-dropdown').hide();
      updateBranch()
      .then(updateFile);
    });
  });
  $(document).on('click', '.github-branch', (event) => {
    if (context.branch && event.target.text === context.branch) return;
    //update context.branch and save to storage
    const branch = event.target.text;
    context.branch = branch;
    Object.assign(context.bindBranch, { [context.functionName] : branch });
    chrome.storage.sync.set({ bindBranch: context.bindBranch }, () => {
      $('#github-bind-branch').text(`Branch: ${branch}`);
      $('.github-branch-dropdown').hide();
    });
  });
  $(document).on('click', '.github-file', (event) => {
    if (context.file && event.target.text === context.file) return;
    //update context.file and save to storage
    const file = event.target.text;
    context.file = file;
    Object.assign(context.bindFile, { [context.functionName] : file });
    chrome.storage.sync.set({ bindFile: context.bindFile }, () => {
      $('#github-bind-file').text(`File: ${file}`);
      $('.github-file-dropdown').hide();
    });
  });

  $(document).mouseup((event) => {
    ['repo', 'branch', 'file'].forEach((type) => {
      const container = $(`.github-${type}-dropdown`);
      if (!container.is(event.target) 
        && !$(`#github-${type}-repo`).is(event.target)
        && container.has(event.target).length === 0) {
        container.hide();
      }
    });
  });
*/
});

function showDiff(type, handler) {
  if (type === "Pull" && context.qualifier !== "$LATEST") {
    showAlert("Pull code is only available to $LATEST.", LEVEL_WARN);
    return;
  }
  return Promise.all([
    new Promise((resolve, reject) => {
      $.getJSON(
        `${baseUrl}/repos/${context.repo.fullName}/contents/${context.file}?ref=${context.branch}`,
        { access_token: accessToken }
      )
      .then((data) => {
        resolve($.get(data.download_url))
      })
      .fail((err) => {
        if (err.status === 404) resolve("");
        else reject(err);
      })
    }),
    $.ajax({
      url: 'https://' + context.endpoint + '/lambda/services/ajax?operation=getFunctionCode',
      headers: {
        "X-Csrf-Token" : context.csrf
      },
      method: 'POST',
      crossDomain: true,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        functionName: context.functionName,
        qualifier: context.qualifier,
        operation: "getFunctionCode"
      })
    })
  ])
  .then((data) => {
    const code = {
      github: data[0],
      lambda: data[1].code      
    }
    if (code.github === "" && type === "Pull") {
      showAlert("There is nothing to pull", LEVEL_WARN);
      return;
    }
    //setting the diff model
    const oldCode = type === "Push" ? code.github : code.lambda;
    const newCode = type === "Push" ? code.lambda : code.github;
    const diff = JsDiff.createPatch(context.file, oldCode, newCode);
    const diffHtml = new Diff2HtmlUI({diff : diff});
    diffHtml.draw('.github-diff', {inputFormat: 'json', showFiles: false});
    diffHtml.highlightCode('.github-diff');
    $('#commit-comment').off().val("");
    $('#github-diff-handler').prop("disabled", false).removeClass('awsui-button-disabled');
    if (oldCode === newCode) {
      $('#github-diff-handler').prop("disabled", true).addClass('awsui-button-disabled');
      $('.github-comment').hide();
    } else {
      if (type === 'Push') { //push must have commit comment
        $('.github-comment').show();
        $('#github-diff-handler').prop("disabled", true).addClass('awsui-button-disabled');
        $('#commit-comment').on('input propertychange', (event) => {
          if (event.target.value === "") {
            $(`#github-diff-handler`).prop("disabled", true).addClass('awsui-button-disabled');
          } else {
            $(`#github-diff-handler`).prop("disabled", false).removeClass('awsui-button-disabled');
          }
        });
      } else {
        $('.github-comment').hide();
      }
    }
    $('#github-diff-handler').text(type).off().click(() => {
      changeModelState('diff', false);
      handler(code);
    });
    changeModelState('diff', true);
  })
  .catch((err) => {
    if (!context.repo || !context.branch) {
      showAlert("Have not bind Github repository or branch.", LEVEL_WARN);
    } else {
      showAlert("Unknow error.", LEVEL_ERROR);
    }
  })
}

function githubPull(data) {
  const payload = {
    operation: "updateFunctionCode",
    codeSource: "inline",
    functionName: context.functionName,
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
    Object.assign(context.bindRepo, { [context.functionName] : repo });
    if (context.bindBranch[context.functionName]) {
      delete context.bindBranch[context.functionName];
    }
    chrome.storage.sync.set({ bindRepo: context.bindRepo });
    return response;
  })
  .then(getGithubRepos)
  .then(updateRepo)
  .then(updateBranch)
  .then(updateFile)
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
    Object.assign(context.bindBranch, { [context.functionName] : branch });
    chrome.storage.sync.set({ bindBranch: context.bindBranch });
    return context.repo.name;
  })
  .then(updateBranch)
  .then(updateFile)
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
  Object.assign(context.file, { [context.functionName] : file });
  chrome.storage.sync.set({ bindFile: context.bindFile }, () => {
    $('#new-file-name').val("");
  });
}

function showCreateContent(type) {
  $(`.github-${type}-dropdown`).hide();
  changeModelState(type, true);
}

function initContext() {
  context = {};
  const match = window.location.href.match(/https:\/\/(.*?)\/.*functions\/(.*?)(\?|\/)((.*)\?)?/);
  if (!match) return null;
  context.endpoint = match[1];
  context.functionName = match[2];
  context.qualifier = match[5]? match[5] : "$LATEST";

  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["csrf","token","user", "baseUrl", "bindRepo", "bindBranch", "bindFile"], (item) => {
      if (!item.token) {
        reject(new Error("need login"));
      }
      accessToken = item.token;
      user = item.user;
      baseUrl = item.baseUrl;
      context.bindRepo = item.bindRepo || {};
      context.bindBranch = item.bindBranch || {};
      context.bindFile = item.bindFile || {};
      if (item.csrf && item.csrf !== ""){
        context.csrf = item.csrf;
        resolve();
      }
      else reject(new Error("can not get csrf token"));
    });
  })
}

function initLambdaList() {
  return $.ajax({
    url: 'https://' + context.endpoint + '/lambda/services/ajax?operation=listFunctions',
    headers: {
      "X-Csrf-Token" : context.csrf
    },
    method: 'POST',
    crossDomain: true,
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify({operation: "listFunctions"})
  })
  .then((lambdas) => {
    context.functions = [];
    return lambdas.forEach((lambda) => {
      context.functions[lambda.name] = lambda
      if (lambda.name === context.functionName) {
        context.current = lambda;
        context.file = lambda.runtime.indexOf("nodejs") >= 0 ? "index.js" : "index.py";
      }
    })
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
    const repo = context.bindRepo[context.functionName];
    if (repo && $.inArray(repo.name, repos.map(repo => repo.name)) >= 0 ) {
      context.repo = repo;
    }
    return repos;
  })
}

function initPageContent() {
  const div = $('.awsmob-button-group');
  if($('.github').length !== 0 || div.length === 0 || div.children().length <= 2) {
    throw new Error("nothing to do");
  }

  $.get(chrome.runtime.getURL('content/model.html'))
  .then((content) => {
    $('#main').siblings().last().after(content);
  });

  return $.get(chrome.runtime.getURL('content/buttons.html'))
  .then((content) => {
    return div.children().last().after(content);
  });
}

function initLoginContent() {
  const div = $('.awsmob-button-group');
  if($('.github').length !== 0 || div.length === 0 || div.children().length <= 2) {
    return;
  }
  const htmlContent = '\
    <span class="github">\
      <awsui-button>\
        <button id="github-login" class="awsui-button awsui-button-size-normal awsui-button-variant-normal awsui-hover-child-icons" type="submit">Login to Github\
        </button>\
      </awsui-button>\
    </span>';
  div.children().last().after(htmlContent);
}

function updateRepo(repos) {
  $('#github-repos').empty().append('<li><a id="github-new-repo">Create new repo</a></li>');
  repos.forEach((repo) => {
    let liContent = `<li><a class="github-repo" data=${repo.fullName}>${repo.name}</a></li>`
    $('#github-repos').append(liContent);
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
    $('#github-branches').empty().append('<li><a id="github-new-branch">Create new branch</a></li>');
    branches.forEach((branch) => {
      let liContent = `<li><a class="github-branch" data=${branch.name}>${branch.name}</a></li>`
      $('#github-branches').append(liContent);
    });
    let branch = context.bindBranch[context.functionName];
    if (!branch && branches.length === 0) {
      branch = "";
      showAlert("This repository do not has any branch yet, try to create a new branch such as [master].", LEVEL_WARN);
    } else if ($.inArray(branch, branches.map(branch => branch.name)) < 0) {
      branch = ($.inArray("master", branches.map(branch => branch.name)) >= 0) ? "master" : branches[0].name;
    }
    $('#github-bind-branch').text(`Branch: ${branch}`);
    //update context and storage
    context.branch = branch;
    Object.assign(context.bindBranch, { [context.functionName] : branch });
    chrome.storage.sync.set({ bindBranch: context.bindBranch });
    return branch;
  });
}

function updateFile() {
  if (!context.branch) {
    return null;
  }
  return $.getJSON(
    `${baseUrl}/repos/${context.repo.fullName}/branches/${context.branch}`,
    { access_token: accessToken }
  )
  .then((branch) => {
     return $.getJSON(
      `${baseUrl}/repos/${context.repo.fullName}/git/trees/${branch.commit.commit.tree.sha}`,
      { access_token: accessToken, recursive: 1 }
    );   
  })
  .then((trees) => {
    $('#github-files').empty().append('<li><a id="github-new-file">Create new file</a></li>');
    trees.tree.forEach((file) => {
      if (file.type !== 'blob') return;
      let liContent = `<li><a class="github-file" data=${file.path}>${file.path}</a></li>`
      $('#github-files').append(liContent);
    });
    let file = context.bindFile[context.functionName];
    if (!file || $.inArray(file, trees.tree.map(tree => tree.path)) < 0) {
      file = context.current.runtime.indexOf("nodejs") >= 0 ? "index.js" : "index.py";
    }
    $('#github-bind-file').text(`File: ${file}`);
    //update context and storage
    context.file = file;
    Object.assign(context.file, { [context.functionName] : file });
    chrome.storage.sync.set({ bindFile: context.bindFile });
    return file;
  })
}

function changeModelState(type, toShow) {
  const index = toShow ? 0 : -1;
  const fromClass = toShow ? 'hidden' : 'fadeIn';
  const trasnferClass = toShow ? 'fadeIn' : 'fadeOut';
  const toClass = toShow ? 'showing' : 'hidden';
  $(`.github-${type}-model`).removeClass(`awsui-modal-__state-${fromClass}`).addClass(`awsui-modal-__state-${trasnferClass}`);
  setTimeout(() => {
    $(`.github-${type}-model`).removeClass(`awsui-modal-__state-${trasnferClass}`).addClass(`awsui-modal-__state-${toClass}`);
  },
  1000
  );
  $(`.github-${type}-modal-dialog`).attr('tabindex', index);
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