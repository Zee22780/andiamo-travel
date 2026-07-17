"""Tiny SSE encoder shared by the stub and (later) the real pipeline.

Matches how the Next.js routes emit SSE: one event line, one compact-JSON
data line, blank-line terminator. See CONTRACT.md § C2.
"""

import json
from typing import Any


def sse_event(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"
