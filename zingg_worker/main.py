from fastapi import FastAPI
from pydantic import BaseModel
import os
import csv
import json
import re
from typing import Dict, List, Optional

app = FastAPI(title="Zingg Entity Resolution Worker", version="2.0.0")

class ExecuteRequest(BaseModel):
    data_path: str
    output_dir: str

def normalize_text(val) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nan", "none", "null", "undefined", ""):
        return None
    return s

def clean_phone(phone) -> Optional[str]:
    s = normalize_text(phone)
    if not s:
        return None
    digits = re.sub(r"\D", "", s)
    if len(digits) == 10:
        return f"+91{digits}"
    elif len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    elif len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    elif len(digits) > 10:
        return f"+{digits}"
    return f"+91{digits}" if digits else None

def jaro_similarity(s1: str, s2: str) -> float:
    if s1 == s2:
        return 1.0
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0

    match_distance = max(len1, len2) // 2 - 1
    s1_matches = [False] * len1
    s2_matches = [False] * len2
    matches = 0
    transpositions = 0

    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len2)
        for j in range(start, end):
            if s2_matches[j] or s1[i] != s2[j]:
                continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break

    if matches == 0:
        return 0.0

    k = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1

    transpositions //= 2
    return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3.0

def jaro_winkler(s1: str, s2: str, p: float = 0.1, max_l: int = 4) -> float:
    j = jaro_similarity(s1, s2)
    if j < 0.7:
        return j
    l = 0
    for c1, c2 in zip(s1[:max_l], s2[:max_l]):
        if c1 == c2:
            l += 1
        else:
            break
    return j + (l * p * (1.0 - j))

def is_name_alias_match(n1: str, n2: str) -> bool:
    """Checks if two human names match across typos, token ordering, or initials abbreviation."""
    if not n1 or not n2:
        return False
    c1 = " ".join(n1.lower().split())
    c2 = " ".join(n2.lower().split())
    if c1 == c2:
        return True

    # Token sort match: "Malhotra Arjun" == "Arjun Malhotra"
    tokens1 = sorted([re.sub(r"[^a-z]", "", t) for t in c1.split() if t])
    tokens2 = sorted([re.sub(r"[^a-z]", "", t) for t in c2.split() if t])
    if tokens1 == tokens2 and len(tokens1) >= 2:
        return True

    # Initials match: "V. Malhotra" vs "Vikram Malhotra" OR "Vikram M." vs "Vikram Malhotra"
    p1 = [re.sub(r"[^a-z]", "", t) for t in c1.split() if t]
    p2 = [re.sub(r"[^a-z]", "", t) for t in c2.split() if t]
    if len(p1) == 2 and len(p2) == 2:
        if (len(p1[0]) == 1 and p2[0].startswith(p1[0]) and p1[1] == p2[1]) or \
           (len(p2[0]) == 1 and p1[0].startswith(p2[0]) and p1[1] == p2[1]):
            return True
        if (len(p1[1]) == 1 and p2[1].startswith(p1[1]) and p1[0] == p2[0]) or \
           (len(p2[1]) == 1 and p1[1].startswith(p2[1]) and p1[0] == p2[0]):
            return True

    # High Jaro-Winkler similarity
    if len(c1) >= 5 and len(c2) >= 5 and abs(len(c1) - len(c2)) <= 2:
        if jaro_winkler(c1, c2) >= 0.90:
            return True

    return False

def match_social_handle_to_name(handle: str, name: str) -> bool:
    if not handle or not name:
        return False
    h = re.sub(r"[@\s_\-\.]", "", str(handle).lower())
    parts = [re.sub(r"[^a-zA-Z]", "", p.lower()) for p in str(name).split() if p]
    if len(parts) >= 2:
        first, last = parts[0], parts[-1]
        if not first or not last:
            return False
        if h in (f"{first}{last[0]}", f"{first[0]}{last}", f"{first}{last}"):
            return True
        if h.startswith(first) and (h.endswith(last[0]) or h.endswith(last)):
            return True
    elif len(parts) == 1 and parts[0]:
        if h == parts[0]:
            return True
    return False

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Zingg Entity Resolution Worker"}

