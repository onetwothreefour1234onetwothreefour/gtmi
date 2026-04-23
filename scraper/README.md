# GTMI Scraper Service

FastAPI + Playwright scraping microservice. Replaces Firecrawl for all URL scraping.

## Local development

    pip install -r requirements.txt
    playwright install chromium
    uvicorn main:app --host 0.0.0.0 --port 8765

## Cloud deployment (Google Cloud Run)

### One-time project setup

Replace `YOUR_PROJECT_ID` and (optionally) the region below.

    gcloud auth login
    gcloud config set project YOUR_PROJECT_ID

    # Enable required APIs
    gcloud services enable \
      run.googleapis.com \
      cloudbuild.googleapis.com \
      artifactregistry.googleapis.com

    # Create Artifact Registry repo (region: europe-west1 by default — change if needed)
    gcloud artifacts repositories create gtmi \
      --repository-format=docker \
      --location=europe-west1 \
      --description="GTMI container images"

### Deploy (one command)

From the `scraper/` directory:

    cd scraper
    gcloud builds submit --config cloudbuild.yaml

Cloud Build will:

1. Build the Docker image with Playwright + Chromium baked in.
2. Push it to Artifact Registry at `europe-west1-docker.pkg.dev/YOUR_PROJECT_ID/gtmi/gtmi-scraper`.
3. Deploy it to Cloud Run as service `gtmi-scraper` in `europe-west1`.

The final `gcloud run deploy` line will print a URL like:

    https://gtmi-scraper-abc123-ew.a.run.app

Set that URL as `SCRAPER_URL` in:

- `.env` for local runs
- Trigger.dev environment variables for cloud runs

### Deployment parameters (in `cloudbuild.yaml`)

- **Memory:** 2 GB (Playwright browser is heavy)
- **CPU:** 2 vCPU
- **Concurrency:** 4 (max parallel scrapes per container; a 5th triggers a new instance)
- **Min instances:** 0 (scales to zero — no cost when idle)
- **Max instances:** 3 (caps runaway cost)
- **Request timeout:** 120 s (scrape itself has a 30 s internal timeout)
- **Access:** `--allow-unauthenticated` (public). For internal-only use, remove that flag and authenticate via a service account instead.

First request after idle cold-starts the container (~15-25 s for the Playwright image). Subsequent requests are fast while instances are warm (~10 min idle timeout).

## Endpoints

- `GET /health` → `{"status":"ok"}`
- `POST /scrape` → `{ "url": "https://...", "only_main_content": true }`
