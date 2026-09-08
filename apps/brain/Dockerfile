# The compute service.
#
# Note what is not installed: no database driver, no Redis client. The brain is
# stateless by design (ADR-0006), and the absence here is what enforces it.

FROM python:3.12-slim

WORKDIR /app

# Dependencies first, so a source change does not reinstall scipy.
COPY apps/brain/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/brain/app ./app

# Non-root, because there is no reason for this process to be root.
RUN useradd --create-home --shell /bin/false brain && chown -R brain:brain /app
USER brain

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
