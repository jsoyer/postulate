.PHONY: dev install lint fmt test clean

dev:
	python -m cv_tui

install:
	pip install -e .

lint:
	ruff check src/
	mypy src/

fmt:
	ruff format src/

test:
	pytest --cov=cv_tui --cov-report=term-missing

clean:
	rm -rf dist/ build/ *.egg-info .mypy_cache .ruff_cache .pytest_cache htmlcov .coverage
