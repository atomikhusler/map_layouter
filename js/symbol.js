/**
 * MAP LAYOUT DRAFTER - Elite Drafting Engine (Sprint 5)
 * Features: Long-Press Naming, Fat Hit-Boxes for Eraser, Rubber-Band Straight Lines, and Parallel Tracks.
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
    
    // Smooth dynamic scaling bound to map events (Anti-Fly Math)
    map.on('zoom', scaleDraftSymbols);
    map.on('zoomend', scaleDraftSymbols);

    console.log("[Drafting Engine] V5 Initialized: Long-Press & Hit-Box Physics Online.");
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
// 2. LONG-PRESS (TAP-AND-HOLD) ENGINE
// ==========================================
function bindFeatureEvents(layer, featureData) {
    let pressTimer;

    const startPress = (e) => {
        // Ignore multi-touch
        if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
        
        // Start 600ms timer for Long-Press
        pressTimer = setTimeout(() => {
            handleLongPress(featureData, layer);
        }, 600); 
    };

    const cancelPress = () => { clearTimeout(pressTimer); };

    // Bind Touch/Mouse Events
    layer.on('mousedown', startPress);
    layer.on('touchstart', startPress);
    
    layer.on('mouseup', cancelPress);
    layer.on('mouseleave', cancelPress);
    layer.on('touchend', cancelPress);
    layer.on('touchmove', cancelPress);

    // Standard Click/Tap Route
    layer.on('click', () => handleFeatureTap(featureData, layer));
}

function handleLongPress(feature, layer) {
    // Only name Landmarks and Lines on Long Press
    if (feature.category === CATEGORIES.LANDMARK || feature.category === CATEGORIES.LINE) {
        const newName = prompt(`Enter name for this ${feature.category}:`, feature.label.replace(/\[|\]/g, ''));
        if (newName && newName.trim() !== "") {
            feature.label = `[${newName.trim()}]`;
            
            // If landmark, physically update the text on the map instantly
            if (feature.category === CATEGORIES.LANDMARK) {
                const iconHtml = `<div class="font-bold text-sm text-black whitespace-nowrap drop-shadow-md text-shadow-white">${feature.label}</div>`;
                const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
                layer.setIcon(L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] }));
                scaleDraftSymbols();
            } else if (feature.category === CATEGORIES.LINE) {
                // Flash the road blue to confirm it was named
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
// 3. SILENT PLACEMENT (No Prompts)
// ==========================================
function generateBuildingIcon(tool, bldgNo, houseCount) {
    let iconHtml = '';
    const hatchStyle = `background: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 6px);`;

    if (tool === TOOLS.PUCCA_RES) {
        iconHtml = `<div class="w-8 h-8 border-[3px] border-black bg-white shadow flex items-center justify-center font-bold text-sm">${bldgNo}</div><div class="text-[10px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.PUCCA_NON_RES) {
        iconHtml = `<div class="w-8 h-8 border-[3px] border-black shadow flex items-center justify-center font-bold text-sm bg-white" style="${hatchStyle}"><span class="bg-white/90 px-1 rounded">${bldgNo}</span></div><div class="text-[10px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_RES) {
        iconHtml = `<div class="relative w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-black drop-shadow"><div class="absolute top-[8px] -left-[6px] text-[10px] font-bold text-white">${bldgNo}</div></div><div class="text-[10px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_NON_RES) {
        iconHtml = `<div class="relative w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-black drop-shadow"><div class="absolute top-[2px] -left-[12px] w-[24px] h-[24px]" style="${hatchStyle}"></div><div class="absolute top-[8px] -left-[6px] text-[10px] font-bold bg-white/90 text-black px-[2px] rounded">${bldgNo}</div></div><div class="text-[10px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    }

    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
    return L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
}

function placeBuilding(latlng, tool) {
    const featureId = `bldg_${Date.now()}`;
    const bNo = currentBldgNo.toString();
    const hC = "1"; // Default

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
    let baseName = tool === TOOLS.LM_CUSTOM ? "Landmark" : tool.replace('lm_', '');
    // Capitalize first letter
    baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    
    const label = `[${baseName}]`;
    const iconHtml = `<div class="font-bold text-sm text-black whitespace-nowrap drop-shadow-md text-shadow-white">${label}</div>`;
    
    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
    const divIcon = L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
    
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
    
    // RUBBER BAND LOGIC: Straight Line only uses Start and End point
    if (state.ui.currentTool === TOOLS.LINE_STRAIGHT) {
        activeCoordinates[1] = latlng; // Overwrite second point
    } else {
        activeCoordinates.push(latlng); // Freehand continues adding points
    }
    
    activePolylineGroup.eachLayer(layer => {
        layer.setLatLngs(activeCoordinates);
    });
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
        featureLayer.removeLayer(activePolylineGroup); // Purge ghost taps
    }
    activePolylineGroup = null;
    activeCoordinates = [];
}

/**
 * Builds the geometric layers of a line, including the FAT HIT-BOX
 */
