'use strict';
const gas = new Gas();
let scm;
const LEVEL_ERROR = 'warning';
const LEVEL_WARN = 'info';
const LEVEL_INFO = 'promo';
  $('.scm-alert').remove();
  initPageContent()
  .then(initContext)
      case 'need login' :
      case 'not match' :
      case 'nothing' :
        showAlert('Unknow Error', LEVEL_ERROR);
  if (!match) return Promise.reject(new Error('not match'));
  context.isBound = match[1] === '/macros';
    chrome.storage.sync.get(['scm', 'token', 'user', 'baseUrl', 'bindRepo', 'bindBranch'], (item) => {
        reject(new Error('need login'));
      scm = createSCM(item);
      resolve(scm);
  .then(scm => {
    return scm.getRepos();
  })
    chrome.runtime.sendMessage({ cmd: 'tab' });
    chrome.runtime.sendMessage({ cmd: 'tab' });
  $(document).on('mouseover', '.scm-item', (event) => {
    if (!target.hasClass('scm-item')) {
      target = target.parent('.scm-item');
  $(document).on('mouseleave', '.scm-item', (event) => {
    if (!target.hasClass('scm-item')) {
      target = target.parent('.scm-item');
      $(`.${type}-menu`).css('left', $(`#${type}Select`).position().left + 55).toggle();
    $(document).on('click', `.scm-new-${type}`, () => {
    $(document).on('click', `#scm-create-${type}`, () => {
      scm[`create${type.capitalize()}`]();
    $(document).on('click', `.scm-${type}-modal-close`, () => {
      .then((data) => { showDiff(data, type); }) //get more performance over callback
      .catch((err) => { showAlert(err.message, LEVEL_ERROR); });
  $(document).on('click', '.scm-item', (event) => {
    const type = target.attr('scm-content');
        if (context.repo && target.text() === context.repo.fullName) return;
        label = fullName;
        context.gist = content.gist;
        $('#scm-bind-repo').text(`Repo: ${label}`);
        $('#scm-bind-branch').text(`${context.gist ? 'Gist' : 'Branch'}: ${label}`);
  $(document).on('click', '.scm-alert-dismiss', () => {
    $('.scm-alert').remove();
  return Promise.all([gas.getGasCode(), scm.getCode()])
      scm: data[1].reduce((hash, elem) => {
  if (Object.keys(code.scm).length === 0 && type === 'pull') {
    showAlert('There is nothing to pull', LEVEL_WARN);
  const oldCode = type === 'push' ? code.scm : code.gas;
  const newCode = type === 'push' ? code.gas : code.scm;
  const scmFiles = Object.keys(code.scm);
  let diff = scmFiles.filter((e) => {
    let fileDiff = JsDiff.createPatch(file, oldCode[file] || '', newCode[file] || '');
  }, '');
  if (diff === '') {
    showAlert('Everything already up-to-date', LEVEL_WARN);
  diffHtml.draw('.scm-diff', {inputFormat: 'json', showFiles: false});
  diffHtml.highlightCode('.scm-diff');
  $('#commit-comment').off().val('');
  $('#gist-desc').val('');
  $('#scm-diff-handler').prop('disabled', false);
    $('#scm-diff-handler').prop('disabled', true);
    $('.scm-comment').hide();
      $('.scm-comment').show();
      $('#scm-diff-handler').prop('disabled', true);
        $(`#scm-diff-handler`).prop('disabled', event.target.value === '');
      $('.scm-comment').hide();
      $('.scm-comment').hide();
  $('#scm-diff-handler').text(type.capitalize()).off().click(() => {
    if (type === 'push') {
      scm.push(code);
    } else {
      gas.pull(code);
    }
  $('.repo-menu').empty().append('<div class="scm-new-repo scm-item goog-menuitem"><div class="goog-menuitem-content">Create new repo</div></div>');
  if (scm.canUseGist) {
    $('.repo-menu').append('<div class="scm-use-gist scm-item goog-menuitem"><div class="goog-menuitem-content" scm-content="repo" data="gist">gist</div></div>');
  }
  
    let content = `<div class="scm-item goog-menuitem"><div class="goog-menuitem-content" scm-content="repo" data="${repo}">${repo}</div></div>`
    $('#scm-bind-repo').text(`Repo: ${context.repo.fullName}`);
    return context.repo.fullName;
  return scm.getAllGists()
    $('.branch-menu').empty().append('<div class="scm-new-gist scm-item goog-menuitem"><div class="goog-menuitem-content">Create new gist</div></div>');
      let tooltip = gist.description === '' ? 'no description' : gist.description;
      let content = `<div class="scm-item goog-menuitem"><div class="goog-menuitem-content" scm-content="branch" data="${gist.id}" title="${tooltip}">${gist.id}</div></div>`
      gist = '';
    $('#scm-bind-branch').text(`Gist: ${gist}`);
  return scm.getAllBranches()
    $('.branch-menu').empty().append('<div class="scm-new-branch scm-item goog-menuitem"><div class="goog-menuitem-content">Create new branch</div></div>');
      let content = `<div class="scm-item goog-menuitem"><div class="goog-menuitem-content" scm-content="branch" data="${branch.name}">${branch.name}</div></div>`
      branch = '';
      showAlert('This repository is empty, try to create a new branch such as [master] in Github or Bitbucket', LEVEL_WARN);
      branch = ($.inArray("master", branches.map(branch => branch.name)) >= 0) ? 'master' : branches[0].name;
    $('#scm-bind-branch').text(`Branch: ${branch}`);
    $(`#${type}Modal`).before(`<div class="scm-modal-bg modal-dialog-bg" style="opacity: 0.5; width: ${width}px; height: ${height}px;" aria-hidden="true"></div>`);
    $(`#${type}Modal`).css('left', left).show();
    $('.scm-modal-bg').remove();
  if (!value || value === '') {
    $(`#scm-create-${type}`).prop('disabled', true);
    $(`#scm-create-${type}`).prop('disabled', false);