# t3code fork: patched nightly builds

This branch (`fork-ci`) is the fork's default branch on purpose. It holds only
`.github/workflows/fork-nightly.yml` and this README, so none of upstream's
workflows (release every 30 minutes, Android APK every hour, and so on) are on
the default branch, and their schedules never run in this fork.

## What the workflow does

Once a day (09:17 UTC) and on manual dispatch, `fork-nightly.yml`:

1. Takes `pingdotgg/t3code` `main` and the fork's patch branch
   (`fix/nested-subagents` by default).
2. Skips if the newest release here was already built from the same upstream
   commit and patch-branch commit (dispatch with `force` to build anyway).
3. Cherry-picks the patch branch's own commits (those since its merge-base with
   upstream `main`, merges skipped) onto upstream `main`. A conflict fails the
   run with the commit and files in the job summary; the previous release stays
   the newest one. Nothing is ever pushed back to a branch.
4. Builds Windows x64 the way upstream's release workflow does
   (`release.yml` `build_bundle` + `release-desktop.yml`), with the version
   from upstream's `scripts/resolve-nightly-release.ts`:
   `<X.Y.Z>-nightly.<UTC date>.<this workflow's run number>`.
5. Publishes a prerelease here with the installer, its `.blockmap`, and the
   `nightly.yml` updater manifest. The release tag points at a one-file
   commit (`BUILD_INFO.txt`) created for that release, not at the built
   source, so GitHub lists releases in build order.

Installed fork builds check this repository (not upstream) for updates, because
the build sets `T3CODE_DESKTOP_UPDATE_REPOSITORY` to this repository.

## Differences from upstream nightlies

- Windows x64 only.
- Unsigned. Windows SmartScreen warns on first install. In-app updates still
  work: the app checks the installer's sha512 from `nightly.yml` instead of a
  code signature.
- No bundled WSL runtime, so the WSL backend is not available in these builds.
- No CLI archive, npm package, or other platforms.
- T3 Connect (relay / Clerk sign-in) is only built in when the repository
  variables `T3CODE_CLERK_PUBLISHABLE_KEY`, `T3CODE_CLERK_JWT_TEMPLATE`,
  `T3CODE_CLERK_CLI_OAUTH_CLIENT_ID`, and `T3CODE_RELAY_URL` are set.
  Relay client tracing is never configured.

## Changing the patches

Commit to the patch branch (rebased on, or merged with, upstream `main`) and
push it. The next scheduled run picks it up, or run the workflow by hand:

```sh
gh workflow run fork-nightly.yml --repo AverWasTaken/t3code -f force=true
```

To build a different branch: `-f patch_branch=<branch>`.
