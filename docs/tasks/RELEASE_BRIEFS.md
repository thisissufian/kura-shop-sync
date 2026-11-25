# Kura Release Briefs (for Antigravity agents)

Run ONE task per Antigravity conversation, then stop. Do R1 first. R2 only starts after the owner has merged R1's PR.
The general rules in `docs/tasks/BUGFIX_BRIEFS.md` ("Rules for every task", "Report honestly") apply here too: never use `npx`, never push to `main`, never merge, never force-push.

---

## R1 — Bump the app version to 1.1.0  · model: Gemini (Medium)

**Why:** releases v1.0.0 and the UI redesign both ship as `0.1.0` (`Kura_0.1.0_x64-setup.exe`). The redesign release should be called 1.1.0 everywhere.

1. Run `git checkout main`, then `git pull --no-rebase origin main`, then `git checkout -b release/v1.1.0`.
2. Change `"version": "0.1.0"` to `"version": "1.1.0"` in **exactly** these three places:
   - `package.json` (top-level `version`)
   - `src-tauri/tauri.conf.json` (top-level `version`)
   - `src-tauri/Cargo.toml` (`version` under `[package]`)
3. From `src-tauri/`, run `cargo check` so `Cargo.lock` updates. In `Cargo.lock`, only the `version` line of Kura's own package may change. If other packages change, run `git checkout -- src-tauri/Cargo.lock` and report it.
4. In `.github/workflows/release-build.yml`, step **"Stage APKs for distribution"**, the APK name prefix is hard-coded to `kura-v1.0.0-`. Replace the whole `run: |` block of that step with:
   ```bash
   mkdir -p dist-apk
   find src-tauri/gen/android/app/build/outputs/apk -name "*.apk" -exec cp {} dist-apk/ \;
   cd dist-apk
   tag="${{ github.event.inputs.release_tag }}"
   if [ -z "$tag" ]; then tag="${GITHUB_REF_NAME}"; fi
   case "$tag" in v*) ;; *) tag="v1.0.0" ;; esac
   for f in *.apk; do
     case "$f" in kura-v*) ;; *) cp "$f" "kura-$tag-$f" ;; esac
   done
   ls -lah .
   ```
   Change nothing else in the workflow.
5. Checks:
   - `node ./node_modules/typescript/bin/tsc --noEmit` must be clean.
   - Run `cargo test` from `src-tauri/`. It is known to fail sometimes because of leftover `.db-wal` / `.db-shm` files. If it fails, delete those files in the test temp directory, rerun once, and report both results.
6. Commit with `chore(release): bump version to 1.1.0`. Then push, and open a PR titled `chore(release): bump version to 1.1.0`. The PR body should list the changed files and the test results.
7. Report the PR URL and stop. **Do not create a tag or a release.**

Done = the three version fields read `1.1.0`, the Cargo.lock change is only Kura's own version, the workflow uses the tag-based APK prefix, and tsc and cargo test pass.

---

## R2 — Publish GitHub release v1.1.0 with the phone APK  · model: Gemini (Medium)

Precondition: R1's PR is merged.

1. Run `git checkout main` and `git pull --no-rebase origin main`. Check that `package.json` says `"version": "1.1.0"`. If it doesn't, STOP and tell the owner R1 isn't merged.
2. Check that `gh release view v1.1.0 --repo thisissufian/kura-shop-sync` reports "release not found". If v1.1.0 already exists, STOP and report.
3. Save the release notes below (between the `NOTES` markers, without the markers) to a temporary file **outside the repo**, for example `%TEMP%\kura-v1.1.0-notes.md`. Don't commit it.
4. Create the release:
   `gh release create v1.1.0 --repo thisissufian/kura-shop-sync --target main --title "Kura v1.1.0 — Apple HIG redesign" --notes-file <that file> --latest`
5. Wait 60 seconds, then run `gh run list --repo thisissufian/kura-shop-sync --workflow release-build.yml --limit 3`.
   - If a run started from tag `v1.1.0` (event `push`) is listed, watch that run.
   - If not, start one yourself: `gh workflow run release-build.yml --repo thisissufian/kura-shop-sync --ref main -f release_tag=v1.1.0`. Wait 20 seconds, then take its ID from `gh run list ... --limit 1`.
   - Watch it with `gh run watch <id> --repo thisissufian/kura-shop-sync --exit-status`. It takes about 10 minutes.
6. When the run succeeds, run `gh release view v1.1.0 --repo thisissufian/kura-shop-sync --json assets -q ".assets[].name"`. The list must include:
   - `kura-v1.1.0-app-universal-release.apk`
   - `Kura_1.1.0_x64-setup.exe`
   - `Kura_1.1.0_x64_en-US.msi`
7. If the run fails: do **not** delete the release, the tag or v1.0.0. Run `gh run view <id> --repo thisissufian/kura-shop-sync --log-failed`, include the last 60 lines in your report, and stop. Rerun a failed job at most once (`gh run rerun <id> --failed`).
8. Report the release URL, the asset list, and the direct APK link: `https://github.com/thisissufian/kura-shop-sync/releases/download/v1.1.0/kura-v1.1.0-app-universal-release.apk`. Then stop.

Never edit or delete the v1.0.0 release, never move or delete tags, and never upload files you built locally.

NOTES
## Kura v1.1.0 — Apple HIG redesign

Kura now looks and feels like a native iPhone/iPad app. It is calm and grouped, uses a single tint color, and has a dark mode that is designed rather than inverted. No data changes: your sales, stock, khata and sync chain carry over.

### What's new
- **New look everywhere.** The screens use iOS-style grouped lists, large titles, and the standard type scale and system colors. There are no gradients or emoji icons.
- **Navigation.** Phones get a standard five-tab bar; tablets and desktops (1024 px and wider) get an iPad-style sidebar. The toolbar has quick buttons for customer dues, the cash drawer, sound, appearance, and the Owner/Cashier role.
- **Register.** Products are a fast list with Add buttons and − / + steppers. On phones, the checkout bar sits above the tab bar with one **Charge** button that shows the total.
- **Dark mode.** The background is true black, sheets are elevated, and receipt paper stays paper-white.
- **Safer voids.** Voiding a bill now asks for confirmation first.
- **Live relay.** It is now an on/off switch in Sync & More.

### Install on Android
1. On your phone, download `kura-v1.1.0-app-universal-release.apk` from the assets below. It is a 64-bit ARM build that works on almost all phones from 2017 onward.
2. Open it and allow your browser to "install unknown apps" when Android asks.
3. **Already have an older Kura build installed?** Each build is signed with a fresh key, so Android may show "App not installed". If you need your data, first open Sync & More → *Export .kura backup* and copy the backup somewhere safe. Then uninstall the old app, install this one, and restore.

### Windows
Run `Kura_1.1.0_x64-setup.exe` (or the `.msi`).
NOTES
