# t3code fork: patched nightly builds

This branch (`fork-ci`) is the fork's default branch on purpose. It holds only
`.github/workflows/fork-nightly.yml` and this README, so none of upstream's workflows
(release every 30 minutes, Android APK every hour, and so on) are on the default
branch, and their schedules never run in this fork.

**GitHub Actions no longer builds this fork.** `fork-nightly.yml` is disabled and kept
for reference. Builds run on the machine `hp` from `~/t3-fork/update-fork.sh`. GitHub
is only the file host, through this repository's Releases.

## What the pipeline does

Once a day (`15 7 * * *`, hp's clock), `update-fork.sh`:

1. Takes `pingdotgg/t3code` `main` and the fork's patch branch
   (`fix/subagent-reasoning-display`).
2. Skips the build if the newest non-draft release here already has the same upstream
   commit and patch-branch commit. It still checks that hp is on the right version.
3. Cherry-picks the patch branch's own commits (those since its merge-base with upstream
   `main`, merges skipped) onto upstream `main`. A conflict stops the run with a message
   naming the commit and files, and the previous release and hp stay as they are. The
   same conflict is not reported twice; it retries when either commit changes. Nothing
   is ever pushed back to a branch.
4. Builds in a Docker container on hp, from one tree, in upstream CI's order: the JS
   bundle, the Linux server archive and its smoke test, the Windows resource monitor
   (`cargo xwin`), and the unsigned Windows installer. The version comes from upstream's
   `scripts/resolve-nightly-release.ts`: `<X.Y.Z>-nightly.<UTC date>.<N>`, where `N` is a
   counter kept on hp that started at 100 (the Action reached 28).
5. Checks the updater metadata and the installer's contents on hp.
6. Runs CI's Windows-only checks on main-pc over ssh: the packaged native module probes
   and the resource monitor smoke test, from a scratch folder, without touching the
   installed app. A failure stops the publish.
7. Publishes a prerelease here with the installer, its `.blockmap`, the `nightly.yml`
   updater manifest, the Linux server archive, and `SHA256SUMS`. The release tag points
   at a one-file commit (`BUILD_INFO.txt`) created for that release, not at the built
   source, so GitHub lists releases in build order.
8. Installs the Linux server on hp once no agent turn is running there, with an automatic
   rollback if the new version does not come up healthy.

Every 30 minutes, `update-fork.sh --reconcile` installs a published version hp does not
have yet, for instance one that was waiting for hp to go quiet.

Installed fork builds check this repository (not upstream) for updates, because the build
sets `T3CODE_DESKTOP_UPDATE_REPOSITORY` to this repository. A copy installed from upstream
keeps updating from upstream; install one fork `.exe` from the Releases page by hand once
to switch it over.

## Differences from upstream nightlies

- Windows x64 installer and Linux x64 server archive only.
- Unsigned. Windows SmartScreen warns on first install. In-app updates still work: the app
  checks the installer's sha512 from `nightly.yml` instead of a code signature.
- No bundled WSL runtime, so the WSL backend is not available in these builds.
- No npm package or other platforms.
- T3 Connect constants are public and live in hp's `~/t3-fork/fork.conf`. Relay client
  tracing is never configured.
- In-app "release notes" links still point at `pingdotgg/t3code` releases, so they 404 for
  fork versions.

## Accepted limits

- **Nightlies built while main-pc is off are not checked on Windows.** They are published
  anyway, and the notification and release notes say "not checked on Windows". The check
  also skips when a playtest is running on main-pc. The pipeline never wakes main-pc.
- hp restarts its T3 server only when no agent turn is running. A thread stuck in a running
  state holds an update back; after a day Moss gets a message. `--force` overrides.
- In the app, the "update server" button asks hp for the version the desktop app itself is
  on. `t3 update` with no version asks upstream's release list. See the routing notes in
  hp's `~/t3-fork/ROLLBACK.md`.

## Changing the patches

Commit to the patch branch and push it. Keep it rebased on upstream `main`: merge commits
are skipped, so conflict fixes made in a merge from upstream are lost. The next daily run
picks it up, or run it by hand on hp:

```sh
~/t3-fork/update-fork.sh                # build if anything changed
~/t3-fork/update-fork.sh --force        # build even if nothing changed
~/t3-fork/update-fork.sh --draft        # upload as a draft, nobody is offered it yet
~/t3-fork/update-fork.sh --promote vX   # release a draft
```

Rollback steps are in `~/t3-fork/ROLLBACK.md` on hp.
