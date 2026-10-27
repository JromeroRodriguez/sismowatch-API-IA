"""Anti-hallucination validation module.

Verifies that numerical claims in LLM output exactly match the ground-truth
calculated figures from SQL/Python before persisting.
"""

import re
from typing import Tuple, List
from ai.schemas import CalculatedMetrics, ExecutiveReportOutput


def validate_report_numerical_integrity(
    report: ExecutiveReportOutput, metrics: CalculatedMetrics
) -> Tuple[bool, List[str]]:
    """Checks that key figures mentioned in the narrative text correspond to

    the verified calculated metrics.
    """
    mismatches: List[str] = []
    full_text = f"{report.title} {report.executive_summary} {report.activity_analysis} {report.tsunami_assessment} {report.anomaly_summary}"

    # 1. Verify total events mention
    total_str = str(metrics.total_events)
    # If the text mentions numbers followed by "sismos" or "eventos", check if it matches
    sismo_mentions = re.findall(r"(\d+)\s+(?:sismos|eventos|terremotos)", full_text, re.IGNORECASE)
    if sismo_mentions:
        found_match = any(m == total_str for m in sismo_mentions)
        if not found_match:
            mismatches.append(
                f"El texto menciona conteos de sismos ({sismo_mentions}) que no coinciden con el total calculado ({total_str})"
            )

    # 2. Verify max magnitude mention
    max_mag_str = f"{metrics.max_magnitude:.1f}"
    mag_mentions = re.findall(r"(\d+\.\d+)\s*(?:Mw|magnitud|en la escala)", full_text, re.IGNORECASE)
    if mag_mentions:
        # Check if the max reported magnitude matches or is within expected
        found_max = any(m == max_mag_str for m in mag_mentions)
        if not found_max:
            # If highest mentioned magnitude exceeds calculated max_magnitude by more than 0.2
            highest_mentioned = max([float(m) for m in mag_mentions])
            if highest_mentioned > metrics.max_magnitude + 0.1:
                mismatches.append(
                    f"El texto menciona una magnitud máxima ({highest_mentioned}) superior a la calculada en Gold ({metrics.max_magnitude})"
                )

    # 3. Verify tsunami warnings
    if metrics.tsunami_events == 0:
        if "alerta de tsunami activa" in full_text.lower() or "se emitieron alertas de tsunami" in full_text.lower():
            mismatches.append("El texto afirma que hubo alertas de tsunami cuando el conteo real es 0")

    is_valid = len(mismatches) == 0
    return is_valid, mismatches
