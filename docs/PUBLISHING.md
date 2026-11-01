# Publishing the packages

Both packages are published by a GitHub workflow, `.github/workflows/release.yml`, when a GitHub release tagged `packages-v<version>` is published. The workflow tests both packages, builds them, and publishes them to npm and PyPI. npm and PyPI trust that workflow directly ("trusted publishing"), so no token is stored anywhere.

Setting it up needs accounts, so Amin does it once. npm requires a package to exist before it can trust a workflow, so the first npm release is published by hand.

## Once: set up the accounts

### PyPI

1. Create an account at https://pypi.org/account/register/ and turn on two-factor authentication.
2. Go to https://pypi.org/manage/account/publishing/ and add a **pending publisher** for GitHub:
   - PyPI project name: `sudan-atlas`
   - Owner: `aminshennan`
   - Repository name: `sudan-atlas`
   - Workflow name: `release.yml`
   - Environment name: leave empty

   A pending publisher does not reserve the name, so do this shortly before the first release.

### npm

1. Create an account at https://www.npmjs.com/signup and turn on two-factor authentication.
2. Publish the first version by hand, from the repository root on a computer with Python 3.11+ and Node 18+:
   ```sh
   make setup        # first time only
   make test test-js
   make packages
   cd packages/js
   npm login
   npm publish --dry-run   # check the file list: dist/, data/, README.md, LICENSE, LICENSE-DATA
   npm publish --access public
   ```
3. On https://www.npmjs.com/package/sudan-atlas, open **Settings**, then **Trusted publisher**, choose **GitHub Actions**, and enter:
   - Organization or user: `aminshennan`
   - Repository: `sudan-atlas`
   - Workflow filename: `release.yml`
   - Environment: leave empty
   - Allowed actions: **Publish**. With only *Stage publish* allowed, the workflow fails with "OIDC permission denied for this action".

   npm's documentation says a new trusted publisher must be used for a successful publish within two days, so set it up shortly before the next release.

## Each release

1. Set the same version in `packages/js/package.json`, `packages/py/pyproject.toml` and `__version__` in `packages/py/src/sudan_atlas/__init__.py`, and merge to `main`. The first release is `0.1.0`, already set.
2. Optional rehearsal: in GitHub, **Actions → Release packages → Run workflow**. A run started by hand tests and builds both packages but publishes nothing.
3. Create a GitHub release targeting `main`, tagged `packages-v<version>` (for example `packages-v0.1.0`), with a short note of what changed, and publish it.

The workflow stops if the three versions differ or the tag does not match them. A version already on npm or PyPI is skipped, so the first release, whose npm package was published by hand, sends only the PyPI package; re-running a failed release is safe.

While the repository is private, npm cannot record provenance (the signed link from the package to the commit that built it); the workflow turns it on once the repository is public.

## Check the published packages

- npm: https://www.npmjs.com/package/sudan-atlas, and on jsDelivr within a few minutes. The browser build fetches boundary files from jsDelivr, so check one loads: `https://cdn.jsdelivr.net/npm/sudan-atlas@0.1.0/data/boundaries/light/adm1.geojson`.
- PyPI: https://pypi.org/project/sudan-atlas/. In a fresh environment, `pip install "sudan-atlas[geo]"`, then `python -c "import sudan_atlas; print(sudan_atlas.match('El Fasher', level=2)['pcode'])"` prints `SD02114`.
- Open the examples in `examples/` without the `?lib=` override: they load the package from jsDelivr, so they work only once the npm package is published.

## Without the workflow

If the workflow cannot be used, publish from a computer after `make packages`: `npm publish --access public` in `packages/js`, and `.venv/bin/twine upload packages/py/dist/*` with a PyPI API token from https://pypi.org/manage/account/token/. To rehearse the PyPI upload, use TestPyPI (https://test.pypi.org, a separate account) with `twine upload --repository testpypi packages/py/dist/*`.
