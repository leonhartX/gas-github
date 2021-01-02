'use strict';

let inited = false;
let currentUrl;
let gas;
let scm;
let context = {};
const LEVEL_ERROR = 'Warning';
const LEVEL_WARN = 'Info';
const LEVEL_INFO = 'Notice';
const observer = new MutationObserver((e) => {
  let url = window.location.href;
  if (url !== currentUrl) {
    if (url.endsWith('/edit') && currentUrl) {
      let contents = $('[jsrenderer=mUUYlf]');
      if (contents.length > 1) {
        contents[0].remove();
      }
      load();
    }
  }
  currentUrl = url;
});

observer.observe(document.getElementsByTagName('title')[0], {
  childList: true
})

$(() => {
  load();
})

function load() {
  initPageContent()
    .then(initContext)
    .then(updateRepo)
    .then(updateBranch)
    .then(updateGist)
    .then(initPageEvent)
    .catch((err) => {
      switch (err.message) {
        case 'need login':
          initLoginContent();
          break;
        case 'need auth':
          auth()
            .then(initContext)
            .then(updateRepo)
            .then(updateBranch)
            .then(updateGist)
            .then(initPageEvent)
          break;
        case 'not match':
          break;
        case 'nothing':
          break;
        case 'need relogin':
          initLoginContent();
          showLog('Extension has been updated, please relogin', LEVEL_WARN);
          break;
        default:
          showLog(err, LEVEL_ERROR);
          break;
      }
    });
}

function unload() {
  $('.Hu42fb').remove();
}



function initContext() {
  context = {};
  const id = getId();

  return new Promise((resolve, reject) => {
      chrome.storage.sync.get([
        'scm',
        'token',
        'user',
        'baseUrl',
        'bindRepo',
        'bindBranch',
        'bindType',
        'bindPattern',
        'bindConfig',
        'gapiRefreshToken',
        'gapiToken'
      ], (item) => {
        if (!item.token) {
          reject(new Error('need login'));
        } else if (!item.gapiToken) {
          reject(new Error('need auth'));
        } else {
          showLog('Updateing Repository');
        }
        gas = new ScriptApi();
        context.gapiRefreshToken = item.gapiRefreshToken;
        context.gapiToken = item.gapiToken;
        scm = createSCM(item);
        context.bindRepo = item.bindRepo || {};
        context.bindBranch = item.bindBranch || {};
        context.bindType = item.bindType || {};
        context.bindPattern = item.bindPattern || {};
        context.bindConfig = item.bindConfig || {};
        context.config = context.bindConfig[id] || {};
        context.config.filetype = context.config.filetype || context.bindType[id] || '.gs';
        context.config.ignorePattern = context.config.ignorePattern || context.bindPattern[id] || [];
        context.config.manifestEnabled = context.config.manifestEnabled || false;
        context.gist = context.bindRepo[id] && context.bindRepo[id].gist;
        resolve(scm);
      });
    })
    .then(scm => {
      return scm.getNamespaces()
        .then((owners) => {
          let first = true;
          owners.forEach((owner) => {
            let content = `<li class="repo-owner-option VfPpkd-rymPhb-ibnC6b VfPpkd-rOvkhd-rymPhb-ibnC6b-OWXEXe-tPcied-hXIJHe"
            role="menuitem" tabindex="-1">
            <span class="VfPpkd-rymPhb-pZXsl"></span>
            <span class="VfPpkd-rymPhb-b9t22c">${owner}</span></li>`
            $('#repo-owner-list').append(content);
            if (first) {
              $('#selected-repo-owner').text(owner);
              first =false;
            }
          });
          return scm;
        })
    })
    .then(scm => {
      return scm.getRepos();
    })
}

function initPageContent() {
  return Promise.all([
      $.get(chrome.runtime.getURL('content/button.html')),
      $.get(chrome.runtime.getURL('content/modal.html'))
    ])
    .then((content) => {
      $('.INSTk').last().before(content[0]);
      $('body').children().last().after(content[1]);
    })
    .then(() => {
      $(document).on('click', '.scm-alert-dismiss', () => {
        $('.scm-alert').remove();
      });
      chrome.runtime.sendMessage({
        cmd: 'tab'
      });
    });
}

