/**
 * MAP LAYOUT DRAFTER - Elite Drafting Engine (Sprint 5 Master)
 * Features: Double-Tap Edit, SVG Triangles, Circle Landmarks, Parallel Pathways.
 */

import { state, CATEGORIES, TOOLS } from './config.js';
import { map } from './map.js';
import { saveDraftLocally } from './storage.js';

export const featureLayer = L.featureGroup();
let currentBldgNo = 1;

// Line Drawing State
let isDrawingLine = false;
let activePolylineGroup = null; 
let activeCoordinates = [];

// Inspector State
let activeInspectorFeatureId = null;
let activeInspectorMarker = null;

export function initSymbols() {
    featureLayer.addTo(map);
    setupTouchPhysics();
    setupMapClickRouter();
    initInspectorUI();
    
    // Smooth dynamic scaling bound to map events
    map.on('zoom', scaleDraftSymbols);
    map.on('zoomend', scaleDraftSymbols);

    console.log("[Drafting Engine] V5 Initialized: Double-Tap & Elite Vectors Online.");
}

// ==========================================
// 1. ELITE TOUCH PHYSICS & RUBBER-BANDING
// ==========================================
function setupTouchPhysics() {
    const mapContainer = document.getElementById('map');

    mapContainer.addEventListener('touchstart', (e) => {
        if (state.ui.currentCategory === CATEGORIES.HAND) {
            map.dragging.enable();
            return;
        }

        if (e.touches.length === 1) {
            map.dragging.disable();
            if (state.ui.currentCategory === CATEGORIES.LINE) {
                const rect = mapContainer.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const y = e.touches[0].clientY - rect.top;
                const latlng = map.containerPointToLatLng([x, y]);
                startLine(latlng);
            }
        } else if (e.touches.length > 1) {
            map.dragging.enable();
            if (isDrawingLine) finishLine();
        }
    }, { passive: false });

    mapContainer.addEventListener('touchmove', (e) => {
        if (isDrawingLine && e.touches.length === 1) {
            e.preventDefault(); 
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

function setupMapClickRouter() {
    map.on('click', (e) => {
        const cat = state.ui.currentCategory;
        const tool = state.ui.currentTool;

        if (cat === CATEGORIES.BUILDING) placeBuilding(e.latlng, tool);
        else if (cat === CATEGORIES.LANDMARK) placeLandmark(e.latlng, tool);
    });
}

// ==========================================
// 2. DOUBLE-TAP EDIT & FEATURE EVENTS
// ==========================================
function bindFeatureEvents(layer, featureData) {
    layer.on('click', () => handleFeatureTap(featureData, layer));
    
    // ELITE FIX: Double-Tap is much more reliable on Android than Long-Press
    layer.on('dblclick', () => handleRename(featureData, layer));
}

function handleRename(feature, layer) {
    if (feature.category === CATEGORIES.LANDMARK || feature.category === CATEGORIES.LINE) {
        const rawName = feature.label.replace(/\[|\]/g, '');
        const newName = prompt(`Rename ${feature.category}:`, rawName);
        
        if (newName && newName.trim() !== "") {
            feature.label = `[${newName.trim()}]`;
            
            if (feature.category === CATEGORIES.LANDMARK) {
                layer.setIcon(generateLandmarkIcon(feature.label));
                scaleDraftSymbols();
            } else if (feature.category === CATEGORIES.LINE) {
                // Flash the line blue to confirm edit
                layer.eachLayer(l => {
                    if (l.options.color === '#000' || l.options.color === '#4b5563') {
                        const originalColor = l.options.color;
                        l.setStyle({ color: '#3b82f6' });
                        setTimeout(() => l.setStyle({ color: originalColor }), 500);
                    }
                });
            }
            saveState();
        }
    }
}

// ==========================================
// 3. ELITE VECTOR GENERATORS (Buildings & Landmarks)
// ==========================================

// Utility to extract initials (e.g. "School 1" -> "S1")
function getInitials(fullName) {
    const raw = fullName.replace(/\[|\]/g, '').trim();
    const parts = raw.split(' ');
    let initials = parts[0].charAt(0).toUpperCase();
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (!isNaN(lastPart)) initials += lastPart; // Append number if it ends in one
        else initials += lastPart.charAt(0).toUpperCase(); // Append letter
    }
    return initials.substring(0, 3); // Max 3 chars inside the circle
}

function generateLandmarkIcon(fullName) {
    const initials = getInitials(fullName);
    const iconHtml = `<div class="w-8 h-8 rounded-full border-[2px] border-black bg-white shadow-md flex items-center justify-center font-black text-xs text-black">${initials}</div>`;
    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
    return L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
}

function generateBuildingIcon(tool, bldgNo, houseCount) {
    let iconHtml = '';
    const hatch = `background: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 6px);`;

    if (tool === TOOLS.PUCCA_RES) {
        iconHtml = `<div class="w-7 h-7 border-[2px] border-black bg-white shadow flex items-center justify-center font-bold text-xs">${bldgNo}</div><div class="text-[9px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.PUCCA_NON_RES) {
        iconHtml = `<div class="w-7 h-7 border-[2px] border-black shadow flex items-center justify-center font-bold text-xs bg-white" style="${hatch}"><span class="bg-white/90 px-[1px] rounded">${bldgNo}</span></div><div class="text-[9px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_RES) {
        // ELITE FIX: True Hollow SVG Triangle
        iconHtml = `<div class="relative w-8 h-8 flex items-center justify-center drop-shadow"><svg width="28" height="28" viewBox="0 0 28 28" class="absolute inset-0"><polygon points="14,2 26,26 2,26" fill="white" stroke="black" stroke-width="2"/></svg><span class="relative z-10 text-[9px] font-bold text-black mt-2">${bldgNo}</span></div><div class="text-[9px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_NON_RES) {
        // ELITE FIX: True Hatched SVG Triangle
        iconHtml = `<div class="relative w-8 h-8 flex items-center justify-center drop-shadow"><svg width="28" height="28" viewBox="0 0 28 28" class="absolute inset-0"><defs><pattern id="hatch" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="4" stroke="black" stroke-width="1"/></pattern></defs><polygon points="14,2 26,26 2,26" fill="url(#hatch)" stroke="black" stroke-width="2"/><polygon points="14,2 26,26 2,26" fill="transparent" stroke="black" stroke-width="2"/></svg><span class="relative z-10 text-[9px] font-bold text-black bg-white/90 px-[2px] rounded mt-2">${bldgNo}</span></div><div class="text-[9px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    }

    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
    return L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
}

function placeBuilding(latlng, tool) {
    const featureId = `bldg_${Date.now()}`;
    const bNo = currentBldgNo.toString();
    const hC = "1";

    const divIcon = generateBuildingIcon(tool, bNo, hC);
    const marker = L.marker(latlng, { icon: divIcon }).addTo(featureLayer);

    const featureData = { id: featureId, category: CATEGORIES.BUILDING, type: tool, bldgNo: bNo, houseCount: hC, coordinates: [latlng.lat, latlng.lng] };
    
    bindFeatureEvents(marker, featureData);
    saveState(featureData);
    
    currentBldgNo++;
    scaleDraftSymbols(); 
}

function placeLandmark(latlng, tool) {
    const featureId = `lm_${Date.now()}`;
    let baseName = tool === TOOLS.LM_CUSTOM ? "Landmark 1" : tool.replace('lm_', '');
    baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    
    const label = `[${baseName}]`;
    const divIcon = generateLandmarkIcon(label);
    
    const marker = L.marker(latlng, { icon: divIcon }).addTo(featureLayer);
    const featureData = { id: featureId, category: CATEGORIES.LANDMARK, type: tool, label: label, coordinates: [latlng.lat, latlng.lng] };
    
    bindFeatureEvents(marker, featureData);
    saveState(featureData);
    scaleDraftSymbols();
}

// ==========================================
// 4. PARALLEL & RUBBER-BAND LINE ENGINE
// ==========================================
function startLine(latlng) {
    isDrawingLine = true;
    activeCoordinates = [latlng];
    activePolylineGroup = L.featureGroup().addTo(featureLayer);
    renderLineGraphics(activePolylineGroup, activeCoordinates, state.ui.currentTool);
}

function updateLine(latlng) {
    if (!isDrawingLine || !activePolylineGroup) return;
    
    if (state.ui.currentTool === TOOLS.LINE_STRAIGHT) activeCoordinates[1] = latlng; 
    else activeCoordinates.push(latlng); 
    
    activePolylineGroup.eachLayer(layer => layer.setLatLngs(activeCoordinates));
}

function finishLine() {
    isDrawingLine = false;
    if (activeCoordinates.length > 1) {
        const featureId = `line_${Date.now()}`;
        const coordsArray = activeCoordinates.map(ll => [ll.lat, ll.lng]);
        
        let baseName = state.ui.currentTool.replace('line_', '');
        baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

        const featureData = { id: featureId, category: CATEGORIES.LINE, type: state.ui.currentTool, label: `[${baseName}]`, coordinates: coordsArray };
        
        bindFeatureEvents(activePolylineGroup, featureData);
        saveState(featureData);
    } else if (activePolylineGroup) {
        featureLayer.removeLayer(activePolylineGroup); 
    }
    activePolylineGroup = null;
    activeCoordinates = [];
}

/**
 * Builds the geometric layers of a line, including the FAT HIT-BOX
 */
function renderLineGraphics(group, coords, tool) {
    if (tool === TOOLS.LINE_MAINROAD) {
        L.polyline(coords, { color: '#000', weight: 8 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 4 }).addTo(group);
    } else if (tool === TOOLS.LINE_METALLED) {
        L.polyline(coords, { color: '#000', weight: 5 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 2 }).addTo(group);
    } else if (tool === TOOLS.LINE_PATHWAY) {
        // ELITE FIX: True parallel dashed lines for pathways
        L.polyline(coords, { color: '#000', weight: 6, dashArray: '5, 5' }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 4, dashArray: '5, 5' }).addTo(group);
    } else if (tool === TOOLS.LINE_UNMETALLED) {
        L.polyline(coords, { color: '#4b5563', weight: 5 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 2, dashArray: '5, 5' }).addTo(group);
    } else if (tool === TOOLS.LINE_BOUNDARY) {
        L.polyline(coords, { color: '#000', weight: 4, dashArray: '15, 10, 5, 10' }).addTo(group);
    } else {
        L.polyline(coords, { color: '#000', weight: 3, smoothFactor: 1.0 }).addTo(group);
    }

    // ELITE FIX: Opacity 0.01 makes the hit-box detectable by Android touch sensors
    L.polyline(coords, { color: 'transparent', weight: 30, opacity: 0.01 }).addTo(group);
}

// ==========================================
// 5. INSPECTOR & ERASER LOGIC
// ==========================================
function handleFeatureTap(featureData, layer) {
    if (state.ui.currentCategory === CATEGORIES.ERASER) {
        if (confirm(`Erase this ${featureData.category}?`)) {
            featureLayer.removeLayer(layer);
            state.features = state.features.filter(f => f.id !== featureData.id);
            saveState(); 
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
            
            activeInspectorMarker.setIcon(generateBuildingIcon(feature.type, feature.bldgNo, feature.houseCount));
            scaleDraftSymbols(); 
            saveState();
        }
        panel.classList.add('hidden');
    });

    document.getElementById('btn-delete-feature').addEventListener('click', () => {
        if(confirm("Delete this building?")) {
            state.features = state.features.filter(f => f.id !== activeInspectorFeatureId);
            featureLayer.removeLayer(activeInspectorMarker);
            saveState();
            panel.classList.add('hidden');
        }
    });
}

// ==========================================
// 6. UTILITIES (Anti-Fly Math & Undo Engine)
// ==========================================
function scaleDraftSymbols() {
    const currentZoom = map.getZoom();
    const baseZoom = 18; 
    let scale = Math.pow(1.5, currentZoom - baseZoom);
    // ELITE FIX: Reduced max scale from 3 to 2 so symbols stay reasonably sized
    if (scale > 2) scale = 2; 
    if (scale < 0.2) scale = 0.2;
    
    document.querySelectorAll('.marker-scaler').forEach(el => {
        el.style.transform = `scale(${scale})`;
    });
}

function saveState(newFeature = null) {
    if (newFeature) {
        state.features.push(newFeature);
        state.redoStack = []; 
        state.undoStack.push(JSON.parse(JSON.stringify(state.features)));
    }
    saveDraftLocally();
}

export function redrawAllFeatures() {
    featureLayer.clearLayers();
    let highestBldgNo = 0;

    state.features.forEach(f => {
        if (f.category === CATEGORIES.BUILDING) {
            if (parseInt(f.bldgNo) > highestBldgNo) highestBldgNo = parseInt(f.bldgNo);
            const marker = L.marker(f.coordinates, { icon: generateBuildingIcon(f.type, f.bldgNo, f.houseCount) }).addTo(featureLayer);
            bindFeatureEvents(marker, f);

        } else if (f.category === CATEGORIES.LANDMARK) {
            const marker = L.marker(f.coordinates, { icon: generateLandmarkIcon(f.label) }).addTo(featureLayer);
            bindFeatureEvents(marker, f);
            
        } else if (f.category === CATEGORIES.LINE) {
            const group = L.featureGroup().addTo(featureLayer);
            renderLineGraphics(group, f.coordinates, f.type);
            bindFeatureEvents(group, f);
        }
    });

    currentBldgNo = highestBldgNo + 1;
    scaleDraftSymbols(); 
}