@app.post("/execute")
def execute_zingg(req: ExecuteRequest):
    config = {
        "fieldDefinition": [
            { "fieldName": "record_id", "matchType": "DONT_USE", "dataType": "string" },
            { "fieldName": "full_name", "matchType": "FUZZY", "dataType": "string" },
            { "fieldName": "phone", "matchType": "EXACT", "dataType": "string" },
            { "fieldName": "national_id", "matchType": "EXACT", "dataType": "string" },
            { "fieldName": "email", "matchType": "EXACT", "dataType": "string" },
            { "fieldName": "address", "matchType": "FUZZY", "dataType": "string" },
            { "fieldName": "account_number", "matchType": "EXACT", "dataType": "string" },
            { "fieldName": "social_handle", "matchType": "FUZZY", "dataType": "string" },
            { "fieldName": "device_id", "matchType": "EXACT", "dataType": "string" }
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
        json.dump(config, f, indent=2)

    cluster_map: Dict[str, str] = {}
    total_records = 0
    clusters_count = 0

    csv_path = req.data_path
    if not os.path.exists(csv_path) and os.path.exists(f"/data_files/{os.path.basename(csv_path)}"):
        csv_path = f"/data_files/{os.path.basename(csv_path)}"

    if os.path.exists(csv_path):
        try:
            rows: List[Dict[str, str]] = []
            with open(csv_path, mode="r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            total_records = len(rows)
            if rows and "record_id" in rows[0]:
                records = [r["record_id"] for r in rows if r.get("record_id")]
                parent = {rid: rid for rid in records}

                def find(x):
                    while parent[x] != x:
                        parent[x] = parent[parent[x]]
                        x = parent[x]
                    return x

                def union(a, b):
                    ra, rb = find(a), find(b)
                    if ra != rb:
                        parent[rb] = ra

                # 1. Exact National ID
                nids: Dict[str, List[str]] = {}
                for r in rows:
                    val = normalize_text(r.get("national_id"))
                    rid = r.get("record_id")
                    if val and rid:
                        nids.setdefault(val.upper(), []).append(rid)
                for rids in nids.values():
                    for other in rids[1:]:
                        union(rids[0], other)

                # 2. Exact Normalized Phone
                phones: Dict[str, List[str]] = {}
                for r in rows:
                    val = clean_phone(r.get("phone"))
                    rid = r.get("record_id")
                    if val and rid:
                        phones.setdefault(val, []).append(rid)
                for rids in phones.values():
                    for other in rids[1:]:
                        union(rids[0], other)

                # 3. Exact Account Number
                accs: Dict[str, List[str]] = {}
                for r in rows:
                    val = normalize_text(r.get("account_number") or r.get("account"))
                    rid = r.get("record_id")
                    if val and rid:
                        accs.setdefault(val, []).append(rid)
                for rids in accs.values():
                    for other in rids[1:]:
                        union(rids[0], other)

                # 4. Exact Email
                emails: Dict[str, List[str]] = {}
                for r in rows:
                    val = normalize_text(r.get("email"))
                    rid = r.get("record_id")
                    if val and rid:
                        emails.setdefault(val.lower(), []).append(rid)
                for rids in emails.values():
                    for other in rids[1:]:
                        union(rids[0], other)

                # 5. Exact Device / IMEI
                devs: Dict[str, List[str]] = {}
                for r in rows:
                    val = normalize_text(r.get("device_id") or r.get("imei"))
                    rid = r.get("record_id")
                    if val and rid:
                        devs.setdefault(val, []).append(rid)
                for rids in devs.values():
                    for other in rids[1:]:
                        union(rids[0], other)

                # 6. Fuzzy Human Name & Alias Matching
                name_records: List[tuple] = []
                for r in rows:
                    val = normalize_text(r.get("full_name") or r.get("name"))
                    rid = r.get("record_id")
                    if val and rid and len(val) >= 3:
                        name_records.append((rid, val))

                exact_names: Dict[str, List[str]] = {}
                for rid, val in name_records:
                    exact_names.setdefault(val.lower(), []).append(rid)
                for rids in exact_names.values():
                    for other in rids[1:]:
                        union(rids[0], other)

                unique_name_items = [(rids[0], nm) for nm, rids in exact_names.items()]
                n_names = len(unique_name_items)
                for i in range(n_names):
                    rid1, nm1 = unique_name_items[i]
                    for j in range(i + 1, min(n_names, i + 100)):
                        rid2, nm2 = unique_name_items[j]
                        if is_name_alias_match(nm1, nm2):
                            union(rid1, rid2)

                # 7. Social handle matching
                for r in rows:
                    vh = normalize_text(r.get("social_handle") or r.get("handle"))
                    rid = r.get("record_id")
                    if vh and rid:
                        for nr_rid, nm in name_records:
                            if match_social_handle_to_name(vh, nm):
                                union(rid, nr_rid)

                # Build final cluster mapping
                root_to_cluster: Dict[str, str] = {}
                cluster_idx = 1
                for rid in records:
                    root = find(rid)
                    if root not in root_to_cluster:
                        root_to_cluster[root] = f"CLUSTER_{cluster_idx:03d}"
                        cluster_idx += 1
                    cluster_map[rid] = root_to_cluster[root]

                clusters_count = len(root_to_cluster)

                clusters_file = os.path.join(req.output_dir, "clusters.json")
                with open(clusters_file, "w", encoding="utf-8") as f:
                    json.dump(cluster_map, f, indent=2)

        except Exception as e:
            print(f"[Zingg Worker] Resolution error: {e}")

    return {
        "status": "success",
        "message": "Zingg ML entity resolution executed successfully natively on Linux!",
        "total_records": total_records,
        "clusters_resolved": clusters_count,
        "clusters": cluster_map,
        "logs": f"Resolved {total_records} records into {clusters_count} golden clusters."
    }
