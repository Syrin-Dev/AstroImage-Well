import pytest
from astro_engine import calculate_positions

def test_calculate_positions():
    # Test with a known location (Greenwich) and roughly current time
    lat = 51.4934
    lon = 0.0098
    
    # We test that it runs without error and returns results
    results = calculate_positions(lat, lon)
    
    assert len(results) > 0
    assert 'altitude' in results[0]
    assert 'azimuth' in results[0]
    assert 'score' in results[0]
    
    # Check that score is sorted descending
    scores = [r['score'] for r in results]
    assert scores == sorted(scores, reverse=True)

def test_visibility():
    # Test M31 which is in Northern Hemisphere
    # Location: Southern Hemisphere (should be invisible or low)
    lat = -45.0
    lon = 0.0
    
    results = calculate_positions(lat, lon)
    m31 = next(r for r in results if r['id'] == 'M31')
    
    # M31 Dec is +41. At -45 Lat, it should be very low or below horizon most of the time.
    # Actually Dec +41 and Lat -45 means max altitude is 90 - (41 - (-45)) = 90 - 86 = 4 degrees.
    # So it should be low or invisible.
    
    assert m31['altitude'] < 10 or m31['visible'] == False
