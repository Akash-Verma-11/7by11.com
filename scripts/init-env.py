from pathlib import Path
import secrets
root=Path(__file__).resolve().parent.parent
path=root/'.env'
if path.exists():print('Existing .env preserved')
else:
    path.write_text((root/'.env.example').read_text().replace('CHANGE_ME_WITH_INIT_ENV',secrets.token_hex(24)))
    path.chmod(0o600)
    print('Created .env with a random database password. Keep it private.')