function renderLineGraphics(group, coords, tool) {
    // 1. The Visible Line Rendering
    if (tool === TOOLS.LINE_MAINROAD) {
        // True Parallel Black Lines (8px black underneath, 4px white inside)
        L.polyline(coords, { color: '#000', weight: 8 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 4 }).addTo(group);
    } else if (tool === TOOLS.LINE_METALLED) {
        L.polyline(coords, { color: '#000', weight: 5 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 2 }).addTo(group);
    } else if (tool === TOOLS.LINE_UNMETALLED) {
        L.polyline(coords, { color: '#4b5563', weight: 5 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 2, dashArray: '5, 5' }).addTo(group);
    } else if (tool === TOOLS.LINE_PATHWAY) {
        L.polyline(coords, { color: '#000', weight: 2, dashArray: '4, 6' }).addTo(group);
    } else if (tool === TOOLS.LINE_BOUNDARY) {
        L.polyline(coords, { color: '#000', weight: 4, dashArray: '15, 10, 5, 10' }).addTo(group);
    } else {
        // Straight and Freehand defaults
        L.polyline(coords, { color: '#000', weight: 3, smoothFactor: 1.0 }).addTo(group);
    }

    // 2. THE FAT HIT-BOX (Secret transparent 30px line to catch Eraser taps)
    L.polyline(coords, { color: 'transparent', weight: 30, opacity: 0 }).addTo(group);
}

// ==========================================
// 5. INSPECTOR & ERASER LOGIC
// ==========================================
function handleFeatureTap(featureData, layer) {
    // Erase Route
    if (state.ui.currentCategory === CATEGORIES.ERASER) {
        if (confirm(`Erase this ${featureData.category}?`)) {
            featureLayer.removeLayer(layer);
            state.features = state.features.filter(f => f.id !== featureData.id);
            // Push removal to undo stack
            saveState(); 
        }
        return;
    }

    // Inspect Building Route (Hand Tool)
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
            
            const newIcon = generateBuildingIcon(feature.type, feature.bldgNo, feature.houseCount);
            activeInspectorMarker.setIcon(newIcon);
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
    if (scale > 3) scale = 3;
    if (scale < 0.2) scale = 0.2;
    
    document.querySelectorAll('.marker-scaler').forEach(el => {
        el.style.transform = `scale(${scale})`;
    });
}

function saveState(newFeature = null) {
    if (newFeature) {
        state.features.push(newFeature);
        // Wipe redo stack on new action
        state.redoStack = []; 
        // Push full state copy to Undo Stack
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
            const divIcon = generateBuildingIcon(f.type, f.bldgNo, f.houseCount);
            const marker = L.marker(f.coordinates, { icon: divIcon }).addTo(featureLayer);
            bindFeatureEvents(marker, f);

        } else if (f.category === CATEGORIES.LANDMARK) {
            const iconHtml = `<div class="font-bold text-sm text-black whitespace-nowrap drop-shadow-md text-shadow-white">${f.label}</div>`;
            const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75">${iconHtml}</div>`;
            const divIcon = L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
            const marker = L.marker(f.coordinates, { icon: divIcon }).addTo(featureLayer);
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
