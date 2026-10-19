"""Start the LOIS terminal API (and the built frontend) on the LAN.

    .\\.venv\\Scripts\\python.exe "LOIS Terminal\\backend\\run.py"            # port 8600
    .\\.venv\\Scripts\\python.exe "LOIS Terminal\\backend\\run.py" --port 8700

Python 3.14's default Windows Proactor loop can close the listening socket after a failed accept
(see run_dashboard.py), so the Selector loop is used instead.
"""

import argparse
import asyncio
import sys
import warnings
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8600)
    args = parser.parse_args()

    if sys.platform == "win32":
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    from lois_api.main import app

    uvicorn.run(app, host=args.host, port=args.port, loop="asyncio", log_level="info")
