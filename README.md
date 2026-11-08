# The Missing Semester of AOSP & AAOS

A public course site for OEM software engineers customizing AOSP/AAOS for in-vehicle infotainment at the system level, modelled on MIT's [Missing Semester](https://missing.csail.mit.edu/). Twelve lectures, a capstone, kernel and app pointer paths. Content is pinned to Android 17 / AAOS 26Q2 and licensed CC BY-NC-SA 4.0.

## Run it locally

Requires Ruby 3+ (macOS system Ruby is too old; `brew install ruby` works).

```bash
bundle install
bundle exec jekyll serve   # http://127.0.0.1:4000
bundle exec jekyll build   # static output in _site/
```

## Layout

- `_lectures/` — the 12 lectures (fixed template: motivation, mental model, walkthrough, tiered lab, exercises with collapsible solutions, kernel/app pointers, AI tip)
- `capstone.md`, `setup.md`, `kernel-path.md`, `app-path.md`, `glossary-page.md` — core pages
- `GLOSSARY.md`, `ARCHITECTURE.md`, `docs/adr/` — domain language, architecture record, decisions
- `screenshots/` — e2e verification captures

Deploy: GitHub Pages via `.github/workflows/pages.yml` on push to `main`. Live at https://samuelabc.github.io/missing-semester-aosp/ (repo: https://github.com/samuelabc/missing-semester-aosp). Internal links must use `relative_url` because the site serves from that subpath.
