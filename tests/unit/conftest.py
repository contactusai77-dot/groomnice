"""
Unit test conftest — adds backend/ to sys.path so pure-function modules can be imported
without starting FastAPI or touching the database.
"""
import os
import sys
from pathlib import Path

# Point at backend/ so `import importer`, `import models`, etc. all resolve.
BACKEND = Path(__file__).parent.parent.parent / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

# Prevent any real Anthropic calls if a module happens to import it.
os.environ.setdefault("ANTHROPIC_API_KEY", "")
os.environ.setdefault("DATABASE_URL", "sqlite:///./unit_test_dummy.db")
