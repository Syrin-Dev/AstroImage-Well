from flask import Flask, render_template, request, jsonify
from datetime import datetime
import sys

# Graceful import handling
import_error_msg = None
try:
    from astro_engine import calculate_positions
    from weather import get_weather
except ImportError as e:
    import_error_msg = str(e)
    print("CRITICAL ERROR: Missing dependencies.")
    print(f"Details: {e}")
    calculate_positions = None
    get_weather = None
except Exception as e:
    import_error_msg = f"Startup Error: {str(e)}"
    print(f"Details: {e}")
    calculate_positions = None
    get_weather = None


app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

import math

def calculate_fov(focal_length, sensor_width, sensor_height):
    """
    Calculates FOV in degrees.
    """
    if not focal_length or not sensor_width or not sensor_height:
        return None
    
    # 2 * atan(sensor / (2 * focal)) * (180 / pi)
    fov_w = 2 * math.atan(sensor_width / (2 * focal_length)) * (180 / math.pi)
    fov_h = 2 * math.atan(sensor_height / (2 * focal_length)) * (180 / math.pi)
    return min(fov_w, fov_h)

@app.route('/results', methods=['POST'])
def results():
    try:
        lat = float(request.form.get('latitude'))
        lon = float(request.form.get('longitude'))
        date_str = request.form.get('datetime')
        if not date_str:
            date_str = datetime.now().isoformat()
            
        bortle = int(request.form.get('bortle', 4))
        
        # Equipment
        try:
            focal_length = float(request.form.get('focal_length', 0))
            sensor_width = float(request.form.get('sensor_width', 0))
            sensor_height = float(request.form.get('sensor_height', 0))
        except ValueError:
            focal_length = 0
            sensor_width = 0
            sensor_height = 0

        if not calculate_positions or not get_weather:
             err_text = f"Application misconfigured. Missing dependencies. Error: {import_error_msg}"
             return render_template('error.html', error=err_text)

        # Astronomy Data
        objects, moon_data = calculate_positions(lat, lon, date_str, bortle)
        
        # Weather Data
        weather_data = get_weather(lat, lon)
        
        # Weather Adjustment
        if weather_data['cloud_cover'] is not None:
            cloud_factor = (100 - weather_data['cloud_cover']) / 100.0
            for obj in objects:
                # Penalty logic
                pass 
                # Keeping original simple reduction for now or expanding?
                # The user asked for "Air Mass" in score logic, which I did in engine.
                # Here specifically about weather adjustment:
                obj['score'] = round(obj['score'] * cloud_factor, 1)

        # FOV Calculation
        min_fov_deg = calculate_fov(focal_length, sensor_width, sensor_height)
        
        for obj in objects:
            # Check FOV
            obj['fov_match'] = None
            if min_fov_deg and 'size' in obj and obj['size']:
                # Size is in arcminutes. Convert to degrees.
                size_deg = obj['size'] / 60.0
                if size_deg < min_fov_deg:
                    obj['fov_match'] = "Fits in FOV"
                else:
                    obj['fov_match'] = "Too Large"
            
        objects.sort(key=lambda x: x['score'], reverse=True)
        
        return render_template('results.html', objects=objects, weather=weather_data, location={'lat': lat, 'lon': lon, 'time': date_str}, moon=moon_data, equipment={'fl': focal_length})
        
    except Exception as e:
        return render_template('error.html', error=str(e))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
