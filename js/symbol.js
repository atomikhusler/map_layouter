/**
 * MAP LAYOUT DRAFTER - Drafting Engine
 * Handles Touch Physics, Symbol Rendering, Lines, and the Inspector.
 */

import { state, CATEGORIES, TOOLS } from './config.js';
import { map } from './map.js';
import { saveDraftLocally } from './storage.js';

export const featureLayer = L.featureGroup();
let currentBldgNo = 1;

// Line Drawing State
let isDrawingLine = false;
let activePolyline = null;
let activeCoordinates = [];

// Inspector State
let activeInspectorFeatureId = null;
let activeInspectorMarker = null;

export function initSymbols() {
    featureLayer.addTo(map);
    setupTouchPhysics();
    setupMapClickRouter();
    initInspectorUI();
    console.log("[Drafting Engine] Initialized and Layer added.");
}

// ==========================================
// 1. TOUCH PHYSICS (1-Finger vs 2-Finger)
// ==========================================
function setupTouchPhysics() {
    const mapContainer = document.getElementById('map');

    mapContainer.addEventListener('touchstart', (e) => {
        // If we are in HAND mode, let Leaflet do its normal panning
        if (state.ui.currentCategory === CATEGORIES.HAND) {
            map.dragging.enable();
            return;
        }

        // If a Drawing Tool is active...
        if (e.touches.length === 1) {
            // SINGLE FINGER: Disable panning, prepare to draw
            map.dragging.disable();
            
            // If it's a line tool, start drawing
            if (state.ui.currentCategory === CATEGORIES.LINE) {
                const rect = mapContainer.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const y = e.touches[0].clientY - rect.top;
                const latlng = map.containerPointToLatLng([x, y]);
                startLine(latlng);
            }
        } else if (e.touches.length > 1) {
            // TWO FINGERS: Re-enable map panning/zooming
            map.dragging.enable();
            if (isDrawingLine) finishLine(); // Force stop drawing if they pinch
        }
    }, { passive: false });

    mapContainer.addEventListener('touchmove', (e) => {
        if (isDrawingLine && e.touches.length === 1) {
            e.preventDefault(); // Stop scrolling
            const rect = mapContainer.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            const latlng = map.containerPointToLatLng([x, y]);
            updateLine(latlng);
        }
    }, { passive: false });

    mapContainer.addEventListener('touchend', (e) => {
        if (isDrawingLine && e.touches.length === 0) {
            finishLine();
        }
    });
}

// ==========================================
// 2. TAP ROUTER (Buildings & Landmarks)
// ==========================================
function setupMapClickRouter() {
    map.on('click', (e) => {
        const cat = state.ui.currentCategory;
        const tool = state.ui.currentTool;

        if (cat === CATEGORIES.BUILDING) {
            placeBuilding(e.latlng, tool);
        } else if (cat === CATEGORIES.LANDMARK) {
            placeLandmark(e.latlng, tool);
        }
    });
}

// ==========================================
// 3. FEATURE PLACEMENT LOGIC
// ==========================================
function placeBuilding(latlng, tool) {
    const houseCount = prompt(`Placing Building #${currentBldgNo}.\nHow many Census Houses inside?`, "1");
    if (houseCount === null) return;

    const featureId = `bldg_${Date.now()}`;
    let iconHtml = '';

    // Hatched CSS for Non-Residential
    const hatchStyle = `background: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 6px);`;

    if (tool === TOOLS.PUCCA_RES) {
        iconHtml = `<div class="w-8 h-8 border-[3px] border-black bg-white shadow flex items-center justify-center font-bold text-sm">${currentBldgNo}</div><div class="text-xs font-bold text-black mt-1 text-shadow-white">(${houseCount})</div>`;
    } else if (tool === TOOLS.PUCCA_NON_RES) {
        iconHtml = `<div class="w-8 h-8 border-[3px] border-black shadow flex items-center justify-center font-bold text-sm bg-white" style="${hatchStyle}"><span class="bg-white/80 px-1 rounded">${currentBldgNo}</span></div><div class="text-xs font-bold text-black mt-1 text-shadow-white">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_RES) {
        iconHtml = `<div class="relative w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-black drop-shadow"><div class="absolute top-[8px] -left-[6px] text-[10px] font-bold text-white">${currentBldgNo}</div></div><div class="text-xs font-bold text-black mt-1 text-shadow-white">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_NON_RES) {
        iconHtml = `<div class="relative w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-black drop-shadow"><div class="absolute top-[2px] -left-[12px] w-[24px] h-[24px]" style="${hatchStyle}"></div><div class="absolute top-[8px] -left-[6px] text-[10px] font-bold bg-white/80 text-black px-[2px] rounded">${currentBldgNo}</div></div><div class="text-xs font-bold text-black mt-1 text-shadow-white">(${houseCount})</div>`;
    }

    const divIcon = L.divIcon({ className: 'draft-symbol', html: iconHtml, iconSize: [0,0] });
    const marker = L.marker(latlng, { icon: divIcon }).addTo(featureLayer);

    const featureData = {
        id: featureId,
        category: CATEGORIES.BUILDING,
        type: tool,
        bldgNo: currentBldgNo,
        houseCount: houseCount,
        coordinates: [latlng.lat, latlng.lng]
    };

    state.features.push(featureData);
    marker.on('click', () => handleFeatureTap(featureData, marker));
    
    currentBldgNo++;
    saveDraftLocally();
}

