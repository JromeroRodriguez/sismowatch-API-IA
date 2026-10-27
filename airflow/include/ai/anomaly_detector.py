"""Statistical anomaly detection module using Z-Score."""

import math
from typing import List
from ai.schemas import AnomalyDetail
from ai.sanitizer import sanitize_place_text


def detect_seismic_anomalies(
    events_24h: list[dict], historical_events: list[dict], z_threshold: float = 2.0
) -> List[AnomalyDetail]:
    """Detects statistical magnitude and depth anomalies in last 24h events

    compared to baseline distribution using Z-score.
    
    Formula: z = (mag - mean) / std_dev
    """
    if not historical_events:
        return []

    # 1. Compute baseline statistics (mean and std dev)
    magnitudes = [float(e["mag"]) for e in historical_events if e.get("mag") is not None]
    if len(magnitudes) < 5:
        return []

    mean_mag = sum(magnitudes) / len(magnitudes)
    variance = sum((m - mean_mag) ** 2 for m in magnitudes) / len(magnitudes)
    std_mag = math.sqrt(variance) if variance > 0 else 1.0

    anomalies: List[AnomalyDetail] = []

    for ev in events_24h:
        mag = float(ev.get("mag") or 0.0)
        depth = float(ev.get("depth_km") or 0.0)
        z_mag = (mag - mean_mag) / std_mag

        # Anomaly criteria: Z-score above threshold OR high magnitude with shallow depth
        is_anomaly = False
        reasons = []

        if z_mag >= z_threshold:
            is_anomaly = True
            reasons.append(
                f"Magnitud {mag:.1f} Mw excede la media histórica ({mean_mag:.2f} Mw) con Z-score de {z_mag:.2f}"
            )

        if depth <= 3.0 and mag >= 4.0:
            is_anomaly = True
            reasons.append(
                f"Foco hipocentral ultra-superficial ({depth:.1f} km), aumentando aceleración sísmica en superficie"
            )
        elif depth >= 350.0:
            is_anomaly = True
            reasons.append(
                f"Sismo de profundidad profunda inusual ({depth:.1f} km) en zona de losa en subducción"
            )

        if is_anomaly:
            clean_place = sanitize_place_text(ev.get("place"))
            explanation = ". ".join(reasons) + "."
            anomalies.append(
                AnomalyDetail(
                    event_id=str(ev["id"]),
                    place=clean_place,
                    magnitude=mag,
                    depth_km=depth,
                    technique="z-score",
                    anomaly_score=round(z_mag, 4),
                    explanation=explanation,
                )
            )

    return anomalies
