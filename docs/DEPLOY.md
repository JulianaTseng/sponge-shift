# Deploying SPONGE SHIFT to GitHub Pages

A complete walkthrough, from an empty GitHub account to a live URL. This document records the
exact route that worked, including the two permission errors that are easy to hit and hard to
diagnose.

**What you need:** a GitHub account, Git, Node 18 or newer (only for local testing).

---

## Step 1 — Create the repository

1. Go to <https://github.com/new>.
2. **Repository name:** `sponge-shift` (any name works).
3. **Visibility:** Public. Private also works, but GitHub Pages on a free plan requires public
   repositories; a private repo needs GitHub Pro.
4. **Do not** tick *Add a README*, *.gitignore* or *license*. The project already has all three,
   and an initialised remote will cause a `non-fast-forward` conflict on the first push.
5. Click **Create repository** and leave the page showing the "…or push an existing repository"
   instructions.

Do **not** use the web upload button (the "uploading an existing file" link). Finder hides
`.github/`, so the workflow file would be skipped and Pages would never build; `node_modules/`
and `dist/` would be uploaded as well.

---

## Step 2 — Create a Personal Access Token

GitHub no longer accepts an account password for Git operations over HTTPS. You must use a
Personal Access Token (PAT).

1. Open <https://github.com/settings/tokens/new?scopes=repo,workflow&description=sponge-shift>.
   The scope checkboxes are pre-selected by that link.
2. Verify **both** boxes are ticked:
   - `repo` — read and write repository contents.
   - `workflow` — **required**, because this repository contains
     `.github/workflows/deploy.yml`. Without it GitHub rejects the push with
     *"refusing to allow a Personal Access Token to create or update workflow"*.
3. Set **Expiration** to 30 or 90 days.
4. Click **Generate token** and copy the `ghp_…` string. It is shown once.

Treat the token like a password: never commit it, never paste it into an issue or a chat.

---

## Step 3 — Push the project

Open Terminal (macOS: `⌘ + Space`, type `Terminal`) and move into the project folder:

```bash
cd "/Users/<you>/WorkBuddy/2026-11-16-20-37-29/hk-surge"
```

Every command below runs in that folder. If the folder is already a Git repository — check with
`git status` — skip `git init` and simply point the remote at the new repository.

```bash
git init
git add .
git commit -m "SPONGE SHIFT GROUP 3 storm surge deployment platform"
git branch -M main
git remote add origin https://github.com/<your-username>/sponge-shift.git
git push -u origin main
```

`git push` asks twice:

| Prompt | Enter |
| --- | --- |
| `Username for 'https://github.com':` | your GitHub username |
| `Password for 'https://<user>@github.com':` | the `ghp_…` token |

The password is not echoed — nothing appears on screen while you paste. Press Return.

Success looks like:

```
* [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

macOS stores the token in the login keychain, so later pushes will not ask again. To forget it:

```bash
printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain erase
```

---

## Step 4 — Enable Pages

Do this **before** the first push if you can; it saves one re-run.

1. Open `https://github.com/<your-username>/sponge-shift/settings/pages`.
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not
   *Deploy from a branch*).
3. No further configuration: there is no branch, folder or `basePath` to set.

If you enabled Pages after pushing, the first run fails at the deploy step with
*"Get Pages site failed … Not Found"*. The build is fine — just re-run:

- Repository → **Actions** → open the failed run → **Re-run all jobs**.

---

## Step 5 — Watch the run

Open the repository's **Actions** tab. The workflow `Deploy to GitHub Pages` has two jobs:

| Job | What it does |
| --- | --- |
| `build` | `npm ci` → `npm run typecheck` → `npm run build` → upload `dist/` |
| `deploy` | publishes the uploaded artefact |

Green tick on both, and the site is live at:

```
https://<your-username>.github.io/<repo-name>/
```

A first deploy takes about 60–90 seconds; later pushes are faster.

---

## Step 6 — Verify

A sub-path deployment fails on assets far more often than on markup, so check them explicitly:

```bash
curl -s -o /dev/null -w "%{http_code} index\n" https://<user>.github.io/<repo>/
curl -s -o /dev/null -w "%{http_code} brand\n" https://<user>.github.io/<repo>/brand/mark.png
```

Open the page and confirm the map tiles, the logo and the nine views all render. Vite is configured
with `base: './'`, so the same build also works at a user page root, on a custom domain, and from
`file://`.

---

## Troubleshooting

| Message | Cause | Fix |
| --- | --- | --- |
| `Invalid username or token. Password authentication is not supported` | Typed the account password, or an expired/revoked token | Use a PAT from Step 2 |
| `refusing to allow a Personal Access Token to create or update workflow ... without 'workflow' scope` | Token missing `workflow` | Create a new token with `repo` **and** `workflow`, then erase the cached credential (Step 3) and push again |
| `deploy` job fails, `deploy-pages@v4` red, build green | Pages never enabled, or Source still set to a branch | Settings → Pages → Source: **GitHub Actions**, then re-run |
| `Type check` step fails | A TypeScript error that Vitest/Vite tolerates locally | Run `npm run typecheck` locally and fix before pushing |
| `! [rejected] main -> main (fetch first)` | Remote was initialised with a README | `git pull --rebase origin main`, resolve, push again |
| Site loads but shows a blank page | Wrong base path | Confirm `vite.config.ts` still has `base: './'` |

---

## Day-to-day updates

```bash
git add -A
git commit -m "Tune dispatch timeline window"
git push
```

That is the entire loop — no settings, no rebuild step, no token prompt. The Action rebuilds and
redeploys on every push to `main`.

To roll back, open the repository's commit history, pick the good commit, choose **Revert**,
and merge the generated pull request; the revert commit triggers a fresh deploy.

---

## Alternative: GitHub Desktop (no terminal)

1. Install <https://desktop.github.com> and sign in with the GitHub account — this replaces the
   token step entirely.
2. **File → Add Local Repository** → choose the `hk-surge` folder.
3. Click **Push origin**.

Settings → Pages → Source: GitHub Actions is still required once.
