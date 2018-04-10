# gas-github
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/lfjcgcmkmjjlieihflfhjopckgpelofo.svg)](https://chrome.google.com/webstore/detail/google-apps-script-github/lfjcgcmkmjjlieihflfhjopckgpelofo)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/d/lfjcgcmkmjjlieihflfhjopckgpelofo.svg)](https://chrome.google.com/webstore/detail/google-apps-script-github/lfjcgcmkmjjlieihflfhjopckgpelofo)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/rating/lfjcgcmkmjjlieihflfhjopckgpelofo.svg)](https://chrome.google.com/webstore/detail/google-apps-script-github/lfjcgcmkmjjlieihflfhjopckgpelofo)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/rating-count/lfjcgcmkmjjlieihflfhjopckgpelofo.svg)](https://chrome.google.com/webstore/detail/google-apps-script-github/lfjcgcmkmjjlieihflfhjopckgpelofo)
[![CircleCI](https://img.shields.io/circleci/project/github/leonhartX/gas-github.svg)](https://circleci.com/gh/leonhartX/gas-github)

Chrome-extension to manage Google Apps Script(GAS) code with your favorite SCM service(github/github enterprise/bitbucket/gitlab).

With this extension, you can manage your code in GAS editor, push code to a new created branch, pull from a repository/branch.

The extension does not use the Google Drive API, so you don't need any google authentication. Moreover, this extension supports **Bound scripts**.

# **NOTICE**
This extension is a hack of the GAS IDE's internal RPC, so there's no guarantee of anything. This extension can break at **ANYTIME** if Google changes their api.

# 1.Install
Install this extension from [chrome web store](https://chrome.google.com/webstore/detail/lfjcgcmkmjjlieihflfhjopckgpelofo).

# 2.Usage
After install, when you open GAS editor, a new button will appear to allow you to login to GitHub/GitHub Enterprise/Bitbucket.

## 2.1.Login
Login to your GitHub/GitHub Enterprise/Bitbucket/GitLab account, with Two-factor authentication support for GitHub/GitHub Enterprise.

Actually, this is not a login action, but to create the `access token` which will be used for the extension
>Note: the access token will be stored in `chrome.storage.sync`(password will not be stored), if you take this as a security hole, pleast **DO NOT** use this extension.

## 2.2.Bind
After login, you can bind your GAS Project with repo and branch, or create a new one.

## 2.3.Manage
Manage your code with the similar `Push` and `Pull`.But there are something you need to know before you use it.

### 2.3.1.Create Repository/Branch
In `Repo` and `Branch` dropdown list, there is an option to Create new Repo and Branch.

New Repo will be created with an init, with a default README.md.

### 2.3.2.Pull and Push
The **PULL/PUSH** is not actually the same as GitHub/Bitbucket's **PULL/PUSH**, because GAS project does not have any git info, so what we can do is limited.

The differences are:

- `Pull` will fetch code from the bind Repository/Branch, and **OVERWRITE** to current GAS Project. There is no merge operation.
- `Push` will make all your change like one commit, If your want to make your process clearly, please push everytime you want a commit.

Other points:
- A diff dialog will be shown before you confirm to `Push` or `Pull`.
- You can choose files to operate with in the diff dialog.
- `Push` must have a commit comment which will be added from the diff dialog.

#### 2.3.2.1 Gist
For using Gist, select `Using Gist` in the `Repo` dropdown list, then `Branch` dropdown will changed to `Gist`. But since gist do not has a name, you need to select the id to specific which gist to sync(a tooltip will show description of the gist).
>Note: Bitbucket's snippet is not supported.

- If there is no gist, you can create one from the extension.
- The gist created from extension will be initialzated with a default `init_by_gas_hub.html` file, this will be delete when first time you push you code to gist. 
- You can change the description when push.
- Same as sync to repo, only file added and file changed is supported.

## 2.4.Logout
You can logout from the extension's option page any time. After logout, the access token stored in extension will be deleted, 
but you will need to delete the token or revoke Bitbucket's oauth yourself from SCM's settins page.

# 3.Features

 - Manage code with GitHub, GitHub Enterprise, Bitbucket and GitLab
 - Support embedded scripts
 - Push/Pull code between SCM and GAS
 - Sync code to public/secret Gist
 - Create repo, branch from GAS IDE
 - Diff check when pull/push
 - Choose files to pull/push
 - Support file changed/added/deleted/renamed
 - Add Commit comment when push
 - Support two-factor authentication(GitHub, GitHub Enterprise only)
 - Work with directory(with slash in filename)
 - Support GitHub Organizations, Bitbucket Teams and GitLab Groups.
 - Google Apps Script native ui
 - Option to change filetype from `.gs` to `.js` when uploading to SCM
 - Option to add ignore file pattern.

# 4.Support
please create an issue for any question or bug report.

# 5.Known issues

 - `.gs` file which contains a function with the same name as the file will not work [#18](https://github.com/leonhartX/gas-github/issues/18). (limited by GAS'S RPC)
 - Can not push to a blank repo without a init commit. (limited by GitHub API)
 
PS: There is a similar [extension](https://github.com/leonhartX/lambda-github) for sync your AWS lambda code.
