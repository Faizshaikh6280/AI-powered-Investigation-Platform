import pandas as pd
import re
from datetime import datetime
import os
from typing import List
from app.schemas.normalized_schemas import NormalizedEvent, NormalizedIdentity, Telemetry, Financial
from app.core.db import db_client

def clean_phone(phone: str) -> str | None:
    if pd.isna(phone): return None
    s = str(phone).strip().replace(" ", "").replace("-", "")
    if not s.startswith("+"):
        if s.startswith("91") and len(s) == 12: s = "+" + s
        else: s = "+91" + s
    return s

def clean_date(ts: str) -> str | None:
    if pd.isna(ts): return None
    clean = str(ts).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y-%m-%d %H:%M"):
        try:
            dt = datetime.strptime(clean[:19], fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass
    return clean

async def process_file(file_path: str, domain: str):
    basename = os.path.basename(file_path)
    records = []
    
    for df_chunk in pd.read_csv(file_path, chunksize=1000):
        for _, row in df_chunk.iterrows():
            identity = NormalizedIdentity()
            telemetry = Telemetry()
            financial = Financial()
            event_type = "UNKNOWN"
            timestamp = None
            
            # Domain specific mapping based on requested schemas
            if domain == "BANKING":
                identity.name = str(row.get("account_holder_name", ""))
                identity.phone = clean_phone(row.get("linked_phone"))
                financial.account_number = str(row.get("account_number", ""))
                financial.amount_inr = float(row.get("amount_inr", 0.0))
                financial.txn_type = str(row.get("txn_type", ""))
                financial.counterparty = str(row.get("counterparty_identifier", ""))
                timestamp = clean_date(row.get("timestamp"))
                event_type = "TRANSACTION"
                
            elif domain == "TELECOM":
                identity.name = str(row.get("caller_subscriber_name", ""))
                identity.phone = clean_phone(row.get("calling_number"))
                telemetry.imei = str(row.get("imei", ""))
                telemetry.cell_tower_id = str(row.get("cell_tower_id", ""))
                telemetry.lat = float(row.get("tower_lat")) if pd.notnull(row.get("tower_lat")) else None
                telemetry.lng = float(row.get("tower_lng")) if pd.notnull(row.get("tower_lng")) else None
                telemetry.address = str(row.get("tower_address", ""))
                timestamp = clean_date(row.get("start_time"))
                event_type = "PHONE_CALL"
                
            elif domain == "NETWORK":
                identity.name = str(row.get("subscriber_name", ""))
                identity.phone = clean_phone(row.get("phone_number"))
                telemetry.assigned_ip = str(row.get("assigned_ip", ""))
                telemetry.destination_ip = str(row.get("destination_ip", ""))
                telemetry.cell_tower_id = str(row.get("cell_tower_id", ""))
                telemetry.lat = float(row.get("tower_lat")) if pd.notnull(row.get("tower_lat")) else None
                telemetry.lng = float(row.get("tower_lng")) if pd.notnull(row.get("tower_lng")) else None
                timestamp = clean_date(row.get("start_time"))
                event_type = "DATA_SESSION"
                
            elif domain == "SOCIAL":
                identity.social_handle = str(row.get("user_handle", ""))
                identity.social_platform = str(row.get("platform", ""))
                identity.phone = clean_phone(row.get("registered_phone"))
                telemetry.assigned_ip = str(row.get("client_ip", ""))
                timestamp = clean_date(row.get("timestamp"))
                event_type = "SOCIAL_LOGIN"
                
            elif domain == "KYC":
                identity.name = str(row.get("full_name", ""))
                identity.phone = clean_phone(row.get("phone"))
                identity.email = str(row.get("email", ""))
                identity.national_id = str(row.get("national_id", ""))
                telemetry.address = str(row.get("address", ""))
                timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
                event_type = "KYC_PROFILE"

            event = NormalizedEvent(
                source_file=basename,
                domain=domain,
                event_type=event_type,
                timestamp=timestamp or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                normalized_identity=identity,
                telemetry=telemetry,
                financial=financial
            )
            records.append(event.model_dump())
            
        if records:
            await db_client.events_col.insert_many(records)
            records = []

    return {"status": "success", "file": basename, "domain": domain}
