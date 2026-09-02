FROM python:3.10-slim-bullseye

# Install Java 11 (required for PySpark and Zingg) and procps
RUN apt-get update && \
    apt-get install -y openjdk-11-jre-headless procps && \
    rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip install --no-deps --no-cache-dir zingg==0.4.0

# Create dummy license file for Zingg 0.4.0 bypass
RUN echo "dummy" > zinggLicense.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

