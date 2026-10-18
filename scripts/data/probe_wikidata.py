"""Bounded source feasibility probe; not a normalized POI collector or demo dataset."""

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "QadamSourceProbeBot/0.1 (https://github.com/dinrkz/QWERTY)"
MAX_BYTES = 4_000_000
QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
SELECT ?item ?itemLabel ?itemDescription ?location ?type ?typeLabel WHERE {
  wd:Q1520 wdt:P625 ?center .
  SERVICE wikibase:around {
    ?item wdt:P625 ?location .
    bd:serviceParam wikibase:center ?center ; wikibase:radius "15" .
  }
  OPTIONAL { ?item wdt:P31 ?type . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en,kk" . }
}
ORDER BY ?item ?location ?type
LIMIT 200
"""


def binding_value(row, field, *, optional=False):
    """Unbound optional SPARQL variables are omitted, not null bindings."""
    if optional and field not in row:
        return None
    binding = row.get(field)
    if not isinstance(binding, dict) or not isinstance(binding.get("value"), str):
        raise ValueError("Expected a SPARQL binding with a string value")
    return binding["value"]


def summarize(payload):
    """Count unique entities; multiple coordinates/types can produce duplicate rows."""
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), dict):
        raise ValueError("Expected a SPARQL results object")
    rows = payload["results"].get("bindings")
    if not isinstance(rows, list):
        raise ValueError("Expected a SPARQL bindings list")
    entities = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Expected a SPARQL result row object")
        identifier = binding_value(row, "item")
        if not re.fullmatch(r"http://www\.wikidata\.org/entity/Q[1-9][0-9]*", identifier):
            raise ValueError("Unexpected entity identifier")
        entity = entities.setdefault(identifier, {"description": False, "type": False})
        entity["description"] |= bool(binding_value(row, "itemDescription", optional=True))
        entity["type"] |= bool(binding_value(row, "type", optional=True))
    return {
        "rows": len(rows),
        "unique_entities": len(entities),
        "entities_with_description": sum(e["description"] for e in entities.values()),
        "entities_with_type": sum(e["type"] for e in entities.values()),
        "row_limit_reached": len(rows) >= 200,
        "coverage_complete": False,
        "note": "Bounded geographic sample, not a POI suitability or city coverage audit.",
    }


def fetch():
    request = Request(
        ENDPOINT + "?" + urlencode({"query": QUERY, "format": "json"}),
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json",
                 "Accept-Encoding": "gzip"},
    )
    # One request only: stop on throttling; never bypass restrictions or retry rapidly.
    with urlopen(request, timeout=45) as response:
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("Response exceeds probe size limit")
        if response.headers.get("Content-Encoding") == "gzip":
            with gzip.GzipFile(fileobj=io.BytesIO(body)) as compressed:
                body = compressed.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("Decoded response exceeds probe size limit")
        return json.loads(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True,
                        help="New directory for raw evidence; normally under data/raw/")
    args = parser.parse_args()
    # Never overwrite a previous probe, including failure evidence.
    args.output_dir.mkdir(parents=True, exist_ok=False)
    report = {
        "source": "Wikidata", "endpoint": ENDPOINT,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "query_sha256": hashlib.sha256(QUERY.encode()).hexdigest(),
        "license": "CC0-1.0",
        "license_url": "https://www.wikidata.org/wiki/Wikidata:Licensing",
        "status": "failed",
    }
    (args.output_dir / "query.rq").write_text(QUERY, encoding="utf-8")
    try:
        payload = fetch()
        report.update(summarize(payload))
        (args.output_dir / "response.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["status"] = "sample_received"
    except HTTPError as error:
        report["error"] = f"HTTP {error.code}"
        report["retry_after"] = error.headers.get("Retry-After")
    except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as error:
        # No URL, response body or arbitrary exception text in logs.
        report["error"] = type(error).__name__
    (args.output_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "sample_received" else 1


if __name__ == "__main__":
    sys.exit(main())
