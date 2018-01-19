'use strict';

const gas = new Gas();
let scm;
let context = {};
const LEVEL_ERROR = 'warning';
const LEVEL_WARN = 'info';
const LEVEL_INFO = 'promo';
const observer = new MutationObserver((e) => {
  observer.disconnect();
  $('.scm-alert').remove();
});

$(() => {
  initPageContent()
  .then(initContext)
  .then(updateRepo)
  .then(updateBranch)
  .then(updateGist)
  .then(initPageEvent)
  .catch((err) => {
    switch (err.message) {
      case 'need login' :
        initLoginContent();
        break;
      case 'not match' :
        break;
      case 'nothing' :
        break;
      case 'need relogin':
        initLoginContent();
        showAlert('Extension has been updated, please relogin', LEVEL_WARN);
        break;
      default:
        showAlert('Unknow Error', LEVEL_ERROR);
        break;
    }
  });
});

function initContext() {
  context = {};
  const match = window.location.href.match(/https:\/\/script\.google\.com(.*?)\/d\/([^/]*)\//);
  if (!match) return Promise.reject(new Error('not match'));
  context.isBound = match[1] === '/macros';
  context.id = match[2];

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
      'bindConfig'
    ], (item) => {
      if (!item.token) {
        reject(new Error('need login'));
      }
      scm = createSCM(item);
      context.bindRepo = item.bindRepo || {};
      context.bindBranch = item.bindBranch || {};
      context.bindType = item.bindType || {};
      context.bindPattern = item.bindPattern || {};
      context.bindConfig = item.bindConfig || {};
      context.config = context.bindConfig[context.id] || {};
      context.config.filetype = context.config.filetype || context.bindType[context.id] || '.gs';
      context.config.ignorePattern = context.config.ignorePattern || context.bindPattern[context.id] || [];
      context.config.manifestEnabled = context.config.manifestEnabled || false;
      context.gist = context.bindRepo[context.id] && context.bindRepo[context.id].gist;
      resolve(scm);
    });
  })
  .then(scm => {
    return scm.getNamespaces()
    .then((owners) => {
      owners.forEach((owner) => {
        let content = `<option value="${owner}">${owner}</option>`
        $('#new-repo-owner').append(content);
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
    $.get(chrome.runtime.getURL('content/menu.html')),
    $.get(chrome.runtime.getURL('content/modal.html'))
  ])
  .then((content) => {
    $('#functionSelect').after(content[0]);
    $('body').children().last().after(content[1]);
    $('body').children().last().after(content[2]);
  })
  .then(() => {
    $(document).on('click', '.scm-alert-dismiss', () => {
      $('.scm-alert').remove();
    });
    chrome.runtime.sendMessage({ cmd: 'tab' });
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
    chrome.runtime.sendMessage({ cmd: 'tab' });
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

  $(document).on('mouseover', '.scm-item', (event) => {
    let target = $(event.target);
    if (!target.hasClass('scm-item')) {
      target = target.parent('.scm-item');
    }
    target.addClass('goog-menuitem-highlight');
  });

  $(document).on('mouseleave', '.scm-item', (event) => {
    let target = $(event.target);
    if (!target.hasClass('scm-item')) {
      target = target.parent('.scm-item');
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
      $(`.${type}-menu`).css('left', $(`#${type}Select`).position().left + 55).toggle();
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
        showAlert(err.message, LEVEL_ERROR);
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

  ['pull', 'push', 'config'].forEach((type) => {
    $(document).on('mouseover', `#${type}-button`, () => {
      $(`#${type}-button`).addClass('goog-toolbar-button-hover');
    });
    $(document).on('mouseleave', `#${type}-button`, () => {
      $(`#${type}-button`).removeClass('goog-toolbar-button-hover');
    });
  });

  ['pull', 'push'].forEach(type => {
    $(document).on('click', `#${type}-button`, () => {
      prepareCode()
      .then((data) => { showDiff(data, type); }) //get more performance over callback
      .catch((err) => { showAlert(err.message, LEVEL_ERROR); });
    });
  })

  $(document).on('click', '#config-button', () => {
    $('#filetype').val(context.config.filetype);
    $('#manage-manifest').prop("checked", context.config.manifestEnabled);
    $('#ignore-pattern').val(context.config.ignorePattern.join(';'));
    changeModalState('config', true);
  });

  $(document).on('click', '#save-config', () => {
    context.config.filetype = $('#filetype').val();
    context.config.manifestEnabled = $('#manage-manifest').prop( "checked" );
    context.config.ignorePattern = $('#ignore-pattern').val().split(';').filter(p => p !== '');
    context.bindConfig[context.id] = context.config;
    try {
      chrome.storage.sync.set({ bindConfig: context.bindConfig });
      changeModalState('config', false);
    } catch (err) {
      showAlert(err.message, LEVEL_ERROR);
    }
  })

  $(document).on('click', '.scm-item', (event) => {
    let target = $(event.target);
    if (!target.hasClass('goog-menuitem-content')) {
      target = target.children();
    }
    const type = target.attr('scm-content');
    let content;
    let label;
    switch (type) {
      case 'repo' :
        if (context.repo && target.text() === context.repo.fullName) return;
        //update context.repo with name and fullName
        const fullName = target.attr('data');
        content = {
          fullName : fullName,
          gist: fullName === 'gist'
        }
        label = fullName;
        context.gist = content.gist;
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
        $('#scm-bind-repo').text(`Repo: ${label}`);
        if (content.gist) {
          updateGist();
        } else {
          updateBranch();
        }
      } else {
        $('#scm-bind-branch').text(`${context.gist ? 'Gist' : 'Branch'}: ${label}`);
      }
    });
  });
}

function prepareCode() {
  return Promise.all([gas.getGasCode(), scm.getCode()])
  .then((data) => {
    const re = new RegExp(`\\${context.config.filetype}$`);
    const files = $('.item').toArray().reduce((hash, e) => {
      if (context.config.manifestEnabled && e.innerText === 'appsscript.json') {
        hash['appsscript'] = 'appsscript.json';
      }
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
      scm: data[1].reduce((hash, elem) => {
        if (elem) {
          hash[elem.file.replace(re, '.gs')] = elem.content;
        }
        return hash;
      }, {})
    }
    return code;
  })
}

function showDiff(code, type) {
  if (Object.keys(code.scm).length === 0 && type === 'pull') {
    showAlert('There is nothing to pull', LEVEL_WARN);
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
    for (let i = 0; i < context.config.ignorePattern.length; i ++) {
      let p = new RegExp(context.config.ignorePattern[i]);
      if (p.test(file)) return false; 
    }
    const match = file.match(/(.*?)\.(gs|html)$/);
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
    showAlert('Everything already up-to-date', LEVEL_WARN);
    return;
  }

  const diffHtml = new Diff2HtmlUI({diff : diff});
  diffHtml.draw('.scm-diff', {inputFormat: 'json', showFiles: false});
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
  $('#scm-diff-handler').text(type.capitalize()).off().click(() => {
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
  $('.repo-menu').empty().append('<div class="scm-new-repo scm-item goog-menuitem"><div class="goog-menuitem-content">Create new repo</div></div>');
  if (scm.canUseGist) {
    $('.repo-menu').append('<div class="scm-use-gist scm-item goog-menuitem"><div class="goog-menuitem-content" scm-content="repo" data="gist">gist</div></div>');
  }
  
  repos.forEach((repo) => {
    let content = `<div class="scm-item goog-menuitem"><div class="goog-menuitem-content" scm-content="repo" data="${repo}">${repo}</div></div>`
    $('.repo-menu').append(content);
  });
  if (context.repo) {
    $('#scm-bind-repo').text(`Repo: ${context.repo.fullName}`);
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
    $('.branch-menu').empty().append('<div class="scm-new-gist scm-item goog-menuitem"><div class="goog-menuitem-content">Create new gist</div></div>');
    gists.forEach((gist) => {
      let tooltip = gist.description === '' ? 'no description' : gist.description;
      let content = `<div class="scm-item goog-menuitem"><div class="goog-menuitem-content" scm-content="branch" data="${gist.id}" title="${tooltip}">${gist.id}</div></div>`
      $('.branch-menu').append(content);
    });
    let gist = context.bindBranch[context.id];
    if ($.inArray(gist, gists.map(gist => gist.id)) < 0) {
      gist = '';
    }
    $('#scm-bind-branch').text(`Gist: ${gist}`);
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
  return scm.getAllBranches()
  .then((branches) => {
    $('.branch-menu').empty().append('<div class="scm-new-branch scm-item goog-menuitem"><div class="goog-menuitem-content">Create new branch</div></div>');
    branches.forEach((branch) => {
      let content = `<div class="scm-item goog-menuitem"><div class="goog-menuitem-content" scm-content="branch" data="${branch.name}">${branch.name}</div></div>`
      $('.branch-menu').append(content);
    });
    let branch = context.bindBranch[context.id];
    if (branches.length === 0) {
      branch = '';
      if (scm.name === 'github') {
        showAlert('This repository is empty, try to create a new branch such as [master] in Github', LEVEL_WARN);
      } else {
        showAlert('This repository is empty, first create a new branch', LEVEL_WARN); 
      }
    } else if ($.inArray(branch, branches.map(branch => branch.name)) < 0) {
      branch = ($.inArray("master", branches.map(branch => branch.name)) >= 0) ? 'master' : branches[0].name;
    }
    $('#scm-bind-branch').text(`Branch: ${branch}`);
    //update context and storage
    context.branch = branch;
    Object.assign(context.bindBranch, { [context.id] : branch });
    chrome.storage.sync.set({ bindBranch: context.bindBranch });
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
    showAlert(`Successfully create new repository ${repo}`);
  })
  .catch(() => {
    throw new Error('Repository created, but failed to show the new repository.');
  });
}

function handleBranchCreated(branch) {
  return updateBranch()
  .then(() => {
    $('#new-branch-name').val('');
    showAlert(`Successfully create new branch: ${branch}`);
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
    showAlert(`Successfully create new gist.`);
  })
  .catch(err => {
    throw new Error('Gist created, but failed to show the new gist.');
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
    const margin = 600;
    const width = $('body').width();
    const height = $('body').height();
    const left = (width - margin) / 2;
    $(`#${type}-modal`).before(`<div class="scm-modal-bg modal-dialog-bg" style="opacity: 0.5; width: ${width}px; height: ${height}px;" aria-hidden="true"></div>`);
    $(`#${type}-modal`).css('left', left).show();
  } else {
    $(`#${type}-modal`).hide();
    $('.scm-modal-bg').remove();
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
