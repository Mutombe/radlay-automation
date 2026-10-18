# Radlay Automation website

Static site for Radlay Automation (Harare, Zimbabwe): automation, power, instrumentation and solar engineering.

- `index.html` plus inner pages: capabilities, solutions, products, projects, company
- `login.html` / `connect.html`: Radlay Connect, a demo operations portal. Its data lives in the browser's sessionStorage only.
- No build step. Serve the folder as-is, e.g. `python -m http.server`.

Demo portal logins (password `demo123`): manager@radlay.demo, engineer@radlay.demo, client@msasafoods.demo

## Google reviews

The home page shows Radlay's Google Maps reviews from `data/reviews.json`, copied as written, with each reviewer's Google profile photo. To refresh them:

```
SERPAPI_KEY=your-key python tools/fetch_google_reviews.py
```

The key is read from the environment only; never commit it. The pages are generated from a build script, so rebuild after refreshing.

## Photo framing

Hero photos carry a subject box, `data-focus="left top right bottom"` in percent of the image. `assets/js/main.js` picks the crop that keeps that box fully in view and clear of the headline, header buttons and slide controls at the visitor's actual screen size. When adding a hero photo, draw a tight box around the readable subject (a face, the robot arm, the pylon head) and check it on a 375 × 667 phone first.