function initLoginContent() {
  $.get(chrome.runtime.getURL('content/login.html'))
    .then((content) => {
      $('.INSTk').before(content);
      $('#login').click(() => {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options/options.html'));
        }
      });
      chrome.runtime.sendMessage({
        cmd: 'tab'
      });
    });
}

function initPageEvent() {
  if (inited) {
    return;
  }
  //bind global ui event handler
  $(document).mouseup((event) => {
    ['repo', 'branch'].forEach((type) => {
      const container = $(`.${type}-menu`);
      const button = $(`#${type}Select`);
      if (!container.is(event.target) &&
        !button.is(event.target) &&
        container.has(event.target).length === 0 &&
        button.has(event.target).length == 0) {
        container.hide();
        $(`#${type}Select`).removeClass('iWO5td');
      }
    });
  });

  $(document).on('mouseover', '.scm-item', (event) => {
    let target = $(event.target);
    if (!target.hasClass('scm-item')) {
      target = target.parent('.scm-item');
    }
    target.addClass('KKjvXb');
  });

  $(document).on('mouseleave', '.scm-item', (event) => {
    let target = $(event.target);
    if (!target.hasClass('scm-item')) {
      target = target.parent('.scm-item');
    }
    target.removeClass('KKjvXb');
  });

  ['repo', 'branch'].forEach((type) => {
    $(document).on('click', `#${type}Select`, () => {
      $(`#${type}Select`).toggleClass('iWO5td')
      const offset = $("[jsname=enzUi]").width() + 60;
      $(`.${type}-menu`).css('left', $(`#${type}Select`).position().left + offset).toggle();
    });
  });

  ['repo', 'branch', 'gist'].forEach((type) => {
    $(document).on('click', `.scm-new-${type}`, () => {
      $(`.${type}-menu`).hide();
      changeModalState(type, true);
    });

    $(document).on('click', `#scm-create-${type}`, () => {
      changeModalState(type, false);
      scm[`create${type.capitalize()}`]()
        .then(window[`handle${type.capitalize()}Created`])
        .catch(err => {
          showLog(err.message, LEVEL_ERROR);
        })
    });

    $(document).on('input propertychange', `#new-${type}-name`, (event) => {
      changeButtonState(type, event.target.value);
    });
  });

  ['repo', 'branch', 'gist', 'diff', 'config'].forEach((type) => {
    $(document).on('click', `.scm-${type}-modal-close`, () => {
      changeModalState(type, false);
    });
  });

  ['pull', 'push'].forEach(type => {
    $(document).on('click', `#${type}-button`, () => {
      prepareCode()
        .then((data) => {
          showDiff(data, type);
        }) //get more performance over callback
        .catch((err) => {
          showLog(err.message, LEVEL_ERROR);
        });
    });
  })

  $(document).on('click', '#config-button', () => {
    $('#filetype').text(context.config.filetype);
    $('#manage-manifest').prop("checked", context.config.manifestEnabled);
    $('#ignore-pattern').val(context.config.ignorePattern.join(';'));
    changeModalState('config', true);
  });

  ['suffix', 'repo-type', 'repo-owner', 'gist-type'].forEach(type => {
    $(document).on('click', `#${type}-select`, () => {
      $(`#${type}-select`).toggleClass('nnGvjf');
      $(`#${type}-list`).toggleClass('VfPpkd-xl07Ob-XxIAqe-OWXEXe-FNFY6c').toggleClass('VfPpkd-xl07Ob-XxIAqe-OWXEXe-uxVfW-FNFY6c-uFfGwd');
    });

    $(document).on('click', `.${type}-option`, (event) => {
      $(`#selected-${type}`).text(event.target.textContent.trim());
      $(`#${type}-select`).toggleClass('nnGvjf');
      $(`#${type}-list`).toggleClass('VfPpkd-xl07Ob-XxIAqe-OWXEXe-FNFY6c').toggleClass('VfPpkd-xl07Ob-XxIAqe-OWXEXe-uxVfW-FNFY6c-uFfGwd');
    });
  })

  $(document).on('click', '#save-config', () => {
    context.config.filetype = $('#filetype').text();
    context.config.manifestEnabled = $('#manage-manifest').prop("checked");
    context.config.ignorePattern = $('#ignore-pattern').val().split(';').filter(p => p !== '');
    context.bindConfig[getId()] = context.config;
    try {
      chrome.storage.sync.set({
        bindConfig: context.bindConfig
      });
      changeModalState('config', false);
    } catch (err) {
      showLog(err.message, LEVEL_ERROR);
    }
  })

  $(document).on('click', '.scm-item', (event) => {
    let target = $(event.target);
    if (!target.attr('scm-content')) {
      target = target.parent();
    }
    const type = target.attr('scm-content');
    let content;
    let label;
    switch (type) {
      case 'repo':
        if (getRepo() && target.attr('data') === context.repo.fullName) return;
        //update context.repo with name and fullName
        const fullName = target.attr('data');
        content = {
          fullName: fullName,
          gist: fullName === 'gist'
        }
        label = fullName;
        context.gist = content.gist;
        break;
      case 'branch':
        if (context[type] && target.text() === context[type]) return;
        content = target.attr('data');
        label = target.attr('data');
        break;
      default:
        return;
    }
    context[type] = content;
    const bindName = `bind${type.capitalize()}`;
    Object.assign(context[bindName], {
      [getId()]: content
    });
    chrome.storage.sync.set({
      [bindName]: context[bindName]
    }, () => {
      $(`.${type}-menu`).hide();
      if (type === 'repo') {
        $('#scm-bind-repo').text(label);
        if (content.gist) {
          updateGist();
        } else {
          updateBranch();
        }
      } else {
        $('#scm-bind-branch').text(label);
      }
    });
  });

  inited = true;
}

