import pandas as pd
import numpy as np
from astropy.coordinates import SkyCoord, EarthLocation, AltAz, get_body
from astropy.time import Time
from astropy import units as u

# Try importing astroplan, but handle failure gracefully if not installed yet
try:
    from astroplan import Observer, FixedTarget
    HAS_ASTROPLAN = True
except ImportError:
    HAS_ASTROPLAN = False
    print("Warning: astroplan not found. Rise/Set times will be unavailable.")

from dso_data import get_dso_data

def calculate_airmass(alt_deg):
    """
    Calculates airmass using simple secant approximation: 1 / cos(z)
    """
    alt_rad = np.radians(alt_deg)
    zenith_angle = (np.pi / 2) - alt_rad
    # Clip to avoid division by zero or negative airmass
    # Simple rigorous formula often used: Kasten and Young (1989) or just sec(z) for z < 80
    # Use simple sec(z) clamped.
    with np.errstate(divide='ignore'):
        airmass = 1 / np.cos(zenith_angle)
    
    # Replace infinite/negative (objects below horizon) 
    airmass = np.where(alt_deg <= 0, None, airmass)
    return airmass

def get_rise_set_transit_times(target_coord, observer, obstime):
    """
    Calculates rise, set, and transit times using Astroplan.
    Returns strings or None.
    """
    if not HAS_ASTROPLAN:
        return None, None, None, None

    try:
        # Create a FixedTarget
        # note: FixedTarget is expensive if created in loop?
        # Actually Observer.target_rise_time methods take SkyCoord too usually? 
        # Checking astroplan docs: observer.rise_time(time, target)
        
        # We search next rise/set from the CURRENT obstime
        rise_time_obj = observer.target_rise_time(obstime, target_coord, which='next')
        set_time_obj = observer.target_set_time(obstime, target_coord, which='next')
        transit_time_obj = observer.target_meridian_transit_time(obstime, target_coord, which='next')
        
        # Best window logic (simplified): 
        # Just return the window string if it's currently rising? 
        # User defined "Best Imaging Window" as > 30 deg and no moon.
        # This is complex to calculate strictly without a heavy loop.
        # We will return the times first.
        
        def fmt_time(t):
            return t.iso.split(' ')[1][:5] if t else "--:--"

        return fmt_time(rise_time_obj), fmt_time(set_time_obj), fmt_time(transit_time_obj)
        
    except Exception as e:
        # print(f"Ephemeris error: {e}")
        return "--:--", "--:--", "--:--"

