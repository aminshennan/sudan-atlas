PYTHON ?= .venv/bin/python

.PHONY: setup fetch data validate test preview clean

setup:            ## Install the pipeline's Python and Node dependencies
	python3 -m venv .venv
	.venv/bin/pip install -r pipeline/requirements.txt
	npm install

fetch:            ## Download COD-AB and geoBoundaries into data/raw/
	$(PYTHON) -m pipeline fetch

data:             ## Rebuild data/boundaries/ from data/raw/ and validate it
	$(PYTHON) -m pipeline build

validate:         ## Re-run validation on the current outputs
	$(PYTHON) -m pipeline validate

test:             ## Run the pipeline's unit tests
	$(PYTHON) -m pytest pipeline/tests -q

preview:          ## Serve the preview page at http://localhost:8000/pipeline/preview/
	$(PYTHON) -m http.server 8000

clean:            ## Remove intermediate build files
	rm -rf build
