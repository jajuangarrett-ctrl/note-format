# Note Format Plugin Instructions

## Source of Truth

The real source code lives here:

`/Users/franklingarrett/Codex/plugins/note-format/`

GitHub source repo:

`https://github.com/jajuangarrett-ctrl/note-format`

This repository is the place to edit TypeScript source, plugin metadata, package versions, tests, and release assets.

## Documentation and Installed Copies

Project documentation lives separately in the FJG Vault:

`/Users/franklingarrett/FJG Vault/Artifacts/Note Format App/`

The installed Obsidian plugin copy lives in the vault:

`/Users/franklingarrett/FJG Vault/.obsidian/plugins/note-format/`

Do not treat `.obsidian/plugins/note-format/` as source. It is installed/build output used by Obsidian and vault sync. Only copy built release assets there when intentionally updating the installed local vault copy.

The installed files normally copied from this source repo are:

- `main.js`
- `manifest.json`
- `styles.css`

Do not overwrite `.obsidian/plugins/note-format/data.json`; it contains local plugin settings and the API key.

## What the Plugin Does

The plugin command is `Format transcript`. It captures or receives transcript text and saves one formatted Markdown note per capture under:

`AI Team/Formatted_Notes/`

The current formatting contract is operational meeting notes:

- `# Meeting Notes`
- One or more `## [Topic Name]` sections
- Each topic has `### Discussion`, `### Decisions`, and `### Open Questions`
- Final `## Action Items` table with `Owner` and `Action` columns

The prompt source used for the current contract is documented in the vault at:

`/Users/franklingarrett/FJG Vault/AI Team/Formatted_Notes/Prompt for Formatting Notes.md`

## Stable Change Workflow

1. Edit source in `/Users/franklingarrett/Codex/plugins/note-format/`.
2. If the output format changes, update `src/formatPrompt.ts` and the prompt-related test in `src/transcribe.test.ts`.
3. If user-facing wording changes, update `src/CaptureModal.ts` or settings text as needed.
4. Bump the version in:
   - `manifest.json`
   - `package.json`
   - `package-lock.json`
   - `versions.json`
5. Build and test.
6. Copy built install assets to the vault installed plugin folder when the local vault copy should be updated.
7. Update vault docs in `Artifacts/Note Format App/` when behavior, workflow, or release instructions change.
8. Commit and push this source repo.
9. Tag and create a GitHub release with `main.js`, `manifest.json`, and `styles.css` so BRAT can update devices.
10. Commit and push vault documentation or installed-copy changes in the FJG Vault repo if those were changed.

## Build and Test

Run from this source root:

```bash
npm run build
npm test
```

`npm run build` runs TypeScript typecheck and production esbuild bundling. `npm test` runs Vitest.

If `tsc` or Vitest hang locally before producing output, verify at minimum that:

```bash
node esbuild.config.mjs production
rg -n "Meeting Notes|Action Items" main.js src/formatPrompt.ts
```

Do not treat the fallback as equivalent to a passing test suite; report the hang clearly.

## Commit, Push, and Release

Use Franklin's commit identity:

```bash
git -c user.name="Franklin Garrett" -c user.email="jajuangarrett@gmail.com" commit -m "vX.Y.Z: <summary>"
git -c user.name="Franklin Garrett" -c user.email="jajuangarrett@gmail.com" tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main
git push origin vX.Y.Z
gh release create vX.Y.Z main.js manifest.json styles.css --title "vX.Y.Z" --notes "<release notes>"
```

`main.js` is ignored by the source repo but is still generated locally and attached to GitHub releases.

## Project Rules and Pitfalls

- Edit source here, not in the installed vault plugin folder.
- Preserve one file per capture in `AI Team/Formatted_Notes/`; do not switch to a master append file.
- Do not add multiple format styles or a style dropdown unless Franklin explicitly asks.
- Do not add in-plugin PDF parsing. The iOS Shortcut extracts PDF text with "Get Text from Input."
- Do not require Advanced URI for the share-sheet flow. The plugin owns the native `obsidian://note-format` handler.
- Do not add generic speaker labels such as `Speaker 1` or `Person 1` to formatted output.
- Do not reintroduce the old active format requiring `### Detailed notes`, `### Next steps`, `### Conclusion`, `### Keywords`, or a summary terms table.
- Preserve custom acronyms from settings in the formatting prompt.
- Keep `data.json` out of release assets and do not overwrite it in the installed plugin folder.
- For vault commits, avoid broad `git add -A`; the vault often has unrelated user work. Stage only the paths required for the task.
- Full `git status`, `git diff`, `git commit`, `tsc`, or Vitest can hang in this environment. Prefer targeted path checks and report any verification gaps.

## User Preferences

- The user's name is Franklin Garrett.
- Drafted emails must be signed `Franklin`.
- Finished vault deliverables should be saved inside `/Users/franklingarrett/FJG Vault/`, committed, and pushed to the FJG Vault `main` branch unless Franklin explicitly says not to push.
- For this plugin, publish source updates through the GitHub repo and BRAT-compatible releases when shipping device updates.
