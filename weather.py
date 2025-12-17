import requests

def get_weather(lat, lon):
    """
    Fetches current weather (cloud cover) from Open-Meteo.
    """
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "cloud_cover,visibility,dew_point_2m,temperature_2m",
            "timezone": "auto"
        }
        
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        current = data.get("current", {})
        cloud_cover = current.get("cloud_cover", 0) # Percentage
        visibility = current.get("visibility", 0) # Meters
        dew_point = current.get("dew_point_2m", None) # C
        temp = current.get("temperature_2m", None) # C

        # Transparency estimation (rough logic based on visibility/cloud)
        # If visibility > 20000 m (20km) -> good. 
        transparency = "Poor"
        if visibility > 20000:
            transparency = "Excellent"
        elif visibility > 10000:
             transparency = "Average"
        
        return {
            "cloud_cover": cloud_cover,
            "visibility": visibility,
            "dew_point": dew_point,
            "temperature": temp,
            "transparency": transparency,
            "error": None
        }
    except Exception as e:
        return {
            "cloud_cover": None,
            "visibility": None,
            "error": str(e)
        }
