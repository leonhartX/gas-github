"use strict";

$(() => {
  $('.message a').click(function(){
    $('.error').hide();
    $('.login-container').animate({height: 'toggle', opacity: 'toggle'}, 'slow');
  });
  $('#login').click((e) => {
    addCred(getGithubParam());
  });
  $('#ghe-login').click((e) => {
    addCred(getGHEParam());
  });
  $('#logout').click((e) => {
    logoutGithub();
  });

  checkToken()
  .then((item) => {
    $('.login-container').hide();
    $('.logout-container').show();
    let domain = '@Github.com';
    let userLink = `https://github.com/${item.user}`;
    let tokenLink = 'https://github.com/settings/tokens';
    if (item.baseUrl !== 'https://api.github.com') {
      let match = item.baseUrl.match(/:\/\/(.*)\/api\/v3/);
      if (!match || !match[1]) {
        domain = '';
        userLink = '';
        tokenLink = '';
      } else {
        domain = `@${match[1]}`;
        userLink = `https://${match[1]}/${item.user}`;
        tokenLink = `https://${match[1]}/settings/tokens`;
      }
    }
    $('#login-user').text(`${item.user}${domain}`).attr('href', userLink);
    $('#token').attr('href', tokenLink);
  })
  .catch((err) => {
    //not logged in
  })
})

function getGithubParam() {
  const username = $('#username').val();
  const password = $('#password').val();
  const token = $('#accesstoken').val();
  const baseUrl = `https://api.github.com`;
  const otp = $('#otp').val();
  return {
    username,
    password,
    token,
    baseUrl,
    otp
  };
}

function getGHEParam() {
  const username = $('#ghe-username').val();
  const password = $('#ghe-password').val();
  const token = $('#ghe-accesstoken').val();
  const baseUrl = $('#ghe-url').val() + '/api/v3';
  const otp = $('#ghe-otp').val();
  return {
    username,
    password,
    token,
    baseUrl,
    otp
  };
}

function addCred(param) {
  if (param.username === '') {
    return;
  }
  if (param.password === '' && param.token === '') {
    return;
  }

  if (param.password !== '') return loginGithub(param);

  addStar(param.token)
  .then(() => {
    chrome.storage.sync.set({ user: param.username, token: param.token, baseUrl: param.baseUrl}, () => {
      location.reload();
    });
    chrome.storage.local.get('tab', (item) => {
      if(item.tab) {
        chrome.tabs.reload(item.tab);
      }
    });
  })
}

function loginGithub(param) {
  const username = param.username;
  const password = param.password;
  const baseUrl = param.baseUrl;
  const otp = param.otp
  const payload = {
    scopes: [
      'repo',
      'gist'
    ],
    note: 'gas-github_' + Date.now()
  }
  let headers = {
    Authorization: 'Basic ' + btoa(`${username}:${password}`)
  };
  if (otp && otp !== '') {
    headers['X-GitHub-OTP'] = otp;
  }
  $.ajax({
    url: `${baseUrl}/authorizations`,
    headers: headers,
    method: 'POST',
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify(payload)
  })
  .done((response) => {
    addStar(response.token)
    .then(() => {
      chrome.storage.sync.set({ scm: 'github', user: username, token: response.token, baseUrl: baseUrl}, () => {
        location.reload();
      });
      chrome.storage.local.get('tab', (item) => {
        if(item.tab) {
          chrome.tabs.reload(item.tab);
        }
      });
    })
  })
  .fail((err) => {
    if (err.status == 401 && 
        err.getResponseHeader('X-GitHub-OTP') !== null && 
        $('.login-item-otp').filter(':visible').length == 0) {
      $('.login-item').animate({height: 'toggle', opacity: 'toggle'}, 'slow');
    } else {
      $('.error').show();
    }
  })
}

function logoutGithub() {
  chrome.storage.sync.remove(['scm', 'token', 'user', 'baseUrl'], () => {
    location.reload();
  });
  chrome.storage.local.get('tab', (item) => {
    if(item.tab) {
      chrome.tabs.reload(item.tab);          
    }
  });
}

function checkToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['token', 'user', 'baseUrl'], (item) => {
      if (item.token && item.token !== ''){
        resolve(item);
      }
      else reject(new Error('can not get access token'));
    });
  })
}

function addStar(token) {
  if(!$('#star').is(':checked') || $('#star').is(':hidden')) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    $.ajax({
      url: `https://api.github.com/user/starred/leonhartX/gas-github`,
      headers: {
        'Content-Length': 0,
        'Authorization': `token ${token}`
      },
      method: 'PUT',
    })
    .always(resolve);
  })
}