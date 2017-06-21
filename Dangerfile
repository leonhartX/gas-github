warn("PR is classed as Work in Progress") if github.pr_title.include? "[WIP]"
warn("Big PR, try to keep changes smaller if you can") if git.lines_of_code > 500
warn("manifest is not changed, forget to bump version?") if !git.modified_files.include?("manifest.json")

github.dismiss_out_of_range_messages
eslint.filtering = true
eslint.lint
lgtm.check_lgtm