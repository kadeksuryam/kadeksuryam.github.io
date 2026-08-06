from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ProjectParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.article_depth = 0
        self.current = None
        self.projects = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = set(attributes.get("class", "").split())
        if tag == "article" and "project-card" in classes:
            self.article_depth = 1
            self.current = {"text": [], "links": []}
            return
        if self.article_depth:
            self.article_depth += 1
            if tag == "a":
                self.current["links"].append(attributes)

    def handle_endtag(self, tag):
        if not self.article_depth:
            return
        self.article_depth -= 1
        if self.article_depth == 0:
            self.projects.append(self.current)
            self.current = None

    def handle_data(self, data):
        if self.article_depth and data.strip():
            self.current["text"].append(data.strip())


class SiteContractTest(unittest.TestCase):
    def setUp(self):
        self.index = (ROOT / "index.html").read_text(encoding="utf-8")
        self.parser = ProjectParser()
        self.parser.feed(self.index)

    def test_pandu_card_has_one_safe_private_alpha_link(self):
        cards = [card for card in self.parser.projects if "Pandu" in card["text"]]
        self.assertEqual(1, len(cards))
        card = cards[0]
        links = [link for link in card["links"] if link.get("href") == "https://pandu.kadeksuryam.dev"]
        self.assertEqual(1, len(links))
        self.assertEqual("_blank", links[0].get("target"))
        self.assertEqual({"noopener", "noreferrer"}, set(links[0].get("rel", "").split()))
        self.assertIn("PRIVATE ALPHA", " ".join(card["text"]))
        self.assertIn("Open private alpha", " ".join(card["text"]))

    def test_site_contains_no_inference_endpoint_or_credentials(self):
        public_files = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (ROOT / "index.html", ROOT / "main.js", ROOT / "main.css")
        )
        for forbidden in (
            "ollama",
            "11434",
            "pandu-inference",
            "cloudflareaccess.com",
            "CF-Access-Jwt-Assertion",
            "BEGIN PRIVATE KEY",
        ):
            self.assertNotIn(forbidden, public_files)
        self.assertIsNone(re.search(r"(?:sk-|pnd_)[A-Za-z0-9_-]{16,}", public_files))

    def test_unrelated_static_assets_are_unchanged(self):
        expected = {
            "main.css": "f38f65fec9f9bdc9929696b49f97aa32e69d51887a185e096af0592da380e3cc",
            "main.js": "cca7fe1bf6732b0a13b45a27d1350dca0fb0a587503a445c7e8fcc01bf2ec851",
            "favicon.svg": "d24079c6f900a4f93027a933b6cc51087dacb611fb0053a89acec6b9eeb6f00a",
        }
        for name, digest in expected.items():
            self.assertEqual(digest, sha256((ROOT / name).read_bytes()).hexdigest())


if __name__ == "__main__":
    unittest.main()