function placeLandmark(latlng, tool) {
    let label = "";
    if (tool === TOOLS.LM_CUSTOM) {
        const input = prompt("Enter Landmark Name:");
        if (!input) return;
        label = `[${input.replace(/\[|\]/g, '')}]`; // Strip user brackets to prevent [[Text]]
    } else {
        label = `[${tool.replace('lm_', '')}]`;
    }

    const featureId = `lm_${Date.now()}`;
    const iconHtml = `<div class="font-bold text-sm text-black whitespace-nowrap" style="text-shadow: 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;">${label}</div>`;
    
    const divIcon = L.divIcon({ className: 'draft-symbol', html: iconHtml, iconSize: [0,0] });
    const marker = L.marker(latlng, { icon: divIcon }).addTo(featureLayer);

    const featureData = { id: featureId, category: CATEGORIES.LANDMARK, type: tool, label: label, coordinates: [latlng.lat, latlng.lng] };
    state.features.push(featureData);
    marker.on('click', () => handleFeatureTap(featureData, marker));
    saveDraftLocally();
}

// ==========================================
// 4. LINE DRAWING LOGIC (The Pencil Engine)
// ==========================================
function startLine(latlng) {
    isDrawingLine = true;
    activeCoordinates = [latlng];
    
    let style = { color: '#000000', weight: 3 }; // Default straight line
    const tool = state.ui.currentTool;

    if (tool === TOOLS.LINE_PATHWAY) {
        style.dashArray = '4, 6';
        style.weight = 2;
    } else if (tool === TOOLS.LINE_UNMETALLED) {
        // Thick grey background with dashed white inner line creates "parallel" dashed tracks
        style.color = '#4b5563'; 
        style.weight = 5;
        style.dashArray = '5, 5';
    } else if (tool === TOOLS.LINE_METALLED) {
        // Thick black line creates "parallel" solid tracks
        style.color = '#000000';
        style.weight = 5; 
    } else if (tool === TOOLS.LINE_BOUNDARY) {
        style.dashArray = '15, 10, 5, 10'; 
        style.weight = 4; 
    } else if (tool === TOOLS.LINE_FREEHAND) {
        style.smoothFactor = 1.5; 
        style.weight = 2;
    }

    activePolyline = L.polyline(activeCoordinates, style).addTo(featureLayer);
}

function updateLine(latlng) {
    if (!isDrawingLine || !activePolyline) return;
    activeCoordinates.push(latlng);
    activePolyline.setLatLngs(activeCoordinates);
}

function finishLine() {
    isDrawingLine = false;
    if (activeCoordinates.length > 1) {
        const featureId = `line_${Date.now()}`;
        const coordsArray = activeCoordinates.map(ll => [ll.lat, ll.lng]);
        
        const featureData = { id: featureId, category: CATEGORIES.LINE, type: state.ui.currentTool, coordinates: coordsArray };
        state.features.push(featureData);
        
        activePolyline.on('click', () => handleFeatureTap(featureData, activePolyline));
        saveDraftLocally();
    } else if (activePolyline) {
        // Purge ghost tap (single coordinate line)
        featureLayer.removeLayer(activePolyline);
    }
    
    activePolyline = null;
    activeCoordinates = [];
}

// ==========================================
// 5. INSPECTOR & ERASER LOGIC
// ==========================================
function handleFeatureTap(featureData, layer) {
    if (state.ui.currentCategory === CATEGORIES.ERASER) {
        if (confirm("Delete this feature?")) {
            featureLayer.removeLayer(layer);
            state.features = state.features.filter(f => f.id !== featureData.id);
            saveDraftLocally();
        }
        return;
    }

    if (state.ui.currentCategory === CATEGORIES.HAND && featureData.category === CATEGORIES.BUILDING) {
        activeInspectorFeatureId = featureData.id;
        activeInspectorMarker = layer;
        
        const panel = document.getElementById('inspector-panel');
        document.getElementById('inspect-ref-no').value = featureData.bldgNo;
        document.getElementById('inspect-sub-count').value = featureData.houseCount;
        panel.classList.remove('hidden');
    }
}

function initInspectorUI() {
    const panel = document.getElementById('inspector-panel');

    document.getElementById('btn-save-feature').addEventListener('click', () => {
        const feature = state.features.find(f => f.id === activeInspectorFeatureId);
        if (feature) {
            feature.bldgNo = document.getElementById('inspect-ref-no').value;
            feature.houseCount = document.getElementById('inspect-sub-count').value;
            saveDraftLocally();
            alert("Data Saved. Refresh map to see updated numbers."); // Temporary until redraw function is built
        }
        panel.classList.add('hidden');
    });

    document.getElementById('btn-delete-feature').addEventListener('click', () => {
        if(confirm("Delete this building?")) {
            state.features = state.features.filter(f => f.id !== activeInspectorFeatureId);
            featureLayer.removeLayer(activeInspectorMarker);
            saveDraftLocally();
            panel.classList.add('hidden');
        }
    });
}
// ==========================================
// 6. MAP ENGINE UTILITIES
// ==========================================

