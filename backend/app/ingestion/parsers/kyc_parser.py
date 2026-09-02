import io
import csv
import json
import datetime
from typing import List, Dict, Any
from app.schemas.canonical_event import (
    CanonicalEvent, CanonicalEntities, CanonicalTelemetry, CanonicalFinancial, EventProvenance
)
from app.ingestion.parsers.base import BaseParser

class KYCParser(BaseParser):
    """Parser adapter for KYC profiles, identity registries, and official record documents."""

    parser_version = "v1.0.0"

    def can_parse(self, detected_type: str, filename: str) -> bool:
        return detected_type == "KYC"

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
                rows = data if isinstance(data, list) else data.get("profiles", data.get("records", []))
            except Exception:
                pass
        else:
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)

        current_time = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        for idx, row in enumerate(rows, start=1):
            phone = self.clean_phone(row.get("phone") or row.get("mobile"))
            name = row.get("full_name") or row.get("name")
            national_id = str(row.get("national_id") or row.get("aadhar") or row.get("id_number") or "").strip()
            email = str(row.get("email")).strip() if row.get("email") else None
            address = str(row.get("address")).strip() if row.get("address") else None

            entities = CanonicalEntities(
                name=name,
                phone=phone,
                national_id=national_id if national_id else None,
                email=email
            )

            telemetry = CanonicalTelemetry(
                address=address
            )

            financial = CanonicalFinancial()

            attributes = {
                "record_id": row.get("record_id", f"KYC-{idx}"),
                "data_source": row.get("data_source", "KYC"),
                "occupation": row.get("occupation")
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
                event_type="IDENTITY_RECORD",
                source_type="KYC",
                timestamp=current_time,
                entities=entities,
                telemetry=telemetry,
                financial=financial,
                attributes=attributes,
                provenance=provenance
            ))

        return events
