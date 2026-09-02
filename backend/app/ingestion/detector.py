import os
import io
import re
import json
import csv
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

class SourceDetectionResult(BaseModel):
    detected_type: str            # TELECOM, BANKING, NETWORK, SOCIAL, KYC, UNKNOWN
    confidence: float             # 0.0 to 1.0
    reasons: List[str]            # Explainable human-readable reasons
    detector_version: str = "v1.0.0"
    matched_signatures: List[str]
    ambiguity_state: bool = False
    needs_review: bool = False

class AutomaticSourceDetector:
    """
    Deterministic, explainable rule-based evidence classifier.
    Examines file extensions, tabular headers, JSON structures, and value patterns
    to identify the evidence domain without human labeling.
    """

    # Domain characteristic column/key sets
    SIGNATURES = {
        "TELECOM": {
            "primary": {"calling_number", "called_number", "caller", "callee", "phone_number"},
            "secondary": {"imei", "cell_tower_id", "duration_seconds", "call_type", "tower_lat", "tower_lng", "call_id"},
            "weights": {"calling_number": 0.35, "called_number": 0.35, "imei": 0.15, "cell_tower_id": 0.15}
        },
        "NETWORK": {
            "primary": {"assigned_ip", "destination_ip", "client_ip", "dest_ip"},
            "secondary": {"service_port", "bytes_transferred", "session_id", "duration_sec", "ipdr"},
            "weights": {"assigned_ip": 0.40, "destination_ip": 0.40, "service_port": 0.10, "bytes_transferred": 0.10}
        },
        "BANKING": {
            "primary": {"account_number", "account_holder_name", "amount_inr", "amount"},
            "secondary": {"txn_type", "txn_id", "counterparty_identifier", "channel", "narration", "balance", "credit", "debit"},
            "weights": {"account_number": 0.35, "amount_inr": 0.35, "txn_type": 0.15, "counterparty_identifier": 0.15}
        },
        "SOCIAL": {
            "primary": {"user_handle", "platform", "registered_phone"},
            "secondary": {"client_ip", "device_id", "action", "log_id", "story_post", "send_msg"},
            "weights": {"user_handle": 0.40, "platform": 0.30, "registered_phone": 0.30}
        },
        "KYC": {
            "primary": {"national_id", "full_name", "aadhar", "ssn", "passport"},
            "secondary": {"occupation", "address", "phone", "email", "record_id", "data_source"},
            "weights": {"national_id": 0.40, "full_name": 0.30, "address": 0.15, "occupation": 0.15}
        }
    }

    @staticmethod
    def normalize_header(header: str) -> str:
        """Sanitize and standardize column names (e.g. 'Calling Number' -> 'calling_number')."""
        h = header.strip().lower()
        h = re.sub(r'[^a-z0-9_]', '_', h)
        h = re.sub(r'_+', '_', h)
        return h.strip('_')

    def extract_headers_from_csv(self, content_bytes: bytes) -> List[str]:
        """Extract first line column headers from CSV content."""
        try:
            text = content_bytes.decode('utf-8', errors='ignore')
            reader = csv.reader(io.StringIO(text))
            for row in reader:
                if row:
                    return [self.normalize_header(c) for c in row if c.strip()]
        except Exception:
            pass
        return []

    def extract_keys_from_json(self, content_bytes: bytes) -> List[str]:
        """Extract root or item keys from JSON content."""
        try:
            data = json.loads(content_bytes.decode('utf-8', errors='ignore'))
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                return [self.normalize_header(k) for k in data[0].keys()]
            elif isinstance(data, dict):
                # If wrapped in a list key e.g. {"records": [...]}
                for v in data.values():
                    if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                        return [self.normalize_header(k) for k in v[0].keys()]
                return [self.normalize_header(k) for k in data.keys()]
        except Exception:
            pass
        return []

    def extract_text_from_pdf(self, content_bytes: bytes) -> str:
        """Extract preliminary text from PDF bytes."""
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            if len(reader.pages) > 0:
                return reader.pages[0].extract_text().lower()
        except Exception:
            # Fallback regex search on raw bytes
            return content_bytes[:4096].decode('latin-1', errors='ignore').lower()
        return ""

    def detect(self, filename: str, content_bytes: bytes) -> SourceDetectionResult:
        """
        Analyze evidence bytes and filename to determine the source domain.
        Returns explainable score, matched signatures, and review flags.
        """
        ext = os.path.splitext(filename)[1].lower()
        headers: List[str] = []
        pdf_text = ""

        if ext in (".csv", ".txt", ".tsv"):
            headers = self.extract_headers_from_csv(content_bytes)
        elif ext == ".json":
            headers = self.extract_keys_from_json(content_bytes)
        elif ext in (".xlsx", ".xls"):
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(content_bytes), read_only=True)
                ws = wb.active
                for row in ws.iter_rows(values_only=True):
                    if row:
                        headers = [self.normalize_header(str(c)) for c in row if c is not None]
                        break
            except Exception:
                pass
        elif ext == ".pdf":
            pdf_text = self.extract_text_from_pdf(content_bytes)

        # Score candidate domains
        scores: Dict[str, float] = {}
        matched_sigs: Dict[str, List[str]] = {}
        reasons_map: Dict[str, List[str]] = {}

        header_set = set(headers)

        for domain, sig in self.SIGNATURES.items():
            domain_score = 0.0
            matches = []
            reasons = []

            # Check primary signatures
            for col, weight in sig["weights"].items():
                if col in header_set:
                    domain_score += weight
                    matches.append(col)
                    reasons.append(f"Matched high-confidence column '{col}'")

            # Check secondary signatures
            for col in sig["secondary"]:
                if col in header_set and col not in matches:
                    domain_score += 0.10
                    matches.append(col)
                    reasons.append(f"Matched supporting column '{col}'")

            # Check PDF text if applicable
            if pdf_text:
                if domain == "BANKING" and any(k in pdf_text for k in ("statement", "account", "balance", "debit", "credit", "transaction", "rtgs", "ifsc")):
                    domain_score += 0.75
                    matches.append("banking_pdf_text_keywords")
                    reasons.append("Matched bank statement PDF keywords")
                elif domain == "TELECOM" and any(k in pdf_text for k in ("call details", "cdr", "imei", "cell tower", "duration")):
                    domain_score += 0.70
                    matches.append("cdr_pdf_text_keywords")
                    reasons.append("Matched CDR document keywords")

            scores[domain] = min(domain_score, 1.0)
            matched_sigs[domain] = matches
            reasons_map[domain] = reasons

        # Determine winner
        best_domain = "UNKNOWN"
        best_score = 0.0
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        if sorted_scores and sorted_scores[0][1] >= 0.35:
            best_domain = sorted_scores[0][0]
            best_score = sorted_scores[0][1]

        # Check for ambiguity (e.g. top two scores close)
        is_ambiguous = False
        if len(sorted_scores) > 1 and sorted_scores[0][1] > 0.4:
            if (sorted_scores[0][1] - sorted_scores[1][1]) < 0.15:
                is_ambiguous = True

        needs_review = (best_score < 0.60) or is_ambiguous or (best_domain == "UNKNOWN")

        return SourceDetectionResult(
            detected_type=best_domain,
            confidence=round(best_score, 2),
            reasons=reasons_map.get(best_domain, [f"Insufficient signatures detected in {filename}"]),
            matched_signatures=matched_sigs.get(best_domain, []),
            ambiguity_state=is_ambiguous,
            needs_review=needs_review
        )

# Singleton instance
source_detector = AutomaticSourceDetector()