/**
 * Ensures div icons scale geographically when zooming out
 */
function scaleDraftSymbols() {
    const currentZoom = map.getZoom();
    const baseZoom = 18; // The zoom level where scale is 1:1
    
    // Prevent it from getting absurdly small or large
    let scale = Math.pow(1.5, currentZoom - baseZoom);
    if (scale > 3) scale = 3;
    if (scale < 0.3) scale = 0.3;
    
    document.querySelectorAll('.draft-symbol').forEach(el => {
        el.style.transform = `scale(${scale})`;
        el.style.transformOrigin = 'center center';
    });
}

/**
 * Rebuilds the map from memory after a page reload
 */
export function redrawAllFeatures() {
    featureLayer.clearLayers();
    let highestBldgNo = 0;

    state.features.forEach(f => {
        if (f.category === CATEGORIES.BUILDING) {
            // Re-sync the counter
            if (f.bldgNo > highestBldgNo) highestBldgNo = parseInt(f.bldgNo);
            
            // Generate Icon
            let iconHtml = '';
            const hatchStyle = `background: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 6px);`;
            
            if (f.type === TOOLS.PUCCA_RES) {
                iconHtml = `<div class="w-8 h-8 border-[3px] border-black bg-white shadow flex items-center justify-center font-bold text-sm">${f.bldgNo}</div><div class="text-xs font-bold text-black mt-1 text-shadow-white">(${f.houseCount})</div>`;
            } else if (f.type === TOOLS.PUCCA_NON_RES) {
                iconHtml = `<div class="w-8 h-8 border-[3px] border-black shadow flex items-center justify-center font-bold text-sm bg-white" style="${hatchStyle}"><span class="bg-white/80 px-1 rounded">${f.bldgNo}</span></div><div class="text-xs font-bold text-black mt-1 text-shadow-white">(${f.houseCount})</div>`;
            } else if (f.type === TOOLS.KUTCHA_RES) {
                iconHtml = `<div class="relative w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-black drop-shadow"><div class="absolute top-[8px] -left-[6px] text-[10px] font-bold text-white">${f.bldgNo}</div></div><div class="text-xs font-bold text-black mt-1 text-shadow-white">(${f.houseCount})</div>`;
            } else if (f.type === TOOLS.KUTCHA_NON_RES) {
                iconHtml = `<div class="relative w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-black drop-shadow"><div class="absolute top-[2px] -left-[12px] w-[24px] h-[24px]" style="${hatchStyle}"></div><div class="absolute top-[8px] -left-[6px] text-[10px] font-bold bg-white/80 text-black px-[2px] rounded">${f.bldgNo}</div></div><div class="text-xs font-bold text-black mt-1 text-shadow-white">(${f.houseCount})</div>`;
            }

            const divIcon = L.divIcon({ className: 'draft-symbol', html: iconHtml, iconSize: [0,0] });
            const marker = L.marker(f.coordinates, { icon: divIcon }).addTo(featureLayer);
            marker.on('click', () => handleFeatureTap(f, marker));

        } else if (f.category === CATEGORIES.LANDMARK) {
            const iconHtml = `<div class="font-bold text-sm text-black whitespace-nowrap" style="text-shadow: 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;">${f.label}</div>`;
            const divIcon = L.divIcon({ className: 'draft-symbol', html: iconHtml, iconSize: [0,0] });
            const marker = L.marker(f.coordinates, { icon: divIcon }).addTo(featureLayer);
            marker.on('click', () => handleFeatureTap(f, marker));
            
        } else if (f.category === CATEGORIES.LINE) {
            let style = { color: '#000000', weight: 3 };
            if (f.type === TOOLS.LINE_PATHWAY) { style.dashArray = '4, 6'; style.weight = 2; }
            if (f.type === TOOLS.LINE_UNMETALLED) { style.color = '#4b5563'; style.weight = 5; style.dashArray = '5, 5'; }
            if (f.type === TOOLS.LINE_METALLED) { style.weight = 5; }
            if (f.type === TOOLS.LINE_BOUNDARY) { style.dashArray = '15, 10, 5, 10'; style.weight = 4; }
            
            const polyline = L.polyline(f.coordinates, style).addTo(featureLayer);
            polyline.on('click', () => handleFeatureTap(f, polyline));
        }
    });

    currentBldgNo = highestBldgNo + 1;
    console.log(`[Drafting Engine] Redrew all features. Next Bldg No: ${currentBldgNo}`);
    
    // Attach geographic scaling to map zoom events
    map.off('zoomend', scaleDraftSymbols); // Prevent duplicate listeners
    map.on('zoomend', scaleDraftSymbols);
    scaleDraftSymbols(); // Initial scale
}