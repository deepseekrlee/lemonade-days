# Publishing Lemonade Days — the ELI5 guide

You do not need to memorize any of this. This file is the map you can come back to.

## The five words that make GitHub less mysterious

- **Repository (repo):** the game's project folder on GitHub.
- **Git:** the little history machine that remembers versions of the folder.
- **Commit:** a named snapshot, like a save point in a game.
- **Push:** upload your local save points to GitHub.
- **GitHub Pages:** GitHub's service that turns the built game into a public website.

The local working copy is:

`C:\Users\rleep\Documents\Invoices Project\lemonade-days-codex`

The planned GitHub repository is:

`https://github.com/deepseekrlee/lemonade-days`

The planned playable game address is:

`https://deepseekrlee.github.io/lemonade-days/`

## What happens automatically

The project contains two tiny robot instruction files in `.github/workflows`:

1. **CI** installs the project and checks its types, tests, and production build.
2. **Deploy to GitHub Pages** builds the game and publishes the `dist` folder as a website.

Whenever a new commit reaches the `main` branch, GitHub runs both robots. A green check means the checks passed. The first website deployment can take a few minutes.

## One-time GitHub Pages switch

After the repository is created and the files are uploaded:

1. Open the repository on GitHub.
2. Click **Settings** near the top of the repository.
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Click the **Actions** tab and wait for **Deploy to GitHub Pages** to turn green.
6. Open `https://deepseekrlee.github.io/lemonade-days/`.

You only set the Pages source once.

## The easiest future-update routine

GitHub Desktop is the friendliest option because it replaces terminal commands with buttons:

1. Open **GitHub Desktop** and select `lemonade-days`.
2. Review the list of changed files on the left.
3. In the **Summary** box, write a short label such as `Add new festival food truck`.
4. Click **Commit to main**. This makes a local save point.
5. Click **Push origin**. This uploads the save point.
6. GitHub automatically tests and republishes the website.

If GitHub Desktop is not installed, its official download is `https://desktop.github.com/`.

## The same routine in a terminal

Open PowerShell in the project folder, then run these one at a time:

```powershell
git status
git add .
git commit -m "Describe what changed"
git push
```

What those mean:

- `git status` asks, “What changed?”
- `git add .` puts all current changes into the next save point.
- `git commit` creates that save point.
- `git push` uploads it to GitHub.

## If the website does not update

1. Open the repository's **Actions** tab.
2. Open the newest run.
3. Green means it worked; red means a check failed.
4. Do not delete the project or start over. The red run keeps the useful error message.

The local game and its history remain safe even when a website deployment fails.

## Important folders

- `src/` — the game's source code.
- `src/game/` — simulation rules and game data.
- `src/render/` — pixel-art scene and audio code.
- `src/ui/` — screens, buttons, modals, and styling.
- `dist/` — locally built output; GitHub rebuilds this automatically, so Git does not upload it.
- `.github/workflows/` — the automatic test-and-publish robot instructions.

## Before a major update

Run this check locally:

```powershell
npm install
npm run typecheck
npm test
npm run build
```

If all four finish successfully, the project is in good shape to publish.
