import io
import csv
import json
from typing import List, Dict, Any
from app.schemas.canonical_event import (
    CanonicalEvent, CanonicalEntities, CanonicalTelemetry, CanonicalFinancial, EventProvenance
)
from app.ingestion.parsers.base import BaseParser

class CDRParser(BaseParser):
    """Parser adapter for Telecom Call Detail Records (CDR)."""

    parser_version = "v1.0.0"

    def can_parse(self, detected_type: str, filename: str) -> bool:
        return detected_type == "TELECOM"

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

        # Attempt JSON or CSV parse
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
            calling_phone = self.clean_phone(row.get("calling_number") or row.get("caller") or row.get("phone_number"))
            called_phone = self.clean_phone(row.get("called_number") or row.get("callee"))
            timestamp = self.clean_date(row.get("start_time") or row.get("timestamp") or row.get("date_time"))

            lat = self.parse_float(row.get("tower_lat") or row.get("lat"))
            lng = self.parse_float(row.get("tower_lng") or row.get("lng"))
            duration = int(self.parse_float(row.get("duration_seconds") or row.get("duration"), 0.0))

            entities = CanonicalEntities(
                name=row.get("caller_subscriber_name") or row.get("subscriber_name"),
                phone=calling_phone,
                counterparty_name=row.get("called_subscriber_name")
            )

            telemetry = CanonicalTelemetry(
                imei=str(row.get("imei")).strip() if row.get("imei") else None,
                cell_tower_id=str(row.get("cell_tower_id")).strip() if row.get("cell_tower_id") else None,
                lat=lat if lat != 0.0 else None,
                lng=lng if lng != 0.0 else None,
                address=row.get("tower_address") or row.get("address"),
                duration_seconds=duration
            )

            financial = CanonicalFinancial()

            # Store extra fields in attributes
            attributes = {
                "called_number": called_phone,
                "call_type": row.get("call_type", "VOICE_OUT"),
                "call_id": row.get("call_id", f"CDR-{idx}")
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
                event_type="CALL",
                source_type="TELECOM",
                timestamp=timestamp,
                entities=entities,
                telemetry=telemetry,
                financial=financial,
                attributes=attributes,
                provenance=provenance
            ))

        return events
