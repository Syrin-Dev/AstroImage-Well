import { catalog } from './catalog.js';

/* --- Simple Astronomy Math --- */
// Constants
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function toRad(deg) { return deg * DEG2RAD; }
function toDeg(rad) { return rad * RAD2DEG; }

// Convert Date to Julian Date
function getJulianDate(date) {
    return (date.getTime() / 86400000) + 2440587.5;
}

// Local Sidereal Time (in degrees)
function getLST(date, lon) {
    const jd = getJulianDate(date);
    const d = jd - 2451545.0;
    // GMST approximation
    let gmst = 280.46061837 + 360.98564736629 * d;
    gmst %= 360;
    if (gmst < 0) gmst += 360;
    let lst = gmst + lon;
    lst %= 360;
    if (lst < 0) lst += 360;
    return lst;
}

// Convert RA/Dec to Alt/Az
function getAltAz(ra, dec, lat, lon, date) {
    const lst = getLST(date, lon);
    const ha = lst - ra; // Hour Angle in degrees

    const haRad = toRad(ha);
    const decRad = toRad(dec);
    const latRad = toRad(lat);

    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const altRad = Math.asin(sinAlt);
    const alt = toDeg(altRad);

    const cosAz = (Math.sin(decRad) - Math.sin(altRad) * Math.sin(latRad)) / (Math.cos(altRad) * Math.cos(latRad));
    // Clamp for precision errors
    const cosAzClamped = Math.min(1, Math.max(-1, cosAz));
    let azRad = Math.acos(cosAzClamped);
    if (Math.sin(haRad) > 0) {
        azRad = 2 * Math.PI - azRad;
    }
    const az = toDeg(azRad);

    return { alt, az };
}

// Approximate Moon Position and Phase
function getMoonData(date, lat, lon) {
    const jd = getJulianDate(date);
    const d = jd - 2444238.5; // Days since 1980 epoch

    // Mean Longitude
    let L = 218.32488033 + 13.17639652633 * d;
    // Mean Anomaly
    let M = 134.96298139 + 13.06499295363 * d;

    // Ecliptic Longitude
    const lambda = toRad(L + 6.2888 * Math.sin(toRad(M)));
    // Ecliptic Latitude (approx via beta approx) - ignoring small term for simple filtering
    // Obliquity of ecliptic
    const epsilon = toRad(23.4393 - 0.0000004 * d);

    // RA/Dec
    const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
    const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

    const ra = toDeg(alpha); // in degrees
    // Fix RA quadrant
    // (Simpler: just use full conversion)

    // Let's use simplified Phase Algo
    // Phase is age of moon / 29.53
    const phaseRaw = (d / 29.530588853) % 1;
    // Illumination
    const illum = 0.5 * (1 - Math.cos(phaseRaw * 2 * Math.PI));

    // For position, we run the AltAz on approx coords
    // Re-calc simple coords
    // Using a simpler low-precision formulas for Moon RA/Dec
    // (Sufficient for "Up/Down" check)
    const l = toRad(218.32 + 481267.881 * (jd - 2451545.0) / 36525);
    const raM = toDeg(l); // Very rough, good enough for "is night dark?"
    const decM = 0; // Rough assumption near ecliptic which is near equator... fluctuating.
    // Okay, let's keep it safe:
    // If we want accurate Moon Avoidance, we need better math.
    // But for "Does it work in Cloudflare", let's use the basic Phase.

    // Alt/Az for Moon (Approx)
    // We will assume "Is Up" if it's roughly near transit? No, that's bad.
    // Let's rely on Illumination primarily for the UI.

    return {
        illumination: Math.round(illum * 100),
        phase: phaseRaw,
        ra: (toDeg(alpha) + 360) % 360,
        dec: toDeg(delta),
        altitude: 0 // Placeholder
    };
}
/* ------------------------- */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "POST" && url.pathname === "/results") {
            return await handleResults(request);
        }

        return new Response(renderHome(), {
            headers: { "Content-Type": "text/html" },
        });
    },
};

