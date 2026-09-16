# Publishing source, runtime, and showcase media

Keep the three deliverables separate:

| Deliverable | Contents | Excluded |
| --- | --- | --- |
| GitHub repository and automatic source archives | Viewer source and lockfile, skills, tests, build scripts, examples, client manifests and documentation | Dependencies, local settings, recordings and build/QA output |
| `qgraphflow-0.0.4.zip` / `.tgz` | Client manifests, shared skill, validator/generator and their imports, prebuilt offline Viewer, guides and license notices | Viewer development UI source, tests, dependencies and showcase media |
| Independent showcase Release attachments | The 98 declared e-commerce GIF/PNG files, `showcase-media.json` and `SHA256SUMS` | Old recordings, frames and unrelated QA artifacts |

Git preserves the committed directory structure. A fresh clone does not contain ignored `.agents/`, `node_modules/`, `output/`, `dist/` or `docs/images/showcase/`. It also does not download Release attachments. The source and lockfile needed to rebuild the Viewer remain in Git; local OpenSpec plans and editor settings are not runtime dependencies.

## Prepare locally

Run from the repository root with Node.js 22, npm, tar, zip and unzip:

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
npm run package -- dist/release-0.0.4
```

Use new output directories. Packaging refuses to overwrite existing outputs. `npm run package` uses the `package.json` file allowlist and generates the Codex marketplace **inside the runtime package** from the committed client metadata. The developer's `.agents/plugins/marketplace.json` stays local and is neither required nor copied. Keep its ignored status; do not force-add it. Use `npm run package`, not bare `npm pack`, to create installable Release artifacts.

Only when publishing newly recorded media, run `npm run package:media -- dist/showcase-0.0.4`. This command verifies the current Viewer hash, each source graph hash, and every media file's byte count and SHA-256 before copying only the declared attachments. A clean clone can build the runtime without media; preparing media requires the local recordings or independently downloaded matching assets. To record again, use `scripts/build-readme-media.mjs` with Playwright, Chrome and ffmpeg available. Re-recording clears the previous publication metadata: new recordings need review and new receipts before publication.

`viewerSha256` records the Viewer that actually produced those media files. A later Viewer build can legitimately differ from historical published media; preserve the original receipt and report the freshness-check failure. Never update just the hash to make old recordings pass the current-Viewer check.

`THIRD_PARTY_NOTICES.md` remains in Git and in the runtime. Its notices and the project license are also embedded in the standalone Viewer.

## Publish only after confirmation

1. Confirm the GitHub repository URL, commit author name/email, commit message, and the changes to include. Work directly on `main`; do not create another branch or worktree.
2. Keep the existing media Release `showcase-v1` separate from software `v0.0.4`. This software release retains all historical GIF/PNG files, media receipts, old Releases, attachments and npm versions. Do not delete or replace old attachments, move old tags, or mark the media-only Release as the latest software release.
3. Keep the seven READMEs' verified historical media URLs. If publishing new recordings in a future release, verify every new public attachment URL and checksum before updating links or marking its media receipt as published.
4. Re-run checks, commit the confirmed source changes on `main`, and push `main` normally. Do not force-push or mirror-push. Media must not enter the commit; Codex's private `refs/codex/` snapshots are not release refs.
5. Build runtime archives from the confirmed commit, record their SHA-256 checksums, verify the extracted package, and attach them to software Release `v0.0.4`. GitHub's automatic **Source code** archives are full source snapshots, not the slim plugin installer.

The seven READMEs reference verified public assets in [showcase-v1](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v1). The 98 new assets comprise 5 GIFs and 9 PNGs per language (`en`, `zh-CN`, `ru`, `pt`, `ja`, `de`, `es`); all 63 legacy Kafka GIFs and the original tag are retained. `docs/showcase-media.json` records the publication and content hashes. A top GIF has three 0.8-second views, totaling 2.4 seconds. The four interaction GIFs retain their longer operation/read time. Public media links work independently of the ignored local recordings; viewing them requires network access.

Local-directory clients may copy ignored files too. Install from an extracted runtime archive, not the development checkout. Passing package tests is not proof of all four clients' installation or official marketplace approval; verify each client separately before claiming support has been accepted there.

## GitHub npm package

The manual **Publish GitHub npm** Actions workflow accepts an existing stable software Release version, such as `0.0.4`. Only `supermax92` may trigger it from `main`. It verifies the Release archives against `SHA256SUMS`, adapts the extracted runtime to `@supermax92/qgraphflow`, and uses the repository's short-lived `GITHUB_TOKEN` with `packages: write`. No personal token is stored in the repository, and ordinary pushes do not publish packages.

Only the npm envelope changes: the scoped name and GitHub registry are set, and unavailable development-only npm scripts are removed. Client plugin identities remain `qgraphflow`; the Release assets, tag, Viewer and skill contents are unchanged. The workflow installs the candidate, verifies all files and graph generation, then downloads and checks the published package again. Existing npm versions are never deleted or overwritten.

After first publication, check the package's **Package settings → Change visibility → Public**. GitHub may initially create it as private; `--access public` does not replace that verification. Making a package public cannot be reversed to private. This does not publish to npmjs.org or to any client's plugin marketplace.

GitHub's npm registry requires authentication even for public package installation. With a classic PAT that has `read:packages`, configure `@supermax92:registry=https://npm.pkg.github.com`, authenticate using `npm login --scope=@supermax92 --auth-type=legacy --registry=https://npm.pkg.github.com`, then install `@supermax92/qgraphflow@0.0.4`. Register the resulting `node_modules/@supermax92/qgraphflow` directory with your client as the plugin root. Never put a token in a committed `.npmrc` or paste it into an issue. See the [GitHub npm documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).
