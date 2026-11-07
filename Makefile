PYTHON ?= .venv/bin/python

.PHONY: setup fetch data validate gazetteer evaluate golden packages test test-js preview clean

setup:            ## Install the pipeline's Python and Node dependencies
	python3 -m venv .venv
	.venv/bin/pip install -r pipeline/requirements.txt
	npm install
	cd packages/js && npm install

fetch:            ## Download COD-AB and geoBoundaries into data/raw/
	$(PYTHON) -m pipeline fetch

data:             ## Rebuild data/boundaries/ from data/raw/ and validate it
	$(PYTHON) -m pipeline build

validate:         ## Re-run validation on the current outputs
	$(PYTHON) -m pipeline validate

gazetteer:        ## Rebuild data/gazetteer/places.json and variants.json from the boundaries and data/raw/
	$(PYTHON) -m pipeline gazetteer

evaluate:         ## Measure the matcher on data/tests/match_cases.csv; writes docs/MATCHER_EVALUATION.md
	$(PYTHON) -m pipeline evaluate

golden:           ## Write data/tests/match_results.json, the results both packages must reproduce
	$(PYTHON) -m pipeline golden

packages:         ## Build the npm package (packages/js/dist) and the PyPI package (packages/py/dist)
	cd packages/js && npm run build
	$(PYTHON) packages/sync_data.py
	rm -rf packages/py/dist && $(PYTHON) -m build packages/py -o packages/py/dist

test-js:          ## Run the TypeScript package tests (including the cross-language check)
	cd packages/js && npm test

test:             ## Run the pipeline and Python package tests
	$(PYTHON) packages/sync_data.py
	$(PYTHON) -m pytest pipeline/tests packages/py/tests -q

preview:          ## Serve the preview page at http://localhost:8000/pipeline/preview/
	$(PYTHON) -m http.server 8000

clean:            ## Remove intermediate build files
	rm -rf build
