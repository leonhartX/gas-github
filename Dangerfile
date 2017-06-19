warn("PR is classed as Work in Progress") if github.pr_title.include? "[WIP]"
warn("Big PR, try to keep changes smaller if you can") if git.lines_of_code > 500

lgtm.check_lgtm