function auth() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      cmd: 'login',
      interactive: true
    }, token => {
      context.gapiToken = token;
      resolve(token);
    });
  });
}

function prepareCode() {
  return Promise.all([gas.getGasCode(), scm.getCode()])
    .then((data) => {
      return {
        gas: data[0],
        scm: data[1]
      };
    })
}

function showDiff(code, type) {
  if (Object.keys(code.scm).length === 0 && type === 'pull') {
    showLog('There is nothing to pull', LEVEL_WARN);
    return;
  }
  //setting the diff model
  const oldCode = type === 'push' ? code.scm : code.gas;
  const newCode = type === 'push' ? code.gas : code.scm;
  const gasFiles = Object.keys(code.gas);
  const scmFiles = Object.keys(code.scm);
  let diff = scmFiles.filter((e) => {
      return gasFiles.indexOf(e) < 0;
    })
    .concat(gasFiles)
    .filter(file => {
      if (context.config.manifestEnabled && file === 'appsscript.json') {
        return true;
      }
      for (let i = 0; i < context.config.ignorePattern.length; i++) {
        let p = new RegExp(context.config.ignorePattern[i]);
        if (p.test(file)) return false;
      }
      const regex = new RegExp(`(.*?)(${context.config.filetype}|\.html)$`)
      const match = file.match(regex);
      return match && match[1] && match[2];
    })
    .reduce((diff, file) => {
      let mode = null;
      if (!oldCode[file]) {
        mode = 'new file mode 100644';
      } else if (!newCode[file]) {
        if (file === 'appsscript.json') {
          return diff; //can not delete manifest file
        }
        mode = 'deleted file mode 100644';
      }
      let fileDiff = JsDiff.createPatch(file, oldCode[file] || '', newCode[file] || '');
      if (fileDiff.indexOf('@@') < 0) return diff; //no diff
      let diffArr = fileDiff.split('\n');
      diffArr.splice(0, 2, `diff --git a/${file} b/${file}`);
      if (mode) {
        diffArr.splice(1, 0, mode);
      }
      fileDiff = diffArr.join('\n');
      return diff + fileDiff;
    }, '');

  if (diff === '') {
    showLog('Everything already up-to-date', LEVEL_WARN);
    return;
  }

  const diffHtml = new Diff2HtmlUI({
    diff: diff
  });
  diffHtml.draw('.scm-diff', {
    inputFormat: 'json',
    showFiles: false
  });
  diffHtml.highlightCode('.scm-diff');
  $('.d2h-file-name-wrapper').each((i, e) => {
    const filename = $(e).children('.d2h-file-name').text();
    $(e).prepend(`<span><input type="checkbox" class="diff-file" checked="true" value="${filename}" style="margin-right: 10px;"></span>`);
  });
  $('#commit-comment').off().val('');
  $('#gist-desc').val('');
  $('#scm-diff-handler').prop('disabled', false);
  if (oldCode === newCode) {
    $('#scm-diff-handler').prop('disabled', true);
    $('.scm-comment').hide();
  } else {
    if (type === 'push' && !context.gist) { //push to repo must have commit comment
      $('.scm-comment').show();
      $('.gist-desc').hide();
      $('#scm-diff-handler').prop('disabled', true);
      $('#commit-comment').on('input propertychange', (event) => {
        $(`#scm-diff-handler`).prop('disabled', event.target.value === '');
      });
    } else if (type === 'push') { //push to gist can change desc
      $('.gist-desc').show();
      $('.scm-comment').hide();
    } else {
      $('.scm-comment').hide();
      $('.gist-desc').hide();
    }
  }
  $('#scm-diff-label').text(type.capitalize());
  $('#scm-diff-handler').off().click(() => {
    changeModalState('diff', false);
    if (type === 'push') {
      scm.push(code);
    } else {
      gas.pull(code);
    }
  });
  changeModalState('diff', true);
}