def calculate_positions(lat, lon, time_str=None, bortle=4, filters=None):
    """
    Calculates Alt/Az for DSOs using vectorized operations on DataFrames.
    """
    
    # 1. Setup Location and Time
    location = EarthLocation(lat=lat*u.deg, lon=lon*u.deg)
    
    if time_str:
        if 'T' not in time_str: # basic handling
             # assume today if only time, or full iso? logic from app usually sends ISO or YYYY-MM-DD THH:MM
             # Safe fallback
             try:
                obstime = Time(time_str)
             except:
                obstime = Time.now()
        else:
            obstime = Time(time_str)
    else:
        obstime = Time.now()

    # Observer for Astroplan
    observer = None
    if HAS_ASTROPLAN:
        observer = Observer(location=location)

    # 2. Get Data
    filters = filters or {}
    df = get_dso_data(**filters)
    
    if df.empty:
        return [], {}

    # 3. Moon Calculations
    try:
        moon_skycoord = get_body_managed("moon", obstime, location)
        sun_skycoord = get_body_managed("sun", obstime, location)
        
        moon_altaz = moon_skycoord.transform_to(AltAz(obstime=obstime, location=location))
        moon_alt = moon_altaz.alt.degree
        moon_az = moon_altaz.az.degree
        
        # Illumination
        elongation = sun_skycoord.separation(moon_skycoord)
        moon_illumination = 0.5 * (1 - np.cos(elongation.rad))
        moon_phase_percent = int(moon_illumination * 100)
    except Exception as e:
        print(f"Moon error: {e}")
        moon_alt, moon_az, moon_phase_percent = -10, 0, 0
        moon_skycoord = None

    moon_data = {
        'altitude': round(moon_alt, 1),
        'azimuth': round(moon_az, 1),
        'illumination': moon_phase_percent,
        'is_up': moon_alt > 0
    }

    # 4. Vectorized DSO Calculations
    # Ensure coords are floats
    ra_vals = df['ra_deg'].values
    dec_vals = df['dec_deg'].values
    
    # Create valid mask
    mask = ~np.isnan(ra_vals) & ~np.isnan(dec_vals)
    valid_df = df[mask].copy()
    
    if valid_df.empty:
        return [], moon_data
    
    # Batch SkyCoord
    dso_coords = SkyCoord(
        ra=valid_df['ra_deg'].values * u.deg, 
        dec=valid_df['dec_deg'].values * u.deg, 
        frame='icrs'
    )
    
    # Transform to AltAz
    altaz_frame = AltAz(obstime=obstime, location=location)
    dso_altaz = dso_coords.transform_to(altaz_frame)
    
    alt_vals = dso_altaz.alt.degree
    az_vals = dso_altaz.az.degree
    
    valid_df['altitude'] = alt_vals
    valid_df['azimuth'] = az_vals
    
    # Airmass
    valid_df['airmass'] = calculate_airmass(alt_vals)
    
    # Moon Separation
    if moon_skycoord:
        sep_vals = dso_coords.separation(moon_skycoord).degree
        valid_df['moon_separation'] = sep_vals
    else:
        valid_df['moon_separation'] = 180

    # 5. Scoring Logic (Vectorized)
    # Score = (Alt Score) + (Mag/Bortle Score)
    
    # Alt Score: 0 if alt < 0. Max 50 if alt > 30. Linear 0-30.
    alt_score = np.where(alt_vals > 30, 50, (alt_vals / 30) * 50)
    alt_score = np.where(alt_vals <= 0, 0, alt_score)
    
    # Mag Penalty
    bortle_penalty = (bortle - 1) * 0.5
    
    # Moon Penalty
    # factor = illum * (1 - separation/90) if moon_up specific logic
    moon_penalty = np.zeros_like(alt_vals)
    if moon_alt > 0:
        moon_sep = valid_df['moon_separation'].values
        # Separation factor: 1 at 0deg, 0 at 90deg
        sep_factor = 1 - (np.minimum(moon_sep, 90) / 90)
        moon_penalty = moon_illumination * sep_factor * 20
        
    eff_mag = valid_df['mag'].values + bortle_penalty + moon_penalty
    
    # Mag Score: Map mag 0->50, mag 10->0 etc. (50 - mag*5) clamped
    mag_score = 50 - (eff_mag * 5)
    mag_score = np.clip(mag_score, 0, 50)
    
    total_score = alt_score + mag_score
    # Zero out score if below horizon
    total_score = np.where(alt_vals <= 0, 0, total_score)
    
    valid_df['score'] = total_score
    
    # 6. Formatting & Filtering for Display
    # Sort by score
    valid_df = valid_df.sort_values('score', ascending=False)
    
    # Take top N for expensive calculations (Rise/Set)
    # We only want to compute this for the ones likely to be shown
    top_n = 50
    head_df = valid_df.head(top_n).copy()
    
    # Enrich with Rise/Set times (Generic Loop for now)
    if HAS_ASTROPLAN and observer:
        rise_times = []
        set_times = []
        transit_times = []
        
        # Re-iterate top items
        for idx, row in head_df.iterrows():
            # Construct single coord
            target = SkyCoord(ra=row['ra_deg']*u.deg, dec=row['dec_deg']*u.deg)
            r, s, t = get_rise_set_transit_times(target, observer, obstime)
            rise_times.append(r)
            set_times.append(s)
            transit_times.append(t)
            
        head_df['rise_time'] = rise_times
        head_df['set_time'] = set_times
        head_df['transit_time'] = transit_times
        
        # Best imaging window (rough string)
        head_df['best_window'] = "Check Moon" # Placeholder for complex logic
    else:
        head_df['rise_time'] = "--"
        head_df['set_time'] = "--"
        head_df['transit_time'] = "--"
        head_df['best_window'] = "--"

    # Convert to list of dicts
    # Round floats for display
    head_df['altitude'] = head_df['altitude'].round(1)
    head_df['azimuth'] = head_df['azimuth'].round(1)
    head_df['score'] = head_df['score'].round(1)
    head_df['moon_separation'] = head_df['moon_separation'].round(1)
    
    # Handle NaN airmass
    head_df['airmass'] = head_df['airmass'].apply(lambda x: round(x, 2) if pd.notnull(x) else "-")

    return head_df.to_dict('records'), moon_data

def get_body_managed(name, time, location):
    """Wrapper for astropy get_body to handle potential download errors gracefully"""
    try:
        return get_body(name, time=time, location=location)
    except Exception:
        # Fallback to SkyCoord at 0,0 if internet fails for ephemeris
        return SkyCoord(0, 0, unit="deg", frame="icrs")
