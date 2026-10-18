# Radlay Automation website

Static site for Radlay Automation (Harare, Zimbabwe): automation, power, instrumentation and solar engineering.

- `index.html` plus inner pages: capabilities, solutions, products, projects, company
- `login.html` / `connect.html`: Radlay Connect, a demo operations portal. Its data lives in the browser's sessionStorage only.
- No build step. Serve the folder as-is, e.g. `python -m http.server`.

Demo portal logins (password `demo123`): manager@radlay.demo, engineer@radlay.demo, client@msasafoods.demo