function updateRepo(repos) {
  $('.repo-menu').empty().append('<div class="scm-new-repo scm-item MocG8c epDKCb LMgvRb" tabindex="0" role="option"><div class="kRoyt MbhUzd ziS7vd"></div><span class="vRMGwf oJeWuf">Create new repo</span></div>');
  if (scm.canUseGist) {
    $('.repo-menu').append('<div class="scm-use-gist scm-item MocG8c epDKCb LMgvRb" tabindex="0" role="option" scm-content="repo" data="gist"><div class="kRoyt MbhUzd ziS7vd"></div><span class="vRMGwf oJeWuf">gist</span></div>');
  }

  repos.forEach((repo) => {
    let content = `<div class="scm-item MocG8c epDKCb LMgvRb" tabindex="-1" role="option" scm-content="repo" data="${repo}"><div class="kRoyt MbhUzd ziS7vd"></div><span class="vRMGwf oJeWuf">${repo}</span></div>`;
    $('.repo-menu').append(content);
  });
  showLog("Repository updated");
  if (context.repo) {
    $('#scm-bind-repo').text(context.repo.fullName);

    //highlight current repo in repos list
    // $(`[data="${context.repo.fullName}"]`).css('background-color', 'lightgray');
    return context.repo.fullName;
  }
  return null;
}

function updateGist() {
  if (!context.gist) {
    return null;
  }
  return scm.getAllGists()
    .then((gists) => {
      $('.branch-menu').empty().append('<div class="scm-new-gist scm-item MocG8c epDKCb LMgvRb" tabindex="0" role="option"><div class="kRoyt MbhUzd ziS7vd"></div><span class="vRMGwf oJeWuf">Create new gist</span></div>');
      gists.forEach((gist) => {
        let tooltip = gist.description === '' ? 'no description' : gist.description;
        let content = `<div class="scm-item MocG8c epDKCb LMgvRb" tabindex="-1" role="option" scm-content="branch" data="${gist.id}" title="${tooltip}"><div class="kRoyt MbhUzd ziS7vd"></div><span class="vRMGwf oJeWuf">${gist.id}</span></div>`;
        $('.branch-menu').append(content);
      });
      let gist = context.bindBranch[getId()];
      if ($.inArray(gist, gists.map(gist => gist.id)) < 0) {
        gist = '';
      }
      $('#scm-bind-branch').text(gist);
      //update context and storage
      context.branch = gist;
      Object.assign(context.bindBranch, {
        [getId()]: gist
      });
      chrome.storage.sync.set({
        bindBranch: context.bindBranch
      });
      return gist;
    });
}

