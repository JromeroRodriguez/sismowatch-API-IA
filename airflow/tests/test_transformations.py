"""Unit tests for USGS Earthquakes transformation functions."""

from datetime import datetime, timezone
import pytest
from include.transformations import transform_geojson_feature, epoch_ms_to_datetime


def test_epoch_ms_to_datetime():
    # 1700000000000 ms = 2023-11-14 22:13:20 UTC
    dt = epoch_ms_to_datetime(1700000000000)
    assert dt is not None
    assert dt.tzinfo == timezone.utc
    assert dt.year == 2023
    assert dt.month == 11
    assert dt.day == 14

    # None or invalid input returns None
    assert epoch_ms_to_datetime(None) is None


def test_transform_geojson_feature_valid():
    sample_feature = {
        "type": "Feature",
        "id": "us7000test",
        "properties": {
            "mag": 5.4,
            "place": "10 km SSW of San Jose, California",
            "time": 1700000000000,
            "updated": 1700003600000,
            "status": "reviewed",
            "tsunami": 1,
            "sig": 450,
            "magType": "mw",
            "type": "earthquake",
            "url": "https://earthquake.usgs.gov/earthquakes/eventpage/us7000test",
        },
        "geometry": {
            "type": "Point",
            "coordinates": [-121.8863, 37.3382, 12.5],
        },
    }

    result = transform_geojson_feature(sample_feature)

    assert result["id"] == "us7000test"
    assert result["mag"] == 5.4
    assert result["place"] == "10 km SSW of San Jose, California"
    assert isinstance(result["time"], datetime)
    assert result["time"].tzinfo == timezone.utc
    assert result["longitude"] == -121.8863
    assert result["latitude"] == 37.3382
    assert result["depth_km"] == 12.5
    assert result["tsunami"] == 1
    assert result["sig"] == 450
    assert result["status"] == "reviewed"
    assert result["mag_type"] == "mw"
    assert result["is_valid"] is True


def test_transform_geojson_feature_missing_fields():
    # Minimal feature with missing properties and coordinates
    minimal_feature = {
        "type": "Feature",
        "id": "minimal01",
        "properties": {},
        "geometry": {},
    }

    result = transform_geojson_feature(minimal_feature)

    assert result["id"] == "minimal01"
    assert result["mag"] == 0.0
    assert result["place"] == "Unknown Location"
    assert result["longitude"] == 0.0
    assert result["latitude"] == 0.0
    assert result["depth_km"] == 0.0
    assert result["tsunami"] == 0
    assert isinstance(result["time"], datetime)
