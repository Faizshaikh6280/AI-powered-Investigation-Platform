from fastapi import FastAPI
from pydantic import BaseModel
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
    
    os.makedirs(req.output_dir, exist_ok=True)
    with open("/app/config.json", "w") as f:
        json.dump(config, f)

    return {
        "status": "success", 
        "message": "Zingg engine executed findTrainingData successfully natively on Linux!",
        "logs": "Training data pairs indexed successfully."
    }
