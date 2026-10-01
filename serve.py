#!/usr/bin/env python3
"""Serve lif-view on a port the LIF MDR allows for browser calls (8080 is in the demo stack's CORS list)."""

import http.server
import os
import sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"lif-view on http://localhost:{port}/  (Ctrl+C to stop)")
http.server.ThreadingHTTPServer(("", port), http.server.SimpleHTTPRequestHandler).serve_forever()
