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

## Online demo

`.github/workflows/pages.yml` builds the [live demo](https://supermax92.github.io/qgraphflow/) from the repository examples with the committed prebuilt Viewer, the one an installed plugin uses: the nine-view e-commerce collection and the agent-desk architecture, sequence and ER diagrams (checked against `examples/showcase/agent-desk` with `--repo-root`), each in English and Simplified Chinese, with `docs/pages/index.html` as the home page. Every page folder also serves its `graph.json` and SVGs.

Pull requests that touch the examples, the generator, the prebuilt Viewer, `docs/pages/` or the workflow run the build as a smoke test; pushes to `main` also deploy it. The site is uploaded as a Pages artifact and never enters a branch, and a failed build leaves the previous deployment online. Before the first deployment, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

## npmjs package

`qgraphflow` on npmjs.com is the Release tarball itself. The **npmjs** job of the manual **Publish GitHub npm** workflow (`.github/workflows/publish-github-npm.yml`) checks `qgraphflow-<version>.tgz` against `SHA256SUMS` and publishes it unchanged with `npm publish --provenance --access public`. Anyone can then run `npx -y qgraphflow validate …` or `npm install qgraphflow` without logging in to a registry.

The job uses npm trusted publishing: GitHub Actions proves its identity to npmjs.com through OIDC (`id-token: write`), and npmjs.com accepts only this workflow file in this repository. No npm token exists in the repository, its secrets or the workflow; a stored long-lived token could publish any version from anywhere it leaks to.

Set it up once:

1. First publication. If npmjs.com cannot configure a trusted publisher before the package exists, publish the first version yourself from the verified Release tarball, with two-factor authentication:

   ```bash
   gh release download v0.0.6 --repo supermax92/qgraphflow --pattern 'qgraphflow-0.0.6.*' --pattern SHA256SUMS
   sha256sum --check --strict SHA256SUMS
   npm publish qgraphflow-0.0.6.tgz --access public
   ```

   On macOS use `shasum -a 256 -c SHA256SUMS`. Then run the workflow for this version as usual: GitHub Packages publishes it, and the npmjs job finds the version already on npmjs.com, skips publishing and still runs the comparison and `npx` checks below. A version published by hand carries no provenance; provenance starts with the first version the workflow publishes.
2. On npmjs.com, open the package's **Settings → Trusted Publisher**, choose **GitHub Actions** and enter user `supermax92`, repository `qgraphflow` and workflow file `publish-github-npm.yml`; leave the environment empty. Renaming the workflow file stops publication until this setting changes too.
3. Optionally set **Publishing access** to require two-factor authentication and disallow tokens; trusted publishing keeps working.

For every later version, trigger the workflow from `main` and type the exact stable Release version; the field has no default, so an old version cannot go out by accident. A version already on npmjs.com is never published again; the job only verifies it. After publishing, the job downloads `qgraphflow@<version>` from npmjs.com, compares it byte for byte with the Release tarball (`cmp`), and runs `npx -y qgraphflow@<version>` for `validate --help`, `validate` and `generate` on `examples/order-flow.graph.json`. Check the provenance badge on the package page, or run `npm audit signatures` in a project that installs it. Published versions are never deleted or overwritten; deprecate a broken version with `npm deprecate` and release a fix.

## GitHub npm package

GitHub Packages keeps publishing `@supermax92/qgraphflow` for existing installations; new installations use npmjs.com.

The manual **Publish GitHub npm** Actions workflow accepts an existing stable software Release version, such as `0.0.5`. Only `supermax92` may trigger it from `main`. It verifies the Release archives against `SHA256SUMS`, adapts the extracted runtime to `@supermax92/qgraphflow`, and uses the repository's short-lived `GITHUB_TOKEN` with `packages: write`. No personal token is stored in the repository, and ordinary pushes do not publish packages.

Only the npm envelope changes: the scoped name and GitHub registry are set, and unavailable development-only npm scripts are removed. Client plugin identities remain `qgraphflow`; the Release assets, tag, Viewer and skill contents are unchanged. The workflow installs the candidate, verifies all files and graph generation, then downloads and checks the published package again. Existing npm versions are never deleted or overwritten.

After first publication, check the package's **Package settings → Change visibility → Public**. GitHub may initially create it as private; `--access public` does not replace that verification. Making a package public cannot be reversed to private. The workflow's separate **npmjs** job publishes to npmjs.com (see [npmjs package](#npmjs-package)); neither job publishes to any client's plugin marketplace.

GitHub's npm registry requires authentication even for public package installation. With a classic PAT that has `read:packages`, configure `@supermax92:registry=https://npm.pkg.github.com`, authenticate using `npm login --scope=@supermax92 --auth-type=legacy --registry=https://npm.pkg.github.com`, then install `@supermax92/qgraphflow@0.0.5`. Register the resulting `node_modules/@supermax92/qgraphflow` directory with your client as the plugin root. Never put a token in a committed `.npmrc` or paste it into an issue. See the [GitHub npm documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).
