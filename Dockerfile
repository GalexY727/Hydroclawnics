FROM node:22-slim AS frontend
WORKDIR /app/hydroclawnics/frontend
COPY hydroclawnics/frontend/package*.json ./
RUN npm ci
COPY hydroclawnics/frontend ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    LLM_PROVIDER=none \
    DEMO_MODE=true \
    DEMO_AUTOSTART_AGENTS=true \
    BACKEND_URL=http://localhost:8000
COPY hydroclawnics/requirements.txt /app/hydroclawnics/requirements.txt
RUN pip install --no-cache-dir -r /app/hydroclawnics/requirements.txt
COPY hydroclawnics /app/hydroclawnics
COPY --from=frontend /app/hydroclawnics/frontend/dist /app/hydroclawnics/frontend/dist
EXPOSE 8000
CMD ["uvicorn", "hydroclawnics.main:app", "--host", "0.0.0.0", "--port", "8000"]
