FROM python:3.11-slim

WORKDIR /app

RUN pip install fastapi uvicorn anthropic python-dotenv pydantic

COPY . .

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
