"""Automated ingestion script to register SismoWatch PostgreSQL metadata in OpenMetadata."""

import base64
import json
import subprocess
import urllib.request

OM_SERVER = "http://localhost:8585"

def run():
    print("1. Authenticating with OpenMetadata Server...")
    encoded_pw = base64.b64encode(b"admin").decode()
    req = urllib.request.Request(
        f"{OM_SERVER}/api/v1/users/login",
        data=json.dumps({"email": "admin@open-metadata.org", "password": encoded_pw}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        token = data["accessToken"]
    print("✓ Successfully authenticated! Token acquired.")

    # Create ingestion workflow config
    config_yaml = f"""source:
  type: postgres
  serviceName: sismowatch_postgres
  serviceConnection:
    config:
      type: Postgres
      username: postgres
      authType:
        password: admin123
      hostPort: sismowatch-postgres:5432
      database: sismowatch
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        includes:
          - bronze.*
          - silver.*
          - gold.*
      includeTables: true
      includeViews: true

sink:
  type: metadata-rest
  config: {{}}

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://openmetadata-server:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{token}"
"""

    with open("openmetadata/postgres_sismowatch.yaml", "w") as f:
        f.write(config_yaml)

    print("2. Copying workflow to openmetadata_ingestion container...")
    subprocess.run(["docker", "cp", "openmetadata/postgres_sismowatch.yaml", "openmetadata_ingestion:/tmp/postgres_sismowatch.yaml"], check=True)

    print("3. Executing metadata ingestion in OpenMetadata...")
    res = subprocess.run([
        "docker", "exec", "openmetadata_ingestion",
        "metadata", "ingest", "-c", "/tmp/postgres_sismowatch.yaml"
    ], capture_output=True, text=True)

    print("OUTPUT:")
    print(res.stdout[-1500:] if len(res.stdout) > 1500 else res.stdout)
    if res.stderr:
        print("ERRORS / WARNINGS:")
        print(res.stderr[-500:] if len(res.stderr) > 500 else res.stderr)

    if res.returncode == 0:
        print("\n=======================================================")
        print("✓ SUCCESS: SismoWatch metadata ingested into OpenMetadata!")
        print("=======================================================")
    else:
        print(f"Ingestion exited with code {res.returncode}")

if __name__ == "__main__":
    run()
