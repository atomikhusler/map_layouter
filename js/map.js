/**
 * MAP LAYOUT DRAFTER - Geographic Engine (Final Master)
 * Cures "Trapped Viewport" via Omni-Vault Viewport Anchoring.
 */

import { state } from './config.js';

export let map;
export let currentBaseLayer;
let satelliteLayer;
let terrainLayer;
let darkLayer;

let userLocationMarker;
let accuracyCircle;
export let isGPSActive = false;
let watchId = null;

/**
 * Initializes the Leaflet Map with Omni-Vault Memory
 */
export function initMap() {
    console.log("[Map Engine] Initializing V6 Omni-Vault Anchor...");

    // Default Fallback (Bhubaneswar)
    let startLat = 20.296;
    let startLng = 85.824;
    let startZoom = 14;

    // ELITE FIX: If the Omni-Vault has saved our exact location, teleport there first!
    if (state.ui.mapCenterLat && state.ui.mapCenterLng) {
        startLat = state.ui.mapCenterLat;
        startLng = state.ui.mapCenterLng;
        startZoom = state.ui.mapZoom || 17;
        console.log(`[Map Engine] Viewport Anchor found. Teleporting to ${startLat}, ${startLng}`);
    }

    map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: true,
        fadeAnimation: true
    }).setView([startLat, startLng], startZoom); 

    // Pre-load all professional Tile Layers
    satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 22, detectRetina: true });
    terrainLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { maxZoom: 22, detectRetina: true });
    darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 22, subdomains: 'abcd' });

    currentBaseLayer = satelliteLayer.addTo(map);
    
    updateGPSIndicator('gray', 'Off');
}

/**
 * Locks the map boundaries and saves the Anchor to the Omni-Vault
 */
export function lockArea() {
    if (!map) return;

    const currentBounds = map.getBounds();
    const currentZoom = map.getZoom();
    const currentCenter = map.getCenter();

    state.ui.isAreaLocked = true;
    
    // ELITE FIX: Save exact coordinates into state so Omni-Vault can back them up
    state.ui.mapCenterLat = currentCenter.lat;
    state.ui.mapCenterLng = currentCenter.lng;
    state.ui.mapZoom = currentZoom;
    state.ui.mapBounds = currentBounds;

    map.setMaxBounds(currentBounds);
    map.setMinZoom(currentZoom);
    map.options.maxBoundsViscosity = 1.0; 

    console.log("[Map Engine] Area Locked & Viewport Anchored.");
}

/**
 * Swaps the base tile layer
 */
export function toggleBaseMap(type) {
    if (currentBaseLayer) map.removeLayer(currentBaseLayer);
    
    if (type === 'satellite') currentBaseLayer = satelliteLayer.addTo(map);
    else if (type === 'terrain') currentBaseLayer = terrainLayer.addTo(map);
    else if (type === 'dark') currentBaseLayer = darkLayer.addTo(map);
}

/**
 * Manually starts or stops the GPS engine
 */
export function toggleGPS() {
    if (isGPSActive) {
        // Turn Off
        navigator.geolocation.clearWatch(watchId);
        if (userLocationMarker) map.removeLayer(userLocationMarker);
        if (accuracyCircle) map.removeLayer(accuracyCircle);
        userLocationMarker = null;
        accuracyCircle = null;
        isGPSActive = false;
        state.ui.hasPannedToGPS = false; 
        updateGPSIndicator('gray', 'Off');
    } else {
        // Turn On
        isGPSActive = true;
        state.ui.hasPannedToGPS = false; 
        updateGPSIndicator('yellow', 'Locating...');
        startGPS();
    }
}

function startGPS() {
    if (!("geolocation" in navigator)) {
        updateGPSIndicator('red', 'No Sensor');
        isGPSActive = false;
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = Math.round(position.coords.accuracy);

            state.gps.lat = lat;
            state.gps.lng = lng;
            state.gps.accuracy = accuracy;

            if (!state.ui.hasPannedToGPS && accuracy <= 100) {
                map.flyTo([lat, lng], 18, { duration: 1.5 });
                state.ui.hasPannedToGPS = true; 
            }

            updateLocationMarker(lat, lng, accuracy);

            if (accuracy <= 10) updateGPSIndicator('green', `${accuracy}m`);
            else if (accuracy <= 30) updateGPSIndicator('yellow', `${accuracy}m`);
            else updateGPSIndicator('red', `${accuracy}m`);
        },
        (error) => {
            console.error("[GPS Error]:", error.message);
            updateGPSIndicator('red', 'Signal Lost');
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
}

function updateLocationMarker(lat, lng, accuracy) {
    if (!userLocationMarker) {
        userLocationMarker = L.circleMarker([lat, lng], { radius: 7, fillColor: "#3b82f6", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 1, zIndexOffset: 1000 }).addTo(map);
        accuracyCircle = L.circle([lat, lng], { radius: accuracy, fillColor: "#3b82f6", color: "#3b82f6", weight: 1, opacity: 0.1, fillOpacity: 0.1 }).addTo(map);
    } else {
        userLocationMarker.setLatLng([lat, lng]);
        accuracyCircle.setLatLng([lat, lng]);
        accuracyCircle.setRadius(accuracy);
    }
}

function updateGPSIndicator(colorClass, text) {
    const indicator = document.getElementById('gps-status');
    const textLabel = document.getElementById('gps-accuracy-text');
    if (!indicator || !textLabel) return;

    indicator.className = 'w-3 h-3 rounded-full transition-colors'; 
    textLabel.className = 'text-[10px] font-mono font-bold text-gray-600 dark:text-gray-400';

    if (colorClass === 'red') {
        indicator.classList.add('bg-red-500', 'shadow-[0_0_5px_rgba(239,68,68,0.8)]');
        textLabel.classList.add('!text-red-500');
    } else if (colorClass === 'yellow') {
        indicator.classList.add('bg-yellow-400', 'shadow-[0_0_5px_rgba(250,204,21,0.8)]');
        textLabel.classList.add('!text-yellow-500');
    } else if (colorClass === 'green') {
        indicator.classList.add('bg-green-500', 'shadow-[0_0_5px_rgba(34,197,94,0.8)]');
        textLabel.classList.add('!text-green-500');
    } else if (colorClass === 'gray') {
        indicator.classList.add('bg-gray-400');
    }
    
    textLabel.innerText = text;
}
