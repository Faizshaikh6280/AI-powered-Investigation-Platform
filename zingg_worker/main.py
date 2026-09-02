from fastapi import FastAPI
from pydantic import BaseModel
import subprocess
import os
import json

app = FastAPI()

class ExecuteRequest(BaseModel):
    data_path: str
    output_dir: str

@app.post("/execute")
def execute_zingg(req: ExecuteRequest):
    # Construct config
    config = {
        "fieldDefinition": [
            { "fieldName": "record_id", "matchType": "DONT_USE", "dataType": "string" },
            { "fieldName": "full_name", "matchType": "FUZZY", "dataType": "string" },
            { "fieldName": "phone", "matchType": "EXACT", "dataType": "string" },
            { "fieldName": "national_id", "matchType": "EXACT", "dataType": "string" },
            { "fieldName": "email", "matchType": "EXACT", "dataType": "string" },
            { "fieldName": "address", "matchType": "FUZZY", "dataType": "string" }
        ],
        "data": [
            {
                "name": "unified_evidence",
                "format": "csv",
                "props": { "path": req.data_path, "header": "true" }
            }
        ],
        "modelId": "cyber_intel_model",
        "zinggDir": req.output_dir
    }
    
    with open("/app/config.json", "w") as f:
        json.dump(config, f)

    zingg_jar = "/usr/local/lib/python3.10/site-packages/zingg/jars/zingg-0.4.0.jar"
    
    # Run Zingg phase
    cmd = [
        "spark-submit",
        "--class", "zingg.spark.client.SparkClient",
        zingg_jar,
        "--phase", "findTrainingData",
        "--conf", "/app/config.json",
        "--license", "/app/zinggLicense.txt"
    ]
    
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            return {"status": "error", "message": "Zingg Failed", "logs": res.stderr}
            
        return {
            "status": "success", 
            "message": "Real Zingg engine executed findTrainingData successfully natively on Linux!",
            "logs": res.stdout[:500]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
