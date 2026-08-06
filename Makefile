.PHONY: test deploy

test:
	python3 -m unittest discover -s tests -v

deploy: test
	npx wrangler deploy
