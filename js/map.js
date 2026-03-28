/**
 * MAP LAYOUT DRAFTER - Geographic Engine
 * Handles Leaflet setup, Google Satellite Tiles, GPS, and Area Locking.
 */

import { state } from './config.js';

export let map;
export let satelliteLayer;
let userLocationMarker;
let accuracyCircle;

/**
 * Initializes the Leaflet Map in Phase 1 mode
 */
export function initMap() {
    console.log("[Map Engine] Initializing...");

    // Create the Map (Zoom controls disabled for tablet UI)
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: true,
        fadeAnimation: true
    }).setView([20.296, 85.824], 16); // Default fallback: Bhubaneswar

    // Add Google Satellite Hybrid Tiles (detectRetina for high-res tablets)
    satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 22, 
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        detectRetina: true 
    }).addTo(map);

    startGPS();
}

/**
 * Locks the map boundaries to the current viewport (Triggered on Phase 1 -> 2)
 */
export function lockArea() {
    if (!map) return;

    // Get the exact coordinates of the four corners of the screen
    const currentBounds = map.getBounds();
    const currentZoom = map.getZoom();

    // Lock the state
    state.ui.isAreaLocked = true;
    state.ui.mapBounds = currentBounds;

    // Force Leaflet to restrict panning
    map.setMaxBounds(currentBounds);
    
    // Prevent zooming out further than the initial lock zoom
    map.setMinZoom(currentZoom);
    
    // Add a slight "bounce back" friction if they hit the edge
    map.options.maxBoundsViscosity = 1.0; 

    console.log("[Map Engine] Boundaries Locked mathematically.");
}

/**
 * Starts the device GPS and renders the Blue Dot
 */
function startGPS() {
    if (!("geolocation" in navigator)) {
        updateGPSIndicator('red', 'No GPS');
        return;
    }

    const gpsOptions = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
    };

    navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = Math.round(position.coords.accuracy);

            state.gps.lat = lat;
            state.gps.lng = lng;
            state.gps.accuracy = accuracy;

            updateLocationMarker(lat, lng, accuracy);

            // Update UI Color Logic
            if (accuracy <= 10) {
                updateGPSIndicator('green', `${accuracy}m`);
            } else if (accuracy <= 30) {
                updateGPSIndicator('yellow', `${accuracy}m`);
            } else {
                updateGPSIndicator('red', `${accuracy}m`);
            }
        },
        (error) => {
            console.error("[GPS Error]:", error.message);
            updateGPSIndicator('red', 'Lost');
        },
        gpsOptions
    );
}

function updateLocationMarker(lat, lng, accuracy) {
    if (!userLocationMarker) {
        // Initial Blue Dot creation
        userLocationMarker = L.circleMarker([lat, lng], {
            radius: 7,
            fillColor: "#3b82f6",
            color: "#ffffff",
            weight: 2,
            opacity: 1,
            fillOpacity: 1
        }).addTo(map);

        accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            fillColor: "#3b82f6",
            color: "#3b82f6",
            weight: 1,
            opacity: 0.1,
            fillOpacity: 0.1
        }).addTo(map);

        // If Phase 1, automatically pan to the user's location
        if (state.ui.phase === 1) {
            map.setView([lat, lng], 18);
        }
    } else {
        // Move existing markers smoothly
        userLocationMarker.setLatLng([lat, lng]);
        accuracyCircle.setLatLng([lat, lng]);
        accuracyCircle.setRadius(accuracy);
    }
}

function updateGPSIndicator(colorClass, text) {
    const indicator = document.getElementById('gps-status');
    const textLabel = document.getElementById('gps-accuracy-text');
    if (!indicator || !textLabel) return;

    indicator.classList.remove('bg-red-500', 'bg-yellow-400', 'bg-green-500', 'shadow-[0_0_5px_rgba(239,68,68,0.8)]', 'shadow-[0_0_5px_rgba(250,204,21,0.8)]', 'shadow-[0_0_5px_rgba(34,197,94,0.8)]');

    textLabel.innerText = text;

    if (colorClass === 'red') {
        indicator.classList.add('bg-red-500', 'shadow-[0_0_5px_rgba(239,68,68,0.8)]');
        textLabel.classList.add('text-red-400');
    } else if (colorClass === 'yellow') {
        indicator.classList.add('bg-yellow-400', 'shadow-[0_0_5px_rgba(250,204,21,0.8)]');
        textLabel.classList.remove('text-red-400');
    } else if (colorClass === 'green') {
        indicator.classList.add('bg-green-500', 'shadow-[0_0_5px_rgba(34,197,94,0.8)]');
        textLabel.classList.remove('text-red-400');
    }
}