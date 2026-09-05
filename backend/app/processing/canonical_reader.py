import io
import json
import logging
from typing import List, Dict, Any, Optional
import pyarrow.parquet as pq
from app.core.config import settings
from app.core.storage import storage_service

logger = logging.getLogger("investigation.reader")

class CanonicalWarehouseReader:
    """
    Columnar query service reading canonical investigation events from
    the MinIO Parquet/Iceberg warehouse. Completely replaces MongoDB query APIs.
    """

    def __init__(self):
        self.bucket = settings.MINIO_BUCKET_WAREHOUSE
        self.prefix = "canonical_events/"

    def _list_parquet_keys(self, case_id: Optional[str] = None) -> List[str]:
        """List all parquet keys in the warehouse, optionally filtered by case_id prefix."""
        keys = []
        try:
            storage_service.ensure_buckets()
            prefix = f"{self.prefix}case_id={case_id}/" if case_id else self.prefix
            paginator = storage_service.s3_client.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                for obj in page.get('Contents', []):
                    if obj['Key'].endswith('.parquet'):
                        keys.append(obj['Key'])
        except Exception as e:
            logger.warning(f"[CanonicalReader] Error listing warehouse keys: {e}")
        return keys

    def _read_table_from_key(self, key: str) -> List[Dict[str, Any]]:
        """Reads and converts a single parquet object into canonical event dicts."""
        try:
            resp = storage_service.s3_client.get_object(Bucket=self.bucket, Key=key)
            buffer = io.BytesIO(resp['Body'].read())
            table = pq.read_table(buffer)
            return table.to_pylist()
        except Exception as e:
            logger.error(f"[CanonicalReader] Failed to read {key}: {e}")
            return []

    def read_all_events(
        self,
        case_id: Optional[str] = None,
        source_type: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves canonical events from the warehouse.
        Returns unified records with formatted nested identity, telemetry, and financial fields.
        """
        keys = self._list_parquet_keys(case_id)
        all_records = []

        for key in keys:
            rows = self._read_table_from_key(key)
            for r in rows:
                if source_type and r.get("source_type") != source_type:
                    continue

                # Reconstruct nested event structure compatible with downstream consumers
                attributes = {}
                if r.get("attributes_json"):
                    try:
                        attributes = json.loads(r["attributes_json"])
                    except Exception:
                        pass

                provenance = {}
                if r.get("provenance_json"):
                    try:
                        provenance = json.loads(r["provenance_json"])
                    except Exception:
                        pass

                event_dict = {
                    "event_id": r.get("event_id"),
                    "case_id": r.get("case_id"),
                    "evidence_id": r.get("evidence_id"),
                    "source_file": provenance.get("source_file", "unknown"),
                    "domain": r.get("source_type"),
                    "source_type": r.get("source_type"),
                    "event_type": r.get("event_type"),
                    "timestamp": r.get("timestamp"),
                    "z_cluster_id": r.get("z_cluster_id") or None,

                    "normalized_identity": {
                        "name": r.get("entity_name") or None,
                        "phone": r.get("entity_phone") or None,
                        "national_id": r.get("entity_national_id") or None,
                        "email": r.get("entity_email") or None,
                        "social_handle": r.get("entity_social_handle") or None,
                        "social_platform": r.get("entity_social_platform") or None
                    },

                    "telemetry": {
                        "imei": r.get("telemetry_imei") or None,
                        "cell_tower_id": r.get("telemetry_cell_tower_id") or None,
                        "lat": r.get("telemetry_lat"),
                        "lng": r.get("telemetry_lng"),
                        "address": r.get("telemetry_address") or None,
                        "assigned_ip": r.get("telemetry_assigned_ip") or None,
                        "destination_ip": r.get("telemetry_destination_ip") or None,
                        "service_port": r.get("telemetry_service_port"),
                        "duration_seconds": r.get("telemetry_duration_seconds"),
                        "bytes_transferred": r.get("telemetry_bytes_transferred")
                    },

                    "financial": {
                        "account_number": r.get("financial_account_number") or None,
                        "amount_inr": r.get("financial_amount_inr") or 0.0,
                        "txn_type": r.get("financial_txn_type") or None,
                        "channel": r.get("financial_channel") or None,
                        "counterparty": r.get("financial_counterparty") or None,
                        "narration": r.get("financial_narration") or None
                    },

                    "attributes": attributes,
                    "provenance": provenance
                }
                all_records.append(event_dict)

                if limit and len(all_records) >= limit:
                    return all_records

        return all_records

    def backfill_cluster_ids(
        self,
        phone_to_cluster: Dict[str, str],
        handle_to_cluster: Dict[str, str],
        account_to_cluster: Optional[Dict[str, str]] = None,
        nid_to_cluster: Optional[Dict[str, str]] = None,
        name_to_cluster: Optional[Dict[str, str]] = None
    ):
        """
        Updates z_cluster_id in MinIO Parquet files after Entity Resolution finishes.
        Matches across all hard anchors (phone, account, national_id, handle, name).
        """
        keys = self._list_parquet_keys()
        import pyarrow as pa
        account_map = account_to_cluster or {}
        nid_map = nid_to_cluster or {}
        name_map = name_to_cluster or {}

        for key in keys:
            rows = self._read_table_from_key(key)
            modified = False
            for r in rows:
                phone = r.get("entity_phone")
                handle = r.get("entity_social_handle")
                acc = r.get("financial_account_number")
                nid = r.get("entity_national_id")
                name = r.get("entity_name")

                cid = None
                if phone and phone in phone_to_cluster:
                    cid = phone_to_cluster[phone]
                elif acc and acc in account_map:
                    cid = account_map[acc]
                elif nid and nid in nid_map:
                    cid = nid_map[nid]
                elif handle and handle in handle_to_cluster:
                    cid = handle_to_cluster[handle]
                elif name and name in name_map:
                    cid = name_map[name]

                if cid and r.get("z_cluster_id") != cid:
                    r["z_cluster_id"] = cid
                    modified = True

            if modified:
                from app.processing.spark_pipeline import CANONICAL_PYARROW_SCHEMA
                table = pa.Table.from_pylist(rows, schema=CANONICAL_PYARROW_SCHEMA)
                buf = io.BytesIO()
                pq.write_table(table, buf, compression="SNAPPY", use_dictionary=True)
                storage_service.s3_client.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=buf.getvalue(),
                    ContentType="application/octet-stream"
                )
                logger.info(f"[CanonicalReader] Backfilled cluster IDs into {key}")

    def clear_warehouse(self):
        """Drops all canonical parquet tables in the warehouse."""
        try:
            keys = self._list_parquet_keys()
            for key in keys:
                storage_service.s3_client.delete_object(Bucket=self.bucket, Key=key)
            logger.info(f"[CanonicalReader] Cleared {len(keys)} warehouse objects from MinIO.")
        except Exception as e:
            logger.warning(f"[CanonicalReader] Error clearing warehouse: {e}")

canonical_reader = CanonicalWarehouseReader()
