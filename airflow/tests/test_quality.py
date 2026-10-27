"""Unit tests for Pandera quality validations (valid and invalid cases)."""

from datetime import datetime, timezone
import pandas as pd
from include.quality import validate_earthquakes_dataset, EarthquakeSchema


def test_quality_rule_valid_case():
    """Test with valid earthquake records: should pass all rules."""
    valid_data = pd.DataFrame(
        [
            {
                "id": "us7000test1",
                "place": "Oaxaca, Mexico",
                "time": datetime.now(timezone.utc),
                "latitude": 16.5,
                "longitude": -95.0,
                "mag": 4.5,
                "depth_km": 15.0,
            },
            {
                "id": "us7000test2",
                "place": "Southern California",
                "time": datetime.now(timezone.utc),
                "latitude": 34.0,
                "longitude": -118.0,
                "mag": 2.1,
                "depth_km": 8.0,
            },
        ]
    )

    # 1. Validate Pandera schema directly
    validated_df = EarthquakeSchema.validate(valid_data)
    assert not validated_df.empty

    # 2. Validate comprehensive dataset quality checks
    df_result, summary = validate_earthquakes_dataset(
        valid_data, dag_id="test_dag", run_id="test_run_valid"
    )

    assert summary["status"] == "PASSED"
    assert summary["quality_score"] == 100.0
    assert summary["rules_rejected"] == 0
    assert df_result["is_valid"].all()


def test_quality_rule_invalid_case():
    """Test with invalid records: coordinates out of bounds, magnitude out of range, missing id.

    Should flag is_valid = False and record rejected rules.
    """
    invalid_data = pd.DataFrame(
        [
            {
                "id": "us7000bad1",
                "place": "Impossible North Pole",
                "time": datetime.now(timezone.utc),
                "latitude": 150.0,  # Invalid: Latitude > 90
                "longitude": -200.0,  # Invalid: Longitude < -180
                "mag": 25.0,  # Invalid: Magnitude > 10
                "depth_km": -50.0,  # Invalid: Depth < -10
            },
            {
                "id": "",  # Invalid: Empty ID
                "place": "",  # Invalid: Empty place
                "time": datetime.now(timezone.utc),
                "latitude": 10.0,
                "longitude": 10.0,
                "mag": 3.0,
                "depth_km": 10.0,
            },
        ]
    )

    df_result, summary = validate_earthquakes_dataset(
        invalid_data, dag_id="test_dag", run_id="test_run_invalid"
    )

    # Verify invalid rows were marked is_valid = False (discarded from Gold)
    assert not df_result["is_valid"].any()
    assert summary["rules_rejected"] > 0
    assert summary["quality_score"] < 80.0
    assert summary["status"] == "FAILED"
