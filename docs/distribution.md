# Publishing source, runtime, and showcase media

The source repository and plugin packages do not contain the 63 README GIFs. Local recording originals stay under ignored `docs/images/showcase/<locale>/<type>.gif`; frame sequences and QA outputs stay under ignored `output/`.

`showcase-media.json` records the 63 Release asset names, byte counts, and SHA-256 checksums. These files are hosted under their `kafka.<locale>.<type>.gif` asset names in the dedicated **showcase-v1** Release. The seven READMEs reference its fixed download URLs. Keep media Releases separate from the latest software release.

Before publishing the README changes:

1. Verify every local GIF against the manifest and upload the matching assets.
2. Verify all 63 public asset URLs, sizes, checksums, and animation playback.
3. Publish the source branch/tag after confirming no media is in its commit history.
4. Build the runtime archives with `npm run package`, verify native-client acceptance and checksums, then attach them to the corresponding software Release.

The default branch contains the 0.0.2 development source; its software archives have not been released yet. Media URLs must pass the public-access gate before their README changes are pushed. Package and source tests run offline and do not fetch Release assets. All seven source JSON collections remain in the repository; the runtime package contains only the English Kafka collection and the small order-flow example.

The `package.json` files allowlist is authoritative for ZIP and npm-format archives. Keep the transitive Node imports used by the validator and generator; the prebuilt Viewer HTML alone is insufficient. Git installation instead follows committed files and history, so media is ignored before its first commit. Codex's private `refs/codex/` turn snapshots are local development state, not release refs; never mirror-push local refs.

Local-directory installation is a third path: clients may copy ignored files as well. Use the extracted runtime package as the local marketplace/plugin source, never a development checkout containing recordings, `output/`, or `node_modules/`.
