"""Fastly Compute entry point for the Five Big Things Flask app."""

from fastly_compute.wsgi import WsgiHttpIncoming

from app import app

HttpIncoming = WsgiHttpIncoming(app)
