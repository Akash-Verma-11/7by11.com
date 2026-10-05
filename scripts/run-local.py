"""One-command local SQLite demo; does not use or modify your Compose .env."""
import os
from pathlib import Path
import subprocess
import sys
import venv

root = Path(__file__).resolve().parent.parent
if sys.version_info[:2] != (3, 12):
    raise SystemExit('Use Python 3.12 for this release. See START_HERE.md.')
local_venv = root / '.venv'
python = local_venv / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
if not python.exists():
    print('Creating isolated Python environment...', flush=True)
    venv.EnvBuilder(with_pip=True).create(local_venv)
env = os.environ.copy()
# The demo must never connect to an inherited deployment database.
env.pop('PYTHONPATH', None)
env.pop('PYTHONHOME', None)
check = subprocess.run([str(python), '-c', 'import flask, gunicorn, psycopg; from PIL import Image'], env=env, capture_output=True)
if check.returncode:
    subprocess.run([str(python), '-m', 'pip', 'install', '-r', str(root / 'requirements.txt')], env=env, check=True)
env.update(DATABASE_URL='', SQLITE_PATH=str(root / 'data' / '7by11.db'),
           BIND_ADDRESS='127.0.0.1', PORT='3000', PUBLIC_ORIGIN='http://localhost:3000',
           ALLOWED_HOSTS='localhost,127.0.0.1', SEED_DEMO='true',
           DEMO_PASSWORD='7by11Demo!2026', PAYMENT_MODE='demo')
print('Open http://localhost:3000. Stop with Ctrl+C. Local demo uses SQLite.', flush=True)
try:
    raise SystemExit(subprocess.call([str(python), str(root / 'run.py')], cwd=root, env=env))
except KeyboardInterrupt:
    pass
