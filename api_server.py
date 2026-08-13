"""
A tiny read-only REST API that your static HTML/CSS/JS streaming site can
call to get anime/episode data out of MongoDB — no server-side language
needed on the site itself, just fetch().

Runs in its own thread using a plain (synchronous) pymongo client, kept
separate from the bot's async motor client to avoid asyncio conflicts.

Endpoints:
  GET /api/animes            -> list of {id, title, poster, year} for all anime
  GET /api/animes/<id>       -> full anime doc, including seasons + episodes
  GET /                      -> plain-text health check (also used by Koyeb)

CORS is enabled for all origins so you can call this from any domain your
site is hosted on (GitHub Pages, Netlify, your own domain, etc).
"""
import os
import json
import logging
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

from bson import ObjectId
from pymongo import MongoClient

from config import MONGO_URI, MONGO_DB_NAME

logger = logging.getLogger(__name__)

_sync_client = MongoClient(MONGO_URI)
_animes = _sync_client[MONGO_DB_NAME]["animes"]


def _json_default(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Not JSON serializable: {obj!r}")


class ApiHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload):
        body = json.dumps(payload, default=_json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # CORS preflight
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/" or path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Anime bot + API is running.")
            return

        if path == "/api/animes":
            docs = list(_animes.find(
                {}, {"title": 1, "poster": 1, "banner": 1, "year": 1, "imdb": 1}
            ))
            for d in docs:
                d["id"] = str(d.pop("_id"))
            self._send_json(200, docs)
            return

        if path.startswith("/api/animes/"):
            anime_id = path.rsplit("/", 1)[-1]
            try:
                doc = _animes.find_one({"_id": ObjectId(anime_id)})
            except Exception:
                self._send_json(400, {"error": "Invalid anime id"})
                return
            if not doc:
                self._send_json(404, {"error": "Not found"})
                return
            doc["id"] = str(doc.pop("_id"))
            self._send_json(200, doc)
            return

        self._send_json(404, {"error": "Not found"})

    def log_message(self, format, *args):
        pass  # silence per-request logging


def start_api_server():
    port = int(os.getenv("PORT", "8000"))
    server = HTTPServer(("0.0.0.0", port), ApiHandler)
    logger.info(f"API server listening on port {port}")
    server.serve_forever()
