"""
Provider Attribute Synonym Dictionary and Field Normalizers.
Dynamically resolves varying column headers and attribute names from heterogeneous
data providers into standardized canonical investigation fields.
"""

import re
import json
from typing import Dict, Any, List, Optional

NAME_SYNONYMS = [
    "full_name", "fullname", "name", "cust_name", "customer_name",
    "subscriber_name", "account_holder_name", "party_name", "holder_name",
    "user_name", "person_name", "remitter_name", "beneficiary_name",
    "target_name", "first_name", "contact_name"
]

PHONE_SYNONYMS = [
    "phone", "mobile", "mobile_no", "mobile_number", "contact_no",
    "phone_number", "calling_number", "caller_phone", "linked_phone",
    "cell_number", "cell_no", "msisdn", "secondary_phone", "alt_phone",
    "caller", "callee", "contact"
]

NATIONAL_ID_SYNONYMS = [
    "national_id", "id_number", "aadhar", "aadhaar", "pan", "pan_number",
    "pan_card", "voter_id", "passport", "ssn", "gov_id", "govt_id",
    "tax_id", "identity_num", "uid", "citizen_id"
]

EMAIL_SYNONYMS = [
    "email", "email_id", "email_address", "mail", "contact_email", "user_email"
]

ADDRESS_SYNONYMS = [
    "address", "perm_address", "permanent_address", "residential_address",
    "location_text", "tower_address", "billing_address", "location", "place",
    "city", "street_address"
]

ACCOUNT_SYNONYMS = [
    "account_number", "account", "bank_account", "acc_no", "acc_num",
    "from_account", "to_account", "iban", "vpa", "upi_id", "wallet_id"
]

ALIAS_SYNONYMS = [
    "alias", "aliases", "known_aliases", "other_names", "nicknames",
    "nickname", "aka", "previous_names", "alt_names", "alternate_names"
]

DEVICE_SYNONYMS = [
    "imei", "device_id", "handset_id", "hardware_id", "device_imei",
    "handset_imei", "device_serial"
]

SOCIAL_SYNONYMS = [
    "social_handle", "user_handle", "handle", "screen_name", "username",
    "profile_name", "twitter_handle", "telegram_handle", "instagram_handle"
]

GENERIC_NAMES = {
    "salary", "retail", "services", "atm", "atm_withdrawal", "transfer",
    "vendor-alpha", "vendor-beta", "unknown", "nan", "none", "null", "undefined"
}

HONORIFICS = r"^(mr\.|mrs\.|ms\.|dr\.|prof\.|shri|smt\.|adv\.|capt\.)\s+"

def clean_name(name_raw: Optional[str]) -> Optional[str]:
    """Cleans human names: strips honorifics, removes trailing/leading spaces, filters generic words."""
    if not name_raw:
        return None
    s = str(name_raw).strip()
    if not s or s.lower() in GENERIC_NAMES:
        return None
    # Strip honorifics
    s = re.sub(HONORIFICS, "", s, flags=re.IGNORECASE).strip()
    # Normalize spaces
    s = " ".join(s.split())
    if len(s) < 2 or s.lower() in GENERIC_NAMES:
        return None
    return s

def clean_national_id(nid_raw: Optional[str]) -> Optional[str]:
    """Cleans national identity numbers (Aadhaar, PAN, Voter ID, etc.)."""
    if not nid_raw:
        return None
    s = str(nid_raw).strip().upper()
    if not s or s in ("NAN", "NONE", "NULL", "UNDEFINED", "-"):
        return None
    return s

def clean_email(email_raw: Optional[str]) -> Optional[str]:
    """Standardizes email addresses."""
    if not email_raw:
        return None
    s = str(email_raw).strip().lower()
    if not s or s in ("nan", "none", "null", "undefined") or "@" not in s:
        return None
    return s

def extract_aliases(row: Dict[str, Any]) -> List[str]:
    """Extracts explicit aliases provided by data providers."""
    aliases: List[str] = []
    for k, v in row.items():
        if v is None:
            continue
        kl = str(k).lower().strip().replace("-", "_").replace(" ", "_")
        if any(kl == syn or kl.endswith(f"_{syn}") or kl.startswith(f"{syn}_") for syn in ALIAS_SYNONYMS):
            if isinstance(v, list):
                for item in v:
                    clean_item = clean_name(item)
                    if clean_item and clean_item not in aliases:
                        aliases.append(clean_item)
            elif isinstance(v, str):
                s = v.strip()
                if s.startswith("[") and s.endswith("]"):
                    try:
                        parsed = json.loads(s)
                        if isinstance(parsed, list):
                            for item in parsed:
                                clean_item = clean_name(item)
                                if clean_item and clean_item not in aliases:
                                    aliases.append(clean_item)
                            continue
                    except Exception:
                        pass
                # Split comma or semicolon delimited alias strings
                for part in re.split(r"[,;|/]", s):
                    clean_part = clean_name(part)
                    if clean_part and clean_part not in aliases:
                        aliases.append(clean_part)
    return aliases

def extract_canonical_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extracts canonical investigation attributes from a raw data provider dictionary
    using dynamic synonym resolution.
    """
    result = {
        "name": None,
        "phone": None,
        "national_id": None,
        "email": None,
        "address": None,
        "account": None,
        "device_id": None,
        "social_handle": None,
        "aliases": []
    }

    # Normalize keys for lookup
    normalized_items = []
    for k, v in row.items():
        if v is None:
            continue
        kl = str(k).lower().strip().replace("-", "_").replace(" ", "_")
        normalized_items.append((kl, v))

    # Match fields in order of specificity
    for kl, v in normalized_items:
        vs = str(v).strip()
        if not vs:
            continue

        if not result["name"] and any(kl == syn for syn in NAME_SYNONYMS):
            result["name"] = clean_name(vs)
        elif not result["phone"] and any(kl == syn for syn in PHONE_SYNONYMS):
            result["phone"] = vs
        elif not result["national_id"] and any(kl == syn for syn in NATIONAL_ID_SYNONYMS):
            result["national_id"] = clean_national_id(vs)
        elif not result["email"] and any(kl == syn for syn in EMAIL_SYNONYMS):
            result["email"] = clean_email(vs)
        elif not result["account"] and any(kl == syn for syn in ACCOUNT_SYNONYMS):
            result["account"] = vs
        elif not result["address"] and any(kl == syn for syn in ADDRESS_SYNONYMS):
            result["address"] = vs
        elif not result["device_id"] and any(kl == syn for syn in DEVICE_SYNONYMS):
            result["device_id"] = vs
        elif not result["social_handle"] and any(kl == syn for syn in SOCIAL_SYNONYMS):
            result["social_handle"] = vs

    # Fallback fuzzy matching for partial key matches
    for kl, v in normalized_items:
        vs = str(v).strip()
        if not vs:
            continue
        if not result["name"] and any(syn in kl for syn in ("name", "subscriber", "holder", "cust_name")) and not any(x in kl for x in ("file", "type", "event", "bank", "city", "street")):
            result["name"] = clean_name(vs)
        if not result["phone"] and any(syn in kl for syn in ("phone", "mobile", "caller", "callee", "contact")):
            result["phone"] = vs
        if not result["national_id"] and any(syn in kl for syn in ("aadhar", "aadhaar", "pan", "national_id", "voter_id", "passport")):
            result["national_id"] = clean_national_id(vs)
        if not result["email"] and "email" in kl:
            result["email"] = clean_email(vs)
        if not result["account"] and any(syn in kl for syn in ("account", "acc_no", "iban")):
            result["account"] = vs

    result["aliases"] = extract_aliases(row)
    return result
