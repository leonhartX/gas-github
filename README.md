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
5.0.0 **ONLYL** support the new IDE, with a extra Google login to access Apps Script Projects.

[IMPORTANT]Currently, the Google OAuth App used is still waiting for reviewing, before it complete, it only can allocate 100 users, so you may failed to grant permission to the extension. Please wait for the review complete(sadly Google said it takes 4~6 weeks), or install the extension from souce code to use an old version like v4.0.3, it should still work with the legacy IDE.

And before the review complete, there will be a warn page after you choose the Google account, please go ahead to allow the access otherwise the extension won’t work.

# 1.Install
Install this extension from [chrome web store](https://chrome.google.com/webstore/detail/lfjcgcmkmjjlieihflfhjopckgpelofo).

# 2.Usage
Check the basic usage with the [Demo Video](https://youtu.be/knHyof89gZ4)

please check the [Home Page](https://leonhartx.github.io)

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

 - (Fixed after 5.0.0) `.gs` file which contains a function with the same name as the file will not work [#18](https://github.com/leonhartX/gas-github/issues/18). (limited by GAS'S RPC)
 - (Fixed after 5.0.0) Can not work with more than one IDE tab in same browser
 - Can not push to a blank repo without a init commit. (limited by GitHub API)
 
PS: There is a similar [extension](https://github.com/leonhartX/lambda-github) for sync your AWS lambda code.
