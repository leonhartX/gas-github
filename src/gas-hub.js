"use strict";

let context = {};
let baseUrl, accessToken, user;
const LEVEL_ERROR = "warning";
const LEVEL_WARN = "info";
const LEVEL_INFO = "promo";
const observer = new MutationObserver((e) => {
  observer.disconnect();
  $('.github-alert').remove();  
});

$(() => {
  initContext()
  .then(initPageContent)
  .then(getGithubRepos)
  .then(updateRepo)
  .then(updateBranch)
  .then(updateGist)
  .then(initPageEvent)
  .catch((err) => {
    switch (err.message) {
      case "need login" :
        initLoginContent();
        break;
      case "not match" :
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
  const match = window.location.href.match(/https:\/\/script\.google\.com(.*?)\/d\/([^/]*)\//);
  if (!match) return Promise.reject(new Error("not match"));
  context.isBound = match[1] === "/macros";
  context.id = match[2];

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
      context.gist = context.bindRepo[context.id] && context.bindRepo[context.id].gist;
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
  });

  ['repo', 'branch', 'gist'].forEach((type) => {
    $(document).on('click', `.github-new-${type}`, () => {
      $(`.${type}-menu`).hide();
      changeModalState(type, true);
    });

    $(document).on('click', `#github-create-${type}`, () => {
      changeModalState(type, false);
      window[`githubCreate${type.capitalize()}`]();
    });

    $(document).on('input propertychange', `#new-${type}-name`, (event) => {
      changeButtonState(type, event.target.value);
    });
  });

  ['repo', 'branch', 'gist', 'diff'].forEach((type) => {
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
      prepareCode()
      .then((data) => { showDiff.call(window[type], data, type) }) //get more performance over callback
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
          fullName : fullName,
          gist: fullName === 'gist'
        }
        label = name;
        context.gist = content.gist
        break;
      case 'branch' :
        if (context[type] && target.text() === context[type]) return;
        content = target.attr('data');
        label = target.attr('data');
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
      if (type === 'repo') {
        $('#github-bind-repo').text(`Repo: ${label}`);
        if (content.gist) {
          updateGist();
        } else {
          updateBranch();
        }
      } else {
        $('#github-bind-branch').text(`${context.gist ? 'Gist' : 'Branch'}: ${label}`);
      }
    });
  });

  $(document).on('click', '.github-alert-dismiss', () => {
    $('.github-alert').remove();
  });
}

function prepareCode() {
  return Promise.all([getGasCode(), getGithubCode()])
  .then((data) => {
    const files = $('.item').toArray().reduce((hash, e) => {
      const match = e.innerText.match(/(.*?)\.(gs|html)$/);
      if (!match || !match[1] || !match[2]) return hash;
      hash[match[1]] = match[0];
      return hash;
    }, {});
    const code = {
      gas: data[0].reduce((hash, elem) => {
        if (elem) hash[files[elem.file]] = elem.content;
        return hash;
      }, {}),
      github: data[1].reduce((hash, elem) => {
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
  $('#gist-desc').val("");
  $('#github-diff-handler').prop("disabled", false);
  if (oldCode === newCode) {
    $('#github-diff-handler').prop("disabled", true);
    $('.github-comment').hide();
  } else {
    if (type === 'push' && !context.gist) { //push to repo must have commit comment
      $('.github-comment').show();
      $('.gist-desc').hide();
      $('#github-diff-handler').prop("disabled", true);
      $('#commit-comment').on('input propertychange', (event) => {
        if (event.target.value === "") {
          $(`#github-diff-handler`).prop("disabled", true);
        } else {
          $(`#github-diff-handler`).prop("disabled", false);
        }
      });
    } else if (type === 'push') { //push to gist can change desc
      $('.gist-desc').show();
      $('.github-comment').hide();
    } else {
      $('.github-comment').hide();
      $('.gist-desc').hide();
    }
  }
  $('#github-diff-handler').text(type.capitalize()).off().click(() => {
    changeModalState('diff', false);
    this(code);
  });
  changeModalState('diff', true);
}

function updateRepo(repos) {
  $('.repo-menu').empty().append('<div class="github-new-repo github-item goog-menuitem"><div class="goog-menuitem-content">Create new repo</div></div>');
  $('.repo-menu').append('<div class="github-use-gist github-item goog-menuitem"><div class="goog-menuitem-content" github-content="repo" data="gist">Using Gist</div></div>');
  
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

function updateGist() {
  if (!context.gist) {
    return null;
  }
  return getAllItems(Promise.resolve({items: [], url: `${baseUrl}/users/${user}/gists?access_token=${accessToken}`}))
  .then((gists) => {
    $('.branch-menu').empty().append('<div class="github-new-gist github-item goog-menuitem"><div class="goog-menuitem-content">Create new gist</div></div>');
    gists.forEach((gist) => {
      let tooltip = gist.description === "" ? "no description" : gist.description;
      let content = `<div class="github-item goog-menuitem"><div class="goog-menuitem-content" github-content="branch" data="${gist.id}" title="${tooltip}">${gist.id}</div></div>`
      $('.branch-menu').append(content);
    });
    let gist = context.bindBranch[context.id];
    if ($.inArray(gist, gists.map(gist => gist.id)) < 0) {
      gist = "";
    }
    $('#github-bind-branch').text(`Gist: ${gist}`);
    //update context and storage
    context.branch = gist;
    Object.assign(context.bindBranch, { [context.id] : gist });
    chrome.storage.sync.set({ bindBranch: context.bindBranch });
    return gist;
  });
}

function updateBranch() {
  if (!context.repo || context.gist) {
    return null;
  }
  return getAllItems(Promise.resolve({items: [], url: `${baseUrl}/repos/${context.repo.fullName}/branches?access_token=${accessToken}`}))
  .then((branches) => {
    $('.branch-menu').empty().append('<div class="github-new-branch github-item goog-menuitem"><div class="goog-menuitem-content">Create new branch</div></div>');
    branches.forEach((branch) => {
      let content = `<div class="github-item goog-menuitem"><div class="goog-menuitem-content" github-content="branch" data="${branch.name}">${branch.name}</div></div>`
      $('.branch-menu').append(content);
    });
    let branch = context.bindBranch[context.id];
    if (branches.length === 0) {
      branch = "";
      showAlert("This repository is empty, try to create a new branch such as [master] in Github.", LEVEL_WARN);
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

function getBaseUrl() {
  if(context.isBound) {
    return `https://script.google.com/macros/d/${context.projectId}/gwt/`;
  } else {
    return `https://script.google.com/d/${context.id}/gwt/`
  }
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
    observer.disconnect();
    $('#docs-butterbar-container').empty().append(content.replace(/_LEVEL_/g, level).replace(/_MESSAGE_/, message));
    observer.observe(document.getElementById('docs-butterbar-container'), { childList: true });
  })
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}