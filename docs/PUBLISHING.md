# Publishing the packages

Publishing needs accounts and tokens, so Amin does it; everything else is prepared. Run the commands from the repository root on a computer with Python 3.11+ and Node 18+.

## Before every release

1. Make sure `main` holds the release and CI is green.
2. Set the same version in `packages/js/package.json` and `packages/py/pyproject.toml` (and `__version__` in `packages/py/src/sudan_atlas/__init__.py`). Use `0.1.0` for the first release.
3. Rebuild and test:
   ```sh
   make setup        # first time only
   make test test-js
   make packages
   ```
   This writes `packages/js/dist/` and `packages/py/dist/sudan_atlas-<version>.tar.gz` and `.whl`.

## npm (`sudan-atlas`)

First time only:

1. Create an account at https://www.npmjs.com/signup and turn on two-factor authentication (npm requires it to publish).
2. On your computer: `npm login`.

Each release:

```sh
cd packages/js
npm publish --dry-run   # check the file list: dist/, data/, README.md, LICENSE, LICENSE-DATA
npm publish
```

Within a few minutes the package is at https://www.npmjs.com/package/sudan-atlas and on jsDelivr at `https://cdn.jsdelivr.net/npm/sudan-atlas@<version>/`. The browser build fetches boundary files from that jsDelivr address, so check one loads, for example `https://cdn.jsdelivr.net/npm/sudan-atlas@0.1.0/data/boundaries/light/adm1.geojson`.

## PyPI (`sudan-atlas`)

First time only:

1. Create an account at https://pypi.org/account/register/ and turn on two-factor authentication.
2. Create an API token at https://pypi.org/manage/account/token/ (scope: entire account for the first upload; after that, limit it to the `sudan-atlas` project).
3. Save it for twine, in `~/.pypirc`:
   ```ini
   [pypi]
   username = __token__
   password = pypi-...your token...
   ```

Each release:

```sh
.venv/bin/twine check packages/py/dist/*
.venv/bin/twine upload packages/py/dist/*
```

The package appears at https://pypi.org/project/sudan-atlas/. Check it in a fresh environment: `pip install "sudan-atlas[geo]"`, then `python -c "import sudan_atlas; print(sudan_atlas.match('El Fasher', level=2)['pcode'])"` prints `SD02114`.

To rehearse first, use TestPyPI (https://test.pypi.org, a separate account and token) with `twine upload --repository testpypi packages/py/dist/*`.

## After publishing

1. Create a GitHub release for the package version (for example `packages-v0.1.0`, targeting `main`), with a short note of what changed.
2. Open the examples in `examples/` without the `?lib=` override: they load the package from jsDelivr, so they work only once the npm package is published.
