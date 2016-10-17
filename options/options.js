"use strict";
$(() => {
  $('.message a').click(function(){
   $('.error').hide();
   $('.login-container').animate({height: "toggle", opacity: "toggle"}, "slow");
  });
  $('#login').click((e) => {
    loginGithub(getGithubParam());
  });
  $('#ghe-login').click((e) => {
    loginGithub(getGHEParam());
  });
  $('#logout').click((e) => {
    logoutGithub();
  });

  checkToken()
  .then((item) => {
    $('.login-container').hide();
    $('.logout-container').show();
    let domain = "@Github.com";
    let userLink = `https://github.com/${item.user}`;
    let tokenLink = 'https://github.com/settings/tokens';
    if (item.baseUrl !== "https://api.github.com") {
      let match = item.baseUrl.match(/:\/\/(.*)\/api\/v3/);
      if (!match || !match[1]) {
        domain = "";
        userLink = "";
        tokenLink = "";
      } else {
        domain = `@${match[1]}`;
        userLink = `https://${match[1]}/${item.user}`;
        tokenLink = `https://${match[1]}/settings/tokens`;
      }
    }
    $('#login-user').text(`${item.user}${domain}`).attr("href", userLink);
    $('#token').attr("href", tokenLink);
  })
  .catch((err) => {
    //not logged in
  })
})

function getGithubParam() {
  const username = $('#username').val();
  const password = $('#password').val();
  const baseUrl = `https://api.github.com`;
  const otp = $('#otp').val();
  return {
    username,
    password,
    baseUrl,
    otp
  };
}

function getGHEParam() {
  const username = $('#ghe-username').val();
  const password = $('#ghe-password').val();
  const baseUrl = $('#ghe-url').val() + "/api/v3";
  const otp = $('#ghe-otp').val();
  return {
    username,
    password,
    baseUrl,
    otp
  };
}

function loginGithub(param) {
  const username = param.username;
  const password = param.password;
  const baseUrl = param.baseUrl;
  const otp = param.otp
  if(username === "" || password === "") {
    return;
  }
  const payload = {
    scopes: [
      "repo"
    ],
    note: "gas-github_" + Date.now()
  }
  let headers = {
    Authorization: 'Basic ' + btoa(`${username}:${password}`)
  };
  if (otp && otp !== "") {
    headers['X-GitHub-OTP'] = otp;
  }
  $.ajax({
    url: `${baseUrl}/authorizations`,
    headers: headers,
    method: "POST",
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify(payload)
  })
  .done((response) => {
    chrome.storage.sync.set({ user: username, token: response.token, id: response.id, baseUrl: baseUrl}, () => {
      location.reload();
    });
    chrome.storage.local.get("tab", (item) => {
      if(item.tab) {
        chrome.tabs.reload(item.tab);
      }
    });
  })
  .fail((err) => {
    if (err.status == 401 && 
        err.getResponseHeader('X-GitHub-OTP') !== null && 
        $('.login-item-otp').filter(":visible").length == 0) {
      $('.login-item').animate({height: "toggle", opacity: "toggle"}, "slow");
    } else {
      $('.error').show();
    }
  })
}

function logoutGithub() {
  chrome.storage.sync.remove(["token", "user", "id", "baseUrl"], () => {
    location.reload();
  });
  chrome.storage.local.get("tab", (item) => {
    if(item.tab) {
      chrome.tabs.reload(item.tab);          
    }
  });
}

function checkToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["token", "user", "id", "baseUrl"], (item) => {
      if (item.token && item.token !== ""){
        resolve(item);
      }
      else reject(new Error("can not get access token"));
    });
  })
}