async function handleResults(request) {
    const formData = await request.formData();
    const lat = parseFloat(formData.get("latitude"));
    const lon = parseFloat(formData.get("longitude"));
    const dateStr = formData.get("datetime") || new Date().toISOString();
    const bortle = parseInt(formData.get("bortle") || "4");

    const focalLength = parseFloat(formData.get("focal_length") || "0");
    const sensorWidth = parseFloat(formData.get("sensor_width") || "0");
    const sensorHeight = parseFloat(formData.get("sensor_height") || "0");

    const date = new Date(dateStr);

    // Moon
    const moon = getMoonData(date, lat, lon);
    // Refine Moon Alt
    const moonPos = getAltAz(moon.ra, moon.dec, lat, lon, date);
    moon.altitude = moonPos.alt.toFixed(1);
    moon.azimuth = moonPos.az.toFixed(1);
    moon.is_up = moonPos.alt > 0;

    // 2. DSO Calculations
    const results = catalog.map(obj => {
        // Calculate Position
        const pos = getAltAz(obj.ra, obj.dec, lat, lon, date);
        const alt = pos.alt;
        const az = pos.az;

        // Airmass
        let airmass = "-";
        if (alt > 0) {
            const z = toRad(90 - alt);
            airmass = (1 / Math.cos(z)).toFixed(2);
        }

        // Scoring Logic
        let score = 0;
        if (alt > 0) {
            // Alt Score
            let altScore = (alt > 30) ? 50 : (alt / 30) * 50;

            // Mag Penalty
            const bortlePenalty = (bortle - 1) * 0.5;

            // Moon Penalty (Simple)
            let moonPenalty = 0;
            if (moon.is_up) {
                // Angle between
                // cos(sep) = sin(d1)sin(d2) + cos(d1)cos(d2)cos(ra1-ra2)
                const r1 = toRad(obj.ra); const d1 = toRad(obj.dec);
                const r2 = toRad(moon.ra); const d2 = toRad(moon.dec);
                const cosSep = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2);
                const sepDeg = toDeg(Math.acos(Math.max(-1, Math.min(1, cosSep))));

                const sepFactor = 1 - (Math.min(sepDeg, 90) / 90);
                moonPenalty = (moon.illumination / 100) * sepFactor * 20;
            }

            const effMag = obj.mag + bortlePenalty + moonPenalty;
            let magScore = 50 - (effMag * 5);
            magScore = Math.max(0, Math.min(50, magScore));

            score = altScore + magScore;
        }

        // FOV Check
        let fovMatch = null;
        const minFov = calculateFov(focalLength, sensorWidth, sensorHeight);
        if (minFov && obj.size) {
            const sizeDeg = obj.size / 60.0;
            fovMatch = (sizeDeg < minFov) ? "Fits in FOV" : "Too Large";
        }

        return {
            ...obj,
            altitude: alt.toFixed(1),
            azimuth: az.toFixed(1),
            airmass,
            score: score.toFixed(1),
            fov_match: fovMatch
        };
    });

    results.sort((a, b) => b.score - a.score);

    return new Response(renderResults(results, moon, { lat, lon, time: dateStr }, { fl: focalLength }), {
        headers: { "Content-Type": "text/html" },
    });
}

function calculateFov(fl, sw, sh) {
    if (!fl || !sw || !sh) return null;
    const fovW = 2 * Math.atan(sw / (2 * fl)) * (180 / Math.PI);
    const fovH = 2 * Math.atan(sh / (2 * fl)) * (180 / Math.PI);
    return Math.min(fovW, fovH);
}

