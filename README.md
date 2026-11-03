# DP-600 Study Platform

A self-contained study app for Microsoft exam DP-600 (Fabric Analytics Engineer). It has no backend, no build step and no dependencies.

## Run it

- **On this PC:** double-click `index.html`.
- **On any device:** publish with GitHub Pages (below), then open the site URL.

Progress is saved in your browser only. To move it between devices, use **Settings > Export progress**, then **Import progress** on the other device.

## Publish on GitHub Pages

1. Create an empty repository on GitHub. Free accounts need it to be **public** for Pages.
2. From this folder, push the files:

   ```bash
   git init -b main
   git add .
   git commit -m "Add DP-600 study platform"
   git remote add origin https://github.com/joshudo/cert-prep-platform.git
   git push -u origin main
   ```

3. On GitHub, go to **Settings > Pages**, and set the source to **Deploy from a branch**, `main`, `/ (root)`.

Do not add the original video transcript to the repository. `.gitignore` excludes `.txt` files for this reason.

## How to study

1. Take the diagnostic once.
2. Do the daily session on most days. It schedules reviews and mixes topics.
3. Follow the **Plan** page for notes, labs and mock exams.
4. Check the **Progress** page's readiness checks before you sit the exam.

The **Method** page explains the evidence behind this design and its limits.

## Layout

| Path | Contents |
| --- | --- |
| `data/sources.js` | Documentation links, exam areas and the skill map |
| `data/q_*.js` | Questions, case studies and recall prompts |
| `data/notes.js` | Study notes and labs |
| `data/review.js` | Audit of the source video, item by item |
| `js/engine.js` | Scheduler, grading and session building, with no DOM access |
| `js/app.js` | Views and routing |
| `tests/index.html` | Engine tests and content validation. Open it in a browser |
| `tools/serve.ps1` | Optional local web server |
| `tools/check-links.ps1` | Checks every documentation link |

## Keeping it current

Microsoft changes Fabric and this exam often. Before booking:

- Compare the [study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-600) with the outline on the **Method** page.
- Run `tools/check-links.ps1`.
- After editing questions, open `tests/index.html` and confirm 0 failures.

To add a question, append to a `data/q_*.js` file. Text in `{{double braces}}` renders as code. Every question needs a `src` key from `data/sources.js`.

## Not affiliated with Microsoft

This is an independent study aid. All questions are original and are not taken from any exam.
