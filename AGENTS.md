# AGENTS

## Workflow
- Proactively check `git status -sb` and ensure everything you want to commit is staged before reporting progress. If something should be staged, run `git add -A` and confirm staging state.
- Commit completed work in logical, scoped commits.
- Do not push automatically after committing. Push only when explicitly requested by the user.

## General Practices
- Keep commits scoped and intentional: include only production code/assets, not local source artifacts or scratch files.
- Run critical git operations sequentially (`add` -> `commit` -> optional `push`) to avoid lock/race issues.
- Validate changes with the relevant project checks (e.g., build/tests) before finalizing a commit.
