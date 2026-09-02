import math
from typing import List, Dict, Any, Tuple
from datetime import datetime

class SpatialFeatureExtractor:
    """Extracts geospatial movement and trajectory telemetry features."""

    @staticmethod
    def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculates great-circle distance between two GPS coordinates in kilometers."""
        r = 6371.0  # Earth radius in kilometers
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (
            math.sin(d_lat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(d_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    def extract_trajectory_features(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Input: list of canonical events with telemetry coordinates for an entity.
        Output: trajectory features, max implied velocity, total distance.
        """
        waypoints: List[Tuple[datetime, float, float, str]] = []

        for e in events:
            telemetry = e.get("telemetry", {})
            lat = telemetry.get("lat")
            lng = telemetry.get("lng")
            ts_str = e.get("timestamp")

            if lat is not None and lng is not None and ts_str:
                try:
                    dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    waypoints.append((dt, float(lat), float(lng), e.get("event_id", "")))
                except Exception:
                    pass

        if not waypoints:
            return {
                "waypoint_count": 0,
                "total_distance_km": 0.0,
                "max_speed_kmh": 0.0,
                "impossible_transitions": []
            }

        # Sort chronologically
        waypoints.sort(key=lambda x: x[0])

        total_distance = 0.0
        max_speed = 0.0
        impossible_transitions = []

        for i in range(len(waypoints) - 1):
            t1, lat1, lon1, id1 = waypoints[i]
            t2, lat2, lon2, id2 = waypoints[i+1]

            elapsed_seconds = (t2 - t1).total_seconds()
            if elapsed_seconds <= 0:
                continue

            dist_km = self.haversine_km(lat1, lon1, lat2, lon2)
            total_distance += dist_km
            speed_kmh = (dist_km / elapsed_seconds) * 3600.0

            if speed_kmh > max_speed:
                max_speed = speed_kmh

            # Flag if speed exceeds physical plausibility
            if speed_kmh > 800.0 and dist_km > 50.0:
                impossible_transitions.append({
                    "from_event": id1,
                    "to_event": id2,
                    "from_coord": [lat1, lon1],
                    "to_coord": [lat2, lon2],
                    "distance_km": round(dist_km, 2),
                    "elapsed_seconds": round(elapsed_seconds, 1),
                    "speed_kmh": round(speed_kmh, 1)
                })

        return {
            "waypoint_count": len(waypoints),
            "total_distance_km": round(total_distance, 2),
            "max_speed_kmh": round(max_speed, 1),
            "impossible_transitions": impossible_transitions,
            "waypoints": [
                {"timestamp": w[0].isoformat(), "lat": w[1], "lng": w[2], "event_id": w[3]}
                for w in waypoints
            ]
        }

spatial_features = SpatialFeatureExtractor()
