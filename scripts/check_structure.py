#!/usr/bin/env python3
"""Check static site paths and script order using only the Python standard library.

Run from anywhere: python3 scripts/check_structure.py [site-root]
Dynamic paths built entirely at runtime and remote URLs are outside this check.
"""

import argparse
import ipaddress
import re
import sys
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


IGNORED_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__"}
MANAGERS = {
    "StorageManager", "AuthManager", "CatalogManager", "NoteManager",
    "ReviewManager", "ReviewView",
}
JS_TOKENS = re.compile(
    r'(?P<string>"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`)'
    r'|(?P<comment>//[^\n]*|/\*[\s\S]*?\*/)', re.DOTALL
)
STATIC_ASSET = re.compile(
    r"(?<![\w./:@-])((?:\.{1,2}/)+[\w./-]*|"
    r"[\w./-]+\.(?:html?|css|m?js|avif|gif|ico|jpe?g|png|svg|webp))"
    r"(?=$|[\s\"'`?#<>)\]}])", re.IGNORECASE
)
HTML_REFERENCES = re.compile(r"\b(?:href|src|action)\s*=\s*([\"'])(.*?)\1", re.DOTALL)
NAVIGATION = re.compile(
    r"(?:\blocation(?:\.href)?\s*=\s*|\blocation\.(?:assign|replace)\(\s*|"
    r"\brequireAuth\(\s*|\bloginPage\s*=\s*|"
    r"\bhistory\.(?:pushState|replaceState)\([^;\n]*,\s*)$"
)
CSS_REFERENCES = re.compile(
    r"url\(\s*(?:\"([^\"]*)\"|'([^']*)'|([^)]*))\s*\)"
    r"|@import\s+(?:\"([^\"]*)\"|'([^']*)')", re.IGNORECASE
)


def without_comments(source, language):
    """Preserve line numbers and quoted URLs while removing comments."""
    if language == "js":
        return JS_TOKENS.sub(
            lambda match: re.sub(r"[^\n]", " ", match.group())
            if match.lastgroup == "comment" else match.group(), source
        )
    return re.sub(
        r"/\*[\s\S]*?\*/", lambda match: re.sub(r"[^\n]", " ", match.group()), source
    )


def local_path(reference):
    reference = unescape(reference).strip()
    if not reference or reference.startswith(("#", "?")):
        return None
    url = urlsplit(reference)
    if url.scheme == "file":
        raise ValueError("URL file:// vietato: usare un percorso relativo")
    if url.netloc:
        host = (url.hostname or "").lower()
        try:
            local_host = ipaddress.ip_address(host).is_loopback or host == "0.0.0.0"
        except ValueError:
            local_host = host == "localhost" or host.endswith(".localhost")
        if local_host:
            raise ValueError("URL localhost assoluto vietato: usare un percorso relativo")
        return None
    if url.scheme:
        return None
    path = unquote(url.path)
    if path.startswith("/"):
        raise ValueError("percorso dalla radice vietato: usare un percorso relativo")
    # A static filename before ?${...} remains checkable; a dynamic filename does not.
    return None if not path or "${" in path else path


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references = []
        self.scripts = []
        self.inline_scripts = []
        self.in_inline_script = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        line = self.getpos()[0]
        for attribute in ("href", "src", "action"):
            if attrs.get(attribute) is not None:
                self.references.append((attrs[attribute], line))
        if tag == "script":
            self.in_inline_script = not attrs.get("src")
            if attrs.get("src"):
                self.scripts.append((attrs["src"], line))

    handle_startendtag = handle_starttag

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_inline_script = False

    def handle_data(self, data):
        if self.in_inline_script:
            self.inline_scripts.append((data, self.getpos()[0]))