function updateBranch() {
  if (!context.repo || context.gist) {
    return null;
  }
  return scm.getAllBranches()
    .then((branches) => {
      $('.branch-menu').empty().append('<div class="scm-new-branch scm-item MocG8c epDKCb LMgvRb" tabindex="0" role="option"><div class="kRoyt MbhUzd ziS7vd"></div><span class="vRMGwf oJeWuf">Create new branch</span></div>');
      branches.forEach((branch) => {
        let content = `<div class="scm-item MocG8c epDKCb LMgvRb" tabindex="-1" role="option" scm-content="branch" data="${branch.name}"><div class="kRoyt MbhUzd ziS7vd"></div><span class="vRMGwf oJeWuf">${branch.name}</span></div>`;
        $('.branch-menu').append(content);
      });
      let branch = context.bindBranch[getId()];
      if (branches.length === 0) {
        branch = '';
        if (scm.name === 'github') {
          showLog('This repository is empty, try to create a new branch such as [master] in Github', LEVEL_WARN);
        } else {
          showLog('This repository is empty, first create a new branch', LEVEL_WARN);
        }
      } else if ($.inArray(branch, branches.map(branch => branch.name)) < 0) {
        branch = ($.inArray("master", branches.map(branch => branch.name)) >= 0) ? 'master' : branches[0].name;
      }
      $('#scm-bind-branch').text(branch);
      //update context and storage
      context.branch = branch;
      Object.assign(context.bindBranch, {
        [getId()]: branch
      });
      chrome.storage.sync.set({
        bindBranch: context.bindBranch
      });
      return branch;
    });
}

function handleRepoCreated(repo) {
  return scm.getRepos()
    .then(updateRepo)
    .then(updateBranch)
    .then(() => {
      $('#new-repo-name').val('');
      $('#new-repo-desc').val('');
      $('#new-repo-type').val('public');
      showLog(`Successfully create new repository ${repo}`);
    })
    .catch(() => {
      throw new Error('Repository created, but failed to show the new repository.');
    });
}

function handleBranchCreated(branch) {
  return updateBranch()
    .then(() => {
      $('#new-branch-name').val('');
      showLog(`Successfully create new branch: ${branch}`);
    })
    .catch(() => {
      throw new Error('Branch created, but failed to show the new branch.');
    });
}

function handleGistCreated() {
  return updateGist()
    .then(() => {
      $('#new-gist-name').val('');
      $('#new-gist-public').val('public');
      showLog(`Successfully create new gist.`);
    })
    .catch(err => {
      throw new Error('Gist created, but failed to show the new gist.');
    });
}

function getBaseUrl() {
  return context.gasUrl.substring(0, context.gasUrl.indexOf('/gwt/')) + '/gwt/';
}

function changeModalState(type, toShow) {
  if (toShow) {
    const margin = 600;
    const width = $('body').width();
    const height = $('body').height();
    const left = (width - margin) / 2;
    $(`#${type}-modal`).show();
  } else {
    $(`#${type}-modal`).hide();
    $(`#new-${type}-name`).css('border-color', '');
  }
}

function changeButtonState(type, value) {
  if (!value || value === '') {
    $(`#scm-create-${type}`).prop('disabled', true);
    $(`#new-${type}-name`).css('border-color', '#e0331e');
  } else {
    $(`#scm-create-${type}`).prop('disabled', false);
    $(`#new-${type}-name`).css('border-color', '');
  }
}

/* show alert using gas ui
 * level: info, warning, error
 * but the class is promo. info, warning
 */
function showLog(message, level = LEVEL_INFO) {

  $.get(chrome.runtime.getURL('content/alert.html'))
    .then((content) => {
      $("[jsname=cFQkCb]").removeClass("LcqFFc");
      $("[jsname=cFQkCb] > [jsname=NR4lfb]").css("flex-basis", "150px")
      $('.Vod31b').html(content.replace(/_TIMESTAMP_/g, new Date().toLocaleTimeString()).replace(/_LEVEL_/g, level).replace(/_MESSAGE_/, message));
    })
}

String.prototype.capitalize = function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
}