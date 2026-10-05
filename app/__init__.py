"""7by11 application factory. Domain behavior is environment-configured, never hardcoded."""
import json, os, time, uuid, logging
from pathlib import Path
from flask import Flask, request, g, jsonify, send_from_directory
from werkzeug.exceptions import HTTPException
from .core import seed_database
from .db import transaction

def create_app():
    root=Path(__file__).resolve().parent.parent
    app=Flask(__name__,static_folder=None)
    app.logger.setLevel(logging.INFO)
    app.config.update(MAX_CONTENT_LENGTH=2*1024*1024,TRUSTED_HOSTS=os.getenv('ALLOWED_HOSTS','localhost,127.0.0.1').split(','))
    @app.before_request
    def before():
        g.started=time.monotonic();g.request_id=uuid.uuid4().hex
        origin=request.headers.get('Origin')
        if request.method not in ('GET','HEAD','OPTIONS') and origin:
            allowed=os.getenv('PUBLIC_ORIGIN','http://localhost:3000').split(',')
            if origin not in allowed: return jsonify(error='Origin not allowed'),403
    @app.after_request
    def after(response):
        response.headers['X-Request-ID']=getattr(g,'request_id','')
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['Referrer-Policy']='same-origin'
        response.headers['Content-Security-Policy']="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        if request.path.startswith('/api/'): response.headers['Cache-Control']='no-store'
        app.logger.info(json.dumps({'request_id':getattr(g,'request_id',''),'method':request.method,'path':request.path,'status':response.status_code,'ms':round((time.monotonic()-getattr(g,'started',time.monotonic()))*1000)}))
        return response
    @app.errorhandler(HTTPException)
    def known(e): return jsonify(error=e.description),e.code
    @app.errorhandler(Exception)
    def unknown(e):
        app.logger.exception('Unexpected request failure')
        return jsonify(error='Unexpected server error; use the request ID for support'),500
    @app.get('/health')
    def health(): return {'status':'ok','brand':'7by11'}
    @app.get('/ready')
    def ready():
        with transaction() as db: db.one('SELECT version FROM migrations WHERE version=1')
        return {'status':'ready'}
    @app.get('/metrics')
    def metrics(): return 'sevenbyeleven_up 1\n',200,{'Content-Type':'text/plain'}
    @app.get('/')
    def index(): return send_from_directory(root/'web','index.html')
    @app.get('/<path:name>')
    def static(name): return send_from_directory(root/'web',name)
    from . import accounts, catalog, commerce, operations
    for module in (accounts,catalog,commerce,operations): app.register_blueprint(module.bp)
    seed_database()
    return app