class SiteCheck:
    def __init__(self, root):
        self.root = root.resolve()
        self.errors = set()
        self.checked_paths = set()
        self.js_sources = {}

    def label(self, path):
        return str(path.relative_to(self.root)) if path.is_relative_to(self.root) else str(path)

    def resolve(self, reference, context):
        path = local_path(reference)
        if path is None:
            return None
        target = (context.parent / path).resolve()
        return target / "index.html" if path.endswith("/") or target.is_dir() else target

    def check_reference(self, reference, context, source, line):
        origin = f" (dalla pagina {self.label(context)})" if context != source else ""
        location = f"{self.label(source)}:{line}"
        try:
            path = local_path(reference)
            target = self.resolve(reference, context)
        except ValueError as error:
            self.errors.add(f"{location}: {error}: {reference!r}{origin}")
            return None
        if target is None:
            return None
        self.checked_paths.add((context, target))
        if (context.parent / path).is_dir() and not path.endswith("/"):
            self.errors.add(f"{location}: URL directory senza slash finale: {reference!r}{origin}")
        if not target.is_file():
            self.errors.add(
                f"{location}: percorso mancante {reference!r} "
                f"(atteso {self.label(target)}){origin}"
            )
        return target

    def check_js(self, source, code, page, offset=0):
        code = without_comments(code, "js")
        code = re.sub(r"<!--[\s\S]*?-->", lambda match: re.sub(r"[^\n]", " ", match.group()), code)
        references = {}

        def collect(reference, position):
            line = offset + code.count("\n", 0, position) + 1
            # Deduplicate a complete template URL and its static prefix before ?${...}.
            key = (line, reference.split("?", 1)[0].split("#", 1)[0])
            references[key] = reference

        for match in HTML_REFERENCES.finditer(code):
            collect(match.group(2), match.start(2))
        # Inspect URL strings, redirects and fallback paths inside HTML templates.
        for token in JS_TOKENS.finditer(code):
            if token.lastgroup != "string":
                continue
            literal = token.group()[1:-1]
            navigation = NAVIGATION.search(code[max(0, token.start() - 160):token.start()])
            looks_like_url = (
                re.match(r"^(?:file:|https?://|//)", literal, re.IGNORECASE)
                or re.match(r"^(?:\.{1,2}/|/(?!/))[\w./%-]*(?:[?#]|$)", literal)
                or re.fullmatch(r"[\w./-]+/(?:[?#][\s\S]*)?", literal)
            )
            if navigation or (looks_like_url and literal != "/"):
                collect(literal, token.start() + 1)
                continue
            for match in STATIC_ASSET.finditer(literal):
                reference = match.group(1)
                prefix = literal[:match.start()]
                # Ignore suffixes of interpolated URLs (e.g. `${base}/image.png`).
                if prefix.endswith("}"):
                    continue
                collect(reference, token.start() + 1 + match.start())
        for (line, _), reference in references.items():
            self.check_reference(reference, page, source, line)
        return code

    def check_page(self, page):
        parser = PageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        for reference, line in parser.references:
            self.check_reference(reference, page, page, line)

        loaded = set()
        for reference, line in parser.scripts:
            script = self.check_reference(reference, page, page, line)
            if script is None or not script.is_file():
                continue
            if script not in self.js_sources:
                self.js_sources[script] = script.read_text(encoding="utf-8")
            code = self.check_js(script, self.js_sources[script], page)
            defined = set(re.findall(r"\bclass\s+(\w+)", code)) & MANAGERS
            used = set(re.findall(r"\b(\w+)\s*\.", code)) & MANAGERS
            for dependency in sorted(used - defined - loaded):
                self.errors.add(
                    f"{self.label(page)}:{line}: {self.label(script)} richiede "
                    f"{dependency}, da caricare prima dello script"
                )
            loaded.update(defined)
        for code, line in parser.inline_scripts:
            self.check_js(page, code, page, line - 1)

    def run(self):
        files = sorted(path for path in self.root.rglob("*") if path.is_file()
                       and not (set(path.relative_to(self.root).parts) & IGNORED_DIRS))
        pages = [path for path in files if path.suffix.lower() == ".html"]
        stylesheets = [path for path in files if path.suffix.lower() == ".css"]
        if not pages:
            self.errors.add("Nessuna pagina HTML trovata.")
        for page in pages:
            self.check_page(page)
        for stylesheet in stylesheets:
            code = without_comments(stylesheet.read_text(encoding="utf-8"), "css")
            for match in CSS_REFERENCES.finditer(code):
                reference = next(value for value in match.groups() if value is not None)
                self.check_reference(reference.strip(), stylesheet, stylesheet,
                                     code.count("\n", 0, match.start()) + 1)
        if self.errors:
            for error in sorted(self.errors):
                print(f"ERRORE: {error}", file=sys.stderr)
            print(f"Verifica fallita: {len(self.errors)} errori.", file=sys.stderr)
            return 1
        print(f"OK: {len(pages)} pagine HTML, {len(stylesheets)} fogli CSS, "
              f"{len(self.js_sources)} script JS; percorsi relativi, directory e dipendenze validi.")
        return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    if not args.root.is_dir():
        parser.error(f"Cartella inesistente: {args.root}")
    return SiteCheck(args.root).run()


if __name__ == "__main__":
    sys.exit(main())
