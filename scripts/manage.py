"""Run from project root: python scripts/manage.py create-user / change-password."""
import sys, getpass
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from app.core import seed_database,uid,now,generate_password_hash
from app.db import transaction
seed_database()
action=sys.argv[1] if len(sys.argv)>1 else ''
if action == 'disable-demo':
    with transaction(True) as db:
        for ident in ('customer','seller','seller2','admin','delivery','warehouse','support','finance'):
            db.execute("UPDATE users SET status='suspended' WHERE id=?",(ident,))
            db.execute('DELETE FROM sessions WHERE user_id=?',(ident,))
    print('Demo accounts suspended. Set SEED_DEMO=false before restarting.')
    raise SystemExit(0)
if action not in ('create-user','change-password'):
    raise SystemExit('Usage: python scripts/manage.py create-user | change-password | disable-demo')
email=input('Email: ').strip().lower();pw=getpass.getpass('New password at least 12 characters: ')
if '@' not in email or len(pw)<12:raise SystemExit('Invalid email or password')
with transaction(True) as db:
    existing=db.one('SELECT id FROM users WHERE email=?',(email,))
    if action=='change-password':
        if not existing:raise SystemExit('Account not found')
        db.execute('UPDATE users SET password=? WHERE email=?',(generate_password_hash(pw),email));db.execute('DELETE FROM sessions WHERE user_id=?',(existing['id'],))
    else:
        if existing:raise SystemExit('Account exists')
        name=input('Display name: ').strip();role=input('Role customer/seller/admin/delivery/warehouse/support/finance: ').strip()
        if role not in ('customer','seller','admin','delivery','warehouse','support','finance') or not name:raise SystemExit('Invalid name or role')
        db.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',(uid('u-'),email,name,generate_password_hash(pw),role,'active',now()))
print('Saved. Other accounts and data are unchanged.')
