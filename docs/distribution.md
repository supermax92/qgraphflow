# Publishing source and runtime

Keep the two deliverables separate:

| Deliverable | Contents | Excluded |
| --- | --- | --- |
| GitHub repository and automatic source archives | Viewer source and lockfile, skills, tests, build scripts, examples, client manifests and documentation | Dependencies, local settings and build/QA output |
| `qgraphflow-0.0.5.zip` / `.tgz` | Client manifests, shared skill, validator/generator and their imports, prebuilt offline Viewer, guides and license notices | Viewer development UI source, tests and dependencies |

Git preserves the committed directory structure. A fresh clone does not contain ignored `.agents/`, `node_modules/`, `output/` or `dist/`. It also does not download Release attachments. The source and lockfile needed to rebuild the Viewer remain in Git; local OpenSpec plans and editor settings are not runtime dependencies.

## Prepare locally

Run from the repository root with Node.js 22, npm, tar, zip and unzip:

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
npm run package -- dist/release-0.0.5
```

Use new output directories. Packaging refuses to overwrite existing outputs. `npm run package` uses the `package.json` file allowlist and generates the Codex marketplace **inside the runtime package** from the committed client metadata. The developer's `.agents/plugins/marketplace.json` stays local and is neither required nor copied. Keep its ignored status; do not force-add it. Use `npm run package`, not bare `npm pack`, to create installable Release artifacts.

`THIRD_PARTY_NOTICES.md` remains in Git and in the runtime. Its notices and the project license are also embedded in the standalone Viewer.

## Publish only after confirmation

1. Confirm the GitHub repository URL, commit author name/email, commit message, and the changes to include. `main` accepts changes only through a pull request (ruleset `main-pr-required-no-bypass`); commit on a branch, open the pull request and merge it once CI is green.
2. Keep the media Releases `showcase-v1` (historical) and `showcase-v2` (current README recordings) separate from software `v0.0.5`. Their attachments stay on GitHub until their removal is confirmed separately; do not move old tags or mark a media-only Release as the latest software release.
3. The seven READMEs embed the `showcase-v2` recordings (agent-desk example, `scripts/showcase-record.mjs`); the `showcase-v1` media were removed from them on 2026-09-19. Verify every new public attachment URL and checksum before linking it.
4. Re-run checks, commit the confirmed source changes, and merge them into `main` through the pull request. Do not force-push or mirror-push. Media must not enter the commit; Codex's private `refs/codex/` snapshots are not release refs.
5. Build runtime archives from the confirmed commit, record their SHA-256 checksums, verify the extracted package, and attach them to software Release `v0.0.5`. GitHub's automatic **Source code** archives are full source snapshots, not the slim plugin installer.

Local-directory clients may copy ignored files too. Install from an extracted runtime archive, not the development checkout. Passing package tests is not proof of all four clients' installation or official marketplace approval; verify each client separately before claiming support has been accepted there.

## Qoder Desktop marketplace

QGraphFlow is available in the Qoder Desktop marketplace. Search for **代码图谱可视化** or **qgraphflow** and install it; see the [client installation guide](clients.md#qoder-desktop) and [Qoder's marketplace documentation](https://docs.qoder.com/extensions/plugins).

Track marketplace releases separately from GitHub Releases and npm packages. For each marketplace update, record the version actually published in Qoder and its corresponding source commit or release archive.

## GitHub npm package

The manual **Publish GitHub npm** Actions workflow accepts an existing stable software Release version, such as `0.0.5`. Only `supermax92` may trigger it from `main`. It verifies the Release archives against `SHA256SUMS`, adapts the extracted runtime to `@supermax92/qgraphflow`, and uses the repository's short-lived `GITHUB_TOKEN` with `packages: write`. No personal token is stored in the repository, and ordinary pushes do not publish packages.

Only the npm envelope changes: the scoped name and GitHub registry are set, and unavailable development-only npm scripts are removed. Client plugin identities remain `qgraphflow`; the Release assets, tag, Viewer and skill contents are unchanged. The workflow installs the candidate, verifies all files and graph generation, then downloads and checks the published package again. Existing npm versions are never deleted or overwritten.

After first publication, check the package's **Package settings → Change visibility → Public**. GitHub may initially create it as private; `--access public` does not replace that verification. Making a package public cannot be reversed to private. This does not publish to npmjs.org or to any client's plugin marketplace.

GitHub's npm registry requires authentication even for public package installation. With a classic PAT that has `read:packages`, configure `@supermax92:registry=https://npm.pkg.github.com`, authenticate using `npm login --scope=@supermax92 --auth-type=legacy --registry=https://npm.pkg.github.com`, then install `@supermax92/qgraphflow@0.0.5`. Register the resulting `node_modules/@supermax92/qgraphflow` directory with your client as the plugin root. Never put a token in a committed `.npmrc` or paste it into an issue. See the [GitHub npm documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).
