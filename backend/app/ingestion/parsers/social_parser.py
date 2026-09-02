import io
import csv
import json
from typing import List, Dict, Any
from app.schemas.canonical_event import (
    CanonicalEvent, CanonicalEntities, CanonicalTelemetry, CanonicalFinancial, EventProvenance
)
from app.ingestion.parsers.base import BaseParser

class SocialParser(BaseParser):
    """Parser adapter for Social Media activity and session logs (Telegram, WhatsApp, Instagram)."""

    parser_version = "v1.0.0"

    def can_parse(self, detected_type: str, filename: str) -> bool:
        return detected_type == "SOCIAL"

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
                rows = data if isinstance(data, list) else data.get("logs", data.get("records", []))
            except Exception:
                pass
        else:
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)

        for idx, row in enumerate(rows, start=1):
            phone = self.clean_phone(row.get("registered_phone") or row.get("phone"))
            timestamp = self.clean_date(row.get("timestamp") or row.get("created_at") or row.get("date"))

            entities = CanonicalEntities(
                social_handle=str(row.get("user_handle") or row.get("handle") or "").strip(),
                social_platform=str(row.get("platform") or "SocialMedia").strip(),
                phone=phone
            )

            telemetry = CanonicalTelemetry(
                assigned_ip=str(row.get("client_ip") or row.get("ip")).strip() if row.get("client_ip") or row.get("ip") else None
            )

            financial = CanonicalFinancial()

            attributes = {
                "log_id": row.get("log_id", f"SOC-{idx}"),
                "action": row.get("action", "ACTIVITY"),
                "device_id": row.get("device_id")
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
                event_type="SOCIAL_ACTIVITY",
                source_type="SOCIAL",
                timestamp=timestamp,
                entities=entities,
                telemetry=telemetry,
                financial=financial,
                attributes=attributes,
                provenance=provenance
            ))

        return events
