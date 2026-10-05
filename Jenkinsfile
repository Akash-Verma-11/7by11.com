pipeline {
  agent any
  environment { COMPOSE_PROJECT_NAME = "sevenbyeleven-ci-${BUILD_NUMBER}" }
  options { timestamps(); disableConcurrentBuilds() }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Test') { steps { sh 'python3 -m venv .venv'; sh '.venv/bin/pip install -r requirements-dev.txt'; sh 'unset DATABASE_URL; .venv/bin/python -m pytest -q'; sh 'node --check web/app.js' } }
    stage('Build') { steps { sh 'docker build -t sevenbyeleven:local .' } }
    stage('Smoke') { steps { sh 'python3 scripts/init-env.py'; sh 'docker compose up -d --wait --wait-timeout 180'; sh 'python3 scripts/smoke.py' } }
    stage('Scan') { steps { sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed sevenbyeleven:local' } }
  }
  post { always { sh 'docker compose down -v || true' } }
}
