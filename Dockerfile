FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home sevenbyeleven
COPY app ./app
COPY web ./web
COPY run.py .
COPY scripts ./scripts
USER 10001
EXPOSE 3000
CMD ["gunicorn", "--bind", "0.0.0.0:3000", "--workers", "2", "--threads", "4", "--timeout", "30", "--access-logfile", "-", "run:app"]
