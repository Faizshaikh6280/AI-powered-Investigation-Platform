import io
import csv
import json
from typing import List, Dict, Any
from app.schemas.canonical_event import (
    CanonicalEvent, CanonicalEntities, CanonicalTelemetry, CanonicalFinancial, EventProvenance
)
from app.ingestion.parsers.base import BaseParser

class IPDRParser(BaseParser):
    """Parser adapter for IP Detail Records (IPDR) and network session logs."""

    parser_version = "v1.0.0"

    def can_parse(self, detected_type: str, filename: str) -> bool:
        return detected_type == "NETWORK"

    def parse(
        self,
        content_bytes: bytes,
        case_id: str,
        evidence_id: str,
        filename: str,
        evidence_sha256: str
    ) -> List[CanonicalEvent]:
        events: List[CanonicalEvent] = []
        text = content_bytes.decode('utf-8', errors='ignore')

        rows: List[Dict[str, Any]] = []
        if filename.lower().endswith(".json"):
            try:
                data = json.loads(text)
                rows = data if isinstance(data, list) else data.get("records", [])
            except Exception:
                pass
        else:
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)

        for idx, row in enumerate(rows, start=1):
            phone = self.clean_phone(row.get("phone_number") or row.get("calling_number") or row.get("phone"))
            timestamp = self.clean_date(row.get("start_time") or row.get("timestamp") or row.get("session_start"))

            lat = self.parse_float(row.get("tower_lat") or row.get("lat"))
            lng = self.parse_float(row.get("tower_lng") or row.get("lng"))
            port = int(self.parse_float(row.get("service_port") or row.get("port"), 443.0))
            bytes_tf = int(self.parse_float(row.get("bytes_transferred") or row.get("bytes"), 0.0))
            duration = int(self.parse_float(row.get("duration_sec") or row.get("duration"), 0.0))

            entities = CanonicalEntities(
                name=row.get("subscriber_name") or row.get("user"),
                phone=phone
            )

            telemetry = CanonicalTelemetry(
                assigned_ip=str(row.get("assigned_ip")).strip() if row.get("assigned_ip") else None,
                destination_ip=str(row.get("destination_ip")).strip() if row.get("destination_ip") else None,
                service_port=port,
                bytes_transferred=bytes_tf,
                duration_seconds=duration,
                cell_tower_id=str(row.get("cell_tower_id")).strip() if row.get("cell_tower_id") else None,
                lat=lat if lat != 0.0 else None,
                lng=lng if lng != 0.0 else None,
                address=row.get("tower_address") or row.get("address")
            )

            financial = CanonicalFinancial()

            attributes = {
                "session_id": row.get("session_id", f"IPDR-{idx}")
            }

            provenance = EventProvenance(
                case_id=case_id,
                evidence_id=evidence_id,
                source_file=filename,
                row_index=idx,
                evidence_sha256=evidence_sha256,
                parser_version=self.parser_version
            )

            events.append(CanonicalEvent(
                case_id=case_id,
                evidence_id=evidence_id,
                event_type="IP_SESSION",
                source_type="NETWORK",
                timestamp=timestamp,
                entities=entities,
                telemetry=telemetry,
                financial=financial,
                attributes=attributes,
                provenance=provenance
            ))

        return events
