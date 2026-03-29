/**
 * MAP LAYOUT DRAFTER - Drafting Engine (Sprint 3 Master Version)
 * Fixes "Flying" Coordinate Anchors, adds Real-Time Reactivity, and Parallel Lines.
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

    console.log("[Drafting Engine] V3 Initialized: Anti-Fly Anchors & Reactive Engine Online.");
}

// ==========================================
// 1. TOUCH PHYSICS (1-Finger vs 2-Finger)
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

// ==========================================
// 2. TAP ROUTER & MANDATORY PROMPTS
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
// 3. FEATURE PLACEMENT & REACTIVE ICONS
// ==========================================

// Helper: Generates HTML wrapped in .marker-scaler to prevent the "Flying" bug
function generateBuildingIcon(tool, bldgNo, houseCount) {
    let iconHtml = '';
    const hatchStyle = `background: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 6px);`;

    if (tool === TOOLS.PUCCA_RES) {
        iconHtml = `<div class="w-8 h-8 border-[3px] border-black bg-white shadow flex items-center justify-center font-bold text-sm">${bldgNo}</div><div class="text-xs font-bold text-black mt-1 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.PUCCA_NON_RES) {
        iconHtml = `<div class="w-8 h-8 border-[3px] border-black shadow flex items-center justify-center font-bold text-sm bg-white" style="${hatchStyle}"><span class="bg-white/90 px-1 rounded">${bldgNo}</span></div><div class="text-xs font-bold text-black mt-1 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_RES) {
        iconHtml = `<div class="relative w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-black drop-shadow"><div class="absolute top-[8px] -left-[6px] text-[10px] font-bold text-white">${bldgNo}</div></div><div class="text-xs font-bold text-black mt-1 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_NON_RES) {
        iconHtml = `<div class="relative w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-black drop-shadow"><div class="absolute top-[2px] -left-[12px] w-[24px] h-[24px]" style="${hatchStyle}"></div><div class="absolute top-[8px] -left-[6px] text-[10px] font-bold bg-white/90 text-black px-[2px] rounded">${bldgNo}</div></div><div class="text-xs font-bold text-black mt-1 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    }

    // Wrap in the scalar div. Anchor is center of 40x40.
    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
    
    return L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
}

function placeBuilding(latlng, tool) {
    const bldgNo = prompt(`Placing Building.\nEnter Building Sl. No.:`, currentBldgNo.toString());
    if (!bldgNo) return; 
    
    const houseCount = prompt(`Enter No. of House(s) inside Building #${bldgNo}:`, "1");
    if (!houseCount) return;

    const featureId = `bldg_${Date.now()}`;
    const divIcon = generateBuildingIcon(tool, bldgNo, houseCount);
    const marker = L.marker(latlng, { icon: divIcon }).addTo(featureLayer);

    const featureData = {
        id: featureId,
        category: CATEGORIES.BUILDING,
        type: tool,
        bldgNo: bldgNo,
        houseCount: houseCount,
        coordinates: [latlng.lat, latlng.lng]
    };

    state.features.push(featureData);
    marker.on('click', () => handleFeatureTap(featureData, marker));
    
    const parsedNo = parseInt(bldgNo);
    if (!isNaN(parsedNo) && parsedNo >= currentBldgNo) {
        currentBldgNo = parsedNo + 1;
    }
    
    scaleDraftSymbols(); 
    saveDraftLocally();
}

function placeLandmark(latlng, tool) {
    let label = "";
    if (tool === TOOLS.LM_CUSTOM) {
        const input = prompt("Enter Landmark Name:");
        if (!input) return;
        label = `[${input.replace(/\[|\]/g, '')}]`; 
    } else {
        const specificName = prompt(`Name this ${tool.replace('lm_', '')} (Optional):`);
        label = specificName ? `[${specificName}]` : `[${tool.replace('lm_', '')}]`;
    }

    const featureId = `lm_${Date.now()}`;
    const iconHtml = `<div class="font-bold text-sm text-black whitespace-nowrap drop-shadow-md" style="text-shadow: 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;">${label}</div>`;
    
    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
    const divIcon = L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
    
    const marker = L.marker(latlng, { icon: divIcon }).addTo(featureLayer);

    const featureData = { id: featureId, category: CATEGORIES.LANDMARK, type: tool, label: label, coordinates: [latlng.lat, latlng.lng] };
    state.features.push(featureData);
    marker.on('click', () => handleFeatureTap(featureData, marker));
    
    scaleDraftSymbols();
    saveDraftLocally();
}

// ==========================================
// 4. PARALLEL LINE ENGINE
// ==========================================
function startLine(latlng) {
    isDrawingLine = true;
    activeCoordinates = [latlng];
    
    const tool = state.ui.currentTool;
    activePolylineGroup = L.featureGroup().addTo(featureLayer);

    if (tool === TOOLS.LINE_METALLED) {
        L.polyline(activeCoordinates, { color: '#000', weight: 6 }).addTo(activePolylineGroup); 
        L.polyline(activeCoordinates, { color: '#fff', weight: 2 }).addTo(activePolylineGroup); 
    } else if (tool === TOOLS.LINE_UNMETALLED) {
        L.polyline(activeCoordinates, { color: '#4b5563', weight: 6 }).addTo(activePolylineGroup); 
        L.polyline(activeCoordinates, { color: '#fff', weight: 2, dashArray: '5, 5' }).addTo(activePolylineGroup); 
    } else if (tool === TOOLS.LINE_PATHWAY) {
        L.polyline(activeCoordinates, { color: '#000', weight: 2, dashArray: '4, 6' }).addTo(activePolylineGroup);
    } else if (tool === TOOLS.LINE_BOUNDARY) {
        L.polyline(activeCoordinates, { color: '#000', weight: 4, dashArray: '15, 10, 5, 10' }).addTo(activePolylineGroup);
    } else {
        L.polyline(activeCoordinates, { color: '#000', weight: 3, smoothFactor: 1.5 }).addTo(activePolylineGroup);
    }
}

function updateLine(latlng) {
    if (!isDrawingLine || !activePolylineGroup) return;
    activeCoordinates.push(latlng);
    activePolylineGroup.eachLayer(layer => {
        layer.setLatLngs(activeCoordinates);
    });
}

function finishLine() {
    isDrawingLine = false;
    if (activeCoordinates.length > 1) {
        let roadName = prompt("Enter Road/Line Name (Optional):");
        if (!roadName) roadName = state.ui.currentTool.replace('line_', '');

        const featureId = `line_${Date.now()}`;
        const coordsArray = activeCoordinates.map(ll => [ll.lat, ll.lng]);
        
        const featureData = { id: featureId, category: CATEGORIES.LINE, type: state.ui.currentTool, label: roadName, coordinates: coordsArray };
        state.features.push(featureData);
        
        activePolylineGroup.on('click', () => handleFeatureTap(featureData, activePolylineGroup));
        saveDraftLocally();
    } else if (activePolylineGroup) {
        featureLayer.removeLayer(activePolylineGroup); 
    }
    
    activePolylineGroup = null;
    activeCoordinates = [];
}

// ==========================================
// 5. INSPECTOR & REAL-TIME EDIT LOGIC
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
            
            // Instantly applies the new HTML wrapper to the existing map marker
            const newIcon = generateBuildingIcon(feature.type, feature.bldgNo, feature.houseCount);
            activeInspectorMarker.setIcon(newIcon);
            scaleDraftSymbols(); 
            
            saveDraftLocally();
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
// 6. MAP ENGINE UTILITIES (The Anti-Fly Scaler)
// ==========================================

function scaleDraftSymbols() {
    const currentZoom = map.getZoom();
    const baseZoom = 18; 
    
    let scale = Math.pow(1.5, currentZoom - baseZoom);
    if (scale > 3) scale = 3;
    if (scale < 0.2) scale = 0.2;
    
    // Notice we ONLY scale the inner .marker-scaler child!
    // We leave Leaflet's positioning transform on the parent completely untouched.
    document.querySelectorAll('.marker-scaler').forEach(el => {
        el.style.transform = `scale(${scale})`;
    });
}

export function redrawAllFeatures() {
    featureLayer.clearLayers();
    let highestBldgNo = 0;

    state.features.forEach(f => {
        if (f.category === CATEGORIES.BUILDING) {
            if (parseInt(f.bldgNo) > highestBldgNo) highestBldgNo = parseInt(f.bldgNo);
            
            const divIcon = generateBuildingIcon(f.type, f.bldgNo, f.houseCount);
            const marker = L.marker(f.coordinates, { icon: divIcon }).addTo(featureLayer);
            marker.on('click', () => handleFeatureTap(f, marker));

        } else if (f.category === CATEGORIES.LANDMARK) {
            const iconHtml = `<div class="font-bold text-sm text-black whitespace-nowrap drop-shadow-md" style="text-shadow: 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;">${f.label}</div>`;
            const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
            const divIcon = L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
            
            const marker = L.marker(f.coordinates, { icon: divIcon }).addTo(featureLayer);
            marker.on('click', () => handleFeatureTap(f, marker));
            
        } else if (f.category === CATEGORIES.LINE) {
            const group = L.featureGroup().addTo(featureLayer);
            if (f.type === TOOLS.LINE_METALLED) {
                L.polyline(f.coordinates, { color: '#000', weight: 6 }).addTo(group);
                L.polyline(f.coordinates, { color: '#fff', weight: 2 }).addTo(group);
            } else if (f.type === TOOLS.LINE_UNMETALLED) {
                L.polyline(f.coordinates, { color: '#4b5563', weight: 6 }).addTo(group);
                L.polyline(f.coordinates, { color: '#fff', weight: 2, dashArray: '5, 5' }).addTo(group);
            } else if (f.type === TOOLS.LINE_PATHWAY) {
                L.polyline(f.coordinates, { color: '#000', weight: 2, dashArray: '4, 6' }).addTo(group);
            } else if (f.type === TOOLS.LINE_BOUNDARY) {
                L.polyline(f.coordinates, { color: '#000', weight: 4, dashArray: '15, 10, 5, 10' }).addTo(group);
            } else {
                L.polyline(f.coordinates, { color: '#000', weight: 3, smoothFactor: 1.5 }).addTo(group);
            }
            group.on('click', () => handleFeatureTap(f, group));
        }
    });

    currentBldgNo = highestBldgNo + 1;
    scaleDraftSymbols(); 
}
