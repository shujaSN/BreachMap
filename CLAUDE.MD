@AGENTS.md

## Claude Code specifics
- Always start in plan mode. Show the plan, wait for approval and then start writing code
- Work on one complete task at a time. Stop  write short description what you did and wait for feedback
- Use reviewer before any commit, use security-auditor for anything touching render or skill, and use test-writer for all new core logic
- Run typecheck, lint, and all test cases after each edit. If anything fail, fix it before moving on. 
- If unsure about some requirement, feature or anything, never assume or never guess. Validate from different perspectives, deep research, write a short description of what can be done and ask for me feedback.
- Never consider a task done without running tests, and validating it atleast 2 time.
- Always write short text, use very simple language and write to the point.
- Never overcode any logic, always find way to write less code but quality code.
- Never write more than 1 line comment anywhere in codebase.
- Always write clean, simple, easy to understand, high quality, fast and optimized code.