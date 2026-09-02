import io
import csv
import json
import re
from typing import List, Dict, Any
from app.schemas.canonical_event import (
    CanonicalEvent, CanonicalEntities, CanonicalTelemetry, CanonicalFinancial, EventProvenance
)
from app.ingestion.parsers.base import BaseParser

class BankingParser(BaseParser):
    """Parser adapter for Banking statements, UPI logs, and financial transaction sheets."""

    parser_version = "v1.0.0"

    def can_parse(self, detected_type: str, filename: str) -> bool:
        return detected_type == "BANKING"

    def _parse_pdf_transactions(self, content_bytes: bytes) -> List[Dict[str, Any]]:
        """Extract structured transaction records from tabular/text bank statement PDFs."""
        rows = []
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            full_text = "\n".join([page.extract_text() or "" for page in reader.pages])
            
            # Simple tabular regex scanner for date, narration, amount
            lines = full_text.splitlines()
            for idx, line in enumerate(lines):
                # Look for lines containing numbers that look like currency amounts and dates
                match = re.search(r'(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})\s+(.+?)\s+([0-9,]+(?:\.\d{2})?)', line)
                if match:
                    date_str, desc, amount_str = match.groups()
                    rows.append({
                        "txn_id": f"PDF-TXN-{idx}",
                        "timestamp": date_str,
                        "narration": desc.strip(),
                        "amount_inr": amount_str.replace(",", ""),
                        "txn_type": "DEBIT" if "debit" in line.lower() or "dr" in line.lower() else "CREDIT",
                        "account_number": "ACC_EXTRACTED_PDF"
                    })
        except Exception:
            pass
        return rows

    def parse(
        self,
        content_bytes: bytes,
        case_id: str,
        evidence_id: str,
        filename: str,
        evidence_sha256: str
    ) -> List[CanonicalEvent]:
        events: List[CanonicalEvent] = []
        ext = filename.lower()

        rows: List[Dict[str, Any]] = []

        if ext.endswith(".pdf"):
            rows = self._parse_pdf_transactions(content_bytes)
        elif ext.endswith(".json"):
            try:
                data = json.loads(content_bytes.decode('utf-8', errors='ignore'))
                rows = data if isinstance(data, list) else data.get("transactions", data.get("records", []))
            except Exception:
                pass
        elif ext.endswith((".xlsx", ".xls")):
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True)
                ws = wb.active
                headers = []
                for i, row in enumerate(ws.iter_rows(values_only=True)):
                    if i == 0:
                        headers = [str(c).strip().lower() if c is not None else f"col_{j}" for j, c in enumerate(row)]
                    elif any(c is not None for c in row):
                        rows.append(dict(zip(headers, row)))
            except Exception:
                pass
        else:
            text = content_bytes.decode('utf-8', errors='ignore')
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)

        for idx, row in enumerate(rows, start=1):
            phone = self.clean_phone(row.get("linked_phone") or row.get("phone"))
            timestamp = self.clean_date(row.get("timestamp") or row.get("txn_date") or row.get("date"))
            amount = self.parse_float(row.get("amount_inr") or row.get("amount") or row.get("transaction_amount"))
            acc_num = str(row.get("account_number") or row.get("account") or "").strip()
            counterparty = str(row.get("counterparty_identifier") or row.get("counterparty") or row.get("to_account") or "").strip()

            entities = CanonicalEntities(
                name=row.get("account_holder_name") or row.get("name"),
                phone=phone
            )

            telemetry = CanonicalTelemetry()

            financial = CanonicalFinancial(
                account_number=acc_num if acc_num else None,
                amount_inr=amount,
                txn_type=str(row.get("txn_type", "TRANSFER")).upper(),
                channel=row.get("channel", "TRANSFER"),
                counterparty=counterparty if counterparty else None,
                narration=row.get("narration") or row.get("description")
            )

            attributes = {
                "txn_id": row.get("txn_id", f"TXN-{idx}")
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
                event_type="TRANSACTION",
                source_type="BANKING",
                timestamp=timestamp,
                entities=entities,
                telemetry=telemetry,
                financial=financial,
                attributes=attributes,
                provenance=provenance
            ))

        return events