function renderHome() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstroImage Well (JS)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #0f172a; color: #e2e8f0; font-family: 'Inter', sans-serif; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <div class="glass p-8 rounded-2xl shadow-2xl w-full max-w-lg">
        <h1 class="text-3xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">AstroImage Well</h1>
        <p class="text-center text-slate-400 mb-6">Plan your astrophotography session</p>
        
        <form action="/results" method="POST" class="space-y-4">
            <div>
                <label class="block text-sm font-medium mb-1">Your Coordinates</label>
                <div class="flex gap-2">
                    <input type="number" step="any" name="latitude" placeholder="Lat (e.g. 42.69)" required class="w-1/2 p-2 rounded bg-slate-800 border border-slate-700 focus:border-blue-500 outline-none">
                    <input type="number" step="any" name="longitude" placeholder="Lon (e.g. 23.32)" required class="w-1/2 p-2 rounded bg-slate-800 border border-slate-700 focus:border-blue-500 outline-none">
                </div>
            </div>
            
            <div>
                <label class="block text-sm font-medium mb-1">Time</label>
                <input type="datetime-local" name="datetime" class="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white scheme-dark">
            </div>

            <div>
                <label class="block text-sm font-medium mb-1">Bortle Scale (1-9)</label>
                <input type="number" name="bortle" min="1" max="9" value="4" class="w-full p-2 rounded bg-slate-800 border border-slate-700">
            </div>

            <div class="pt-2 border-t border-slate-700">
                <label class="block text-sm font-medium mb-1 text-blue-300">Equipment (Optional)</label>
                <div class="grid grid-cols-3 gap-2">
                    <input type="number" name="focal_length" placeholder="FL (mm)" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm">
                    <input type="number" name="sensor_width" placeholder="W (mm)" step="0.1" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm">
                    <input type="number" name="sensor_height" placeholder="H (mm)" step="0.1" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm">
                </div>
            </div>

            <button type="submit" class="w-full py-3 mt-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold hover:opacity-90 transition transform hover:scale-[1.02]">
                Find Targets 🚀
            </button>
        </form>
    </div>
</body>
</html>
  `;
}

function renderResults(objects, moon, loc, equip) {
    const rows = objects.map(obj => `
    <tr class="border-b border-slate-700 hover:bg-slate-700/50 transition">
        <td class="p-3 font-semibold text-blue-300">${obj.id}</td>
        <td class="p-3">${obj.name}<br><span class="text-xs text-slate-400">${obj.type}</span></td>
        <td class="p-3 text-center font-mono ${parseFloat(obj.score) > 80 ? 'text-green-400 font-bold' : parseFloat(obj.score) > 50 ? 'text-yellow-400' : 'text-slate-500'}">${obj.score}</td>
        <td class="p-3 text-center">${obj.altitude}°<br><span class="text-xs text-slate-400">Az: ${obj.azimuth}°</span></td>
        <td class="p-3 text-center sm:table-cell hidden">${obj.mag}</td>
        <td class="p-3 text-center sm:table-cell hidden text-xs">${obj.fov_match || '-'}</td>
    </tr>
  `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Results - AstroImage Well</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background-color: #0f172a; color: #e2e8f0; font-family: 'Inter', sans-serif; }</style>
</head>
<body class="p-4 md:p-8 max-w-6xl mx-auto">
    <div class="flex justify-between items-center mb-6">
        <a href="/" class="text-blue-400 hover:text-blue-300">← Back</a>
        <h1 class="text-2xl font-bold">Observation Session</h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 class="text-slate-400 text-sm uppercase">Moon Status</h3>
            <div class="text-2xl font-bold mt-1 ${moon.illumination > 50 ? 'text-yellow-400' : 'text-slate-200'}">${moon.illumination}%</div>
            <div class="text-sm text-slate-400">Alt: ${moon.altitude}° / ${moon.is_up ? 'UP' : 'DOWN'}</div>
        </div>
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 class="text-slate-400 text-sm uppercase">Location</h3>
            <div class="text-lg mt-1">${loc.lat}, ${loc.lon}</div>
            <div class="text-sm text-slate-400">${loc.time.split('T')[0]}</div>
        </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-700">
        <table class="w-full text-left border-collapse">
            <thead class="bg-slate-900 text-slate-400 uppercase text-xs">
                <tr>
                    <th class="p-3">ID</th>
                    <th class="p-3">Object</th>
                    <th class="p-3 text-center">Score</th>
                    <th class="p-3 text-center">Pos</th>
                    <th class="p-3 text-center sm:table-cell hidden">Mag</th>
                    <th class="p-3 text-center sm:table-cell hidden">FOV</th>
                </tr>
            </thead>
            <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${rows}
            </tbody>
        </table>
    </div>
</body>
</html>
  `;
}
