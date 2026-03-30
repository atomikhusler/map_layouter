/**
 * MAP LAYOUT DRAFTER - Elite Drafting Engine (V8 Master)
 * Features: Picsart Bounding Boxes, Touch-Drag Scaling, and Universal Editing.
 */

import { state, CATEGORIES, TOOLS, getActiveProject } from './config.js';
import { map } from './map.js';
import { saveDraftLocally } from './storage.js';

export const featureLayer = L.featureGroup();
let currentBldgNo = 1;

// Line Drawing State
let isDrawingLine = false;
let activePolylineGroup = null; 
let activeCoordinates = [];

// Selection & Resizing State (V8)
export let selectedFeatureId = null;
let isResizing = false;
let resizeStartScale = 1;
let resizeStartY = 0;

// Inspector State
let activeInspectorMarker = null;

export function initSymbols() {
    featureLayer.addTo(map);
    setupTouchPhysics();
    setupMapClickRouter();
    setupResizeDelegation();
    initInspectorUI();
    
    // Smooth dynamic scaling bound to map events
    map.on('zoom', scaleDraftSymbols);
    map.on('zoomend', scaleDraftSymbols);

    console.log("[Drafting Engine] V8 Initialized: Picsart Physics Online.");
}

// ==========================================
// 1. PICSART RESIZE ENGINE (Drag Handling)
// ==========================================
export function deselectAll() {
    selectedFeatureId = null;
    document.querySelectorAll('.draft-symbol').forEach(el => el.classList.remove('symbol-selected'));
}

function setupResizeDelegation() {
    const mapContainer = document.getElementById('map');
    
    // Global click listener to deselect if tapping empty map
    map.on('click', () => {
        if (state.ui.currentCategory === CATEGORIES.HAND) deselectAll();
    });

    mapContainer.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('resize-handle')) {
            e.preventDefault(); // Stop map panning
            isResizing = true;
            map.dragging.disable();
            resizeStartY = e.touches[0].clientY;
            
            // Find the current scale of the selected feature
            const activeProject = getActiveProject();
            const feature = activeProject.features.find(f => f.id === selectedFeatureId);
            resizeStartScale = feature ? (feature.scale || 1) : 1;
        }
    }, { passive: false });

    mapContainer.addEventListener('touchmove', (e) => {
        if (isResizing) {
            e.preventDefault();
            const currentY = e.touches[0].clientY;
            const deltaY = resizeStartY - currentY; // Moving up increases scale
            
            // Sensitivity: 100px drag = 1.0 scale change
            let newScale = resizeStartScale + (deltaY / 100);
            if (newScale < 0.3) newScale = 0.3; // Min bounds
            if (newScale > 5.0) newScale = 5.0; // Max bounds
            
            // Apply visually instantly
            const markerDOM = document.querySelector('.symbol-selected .marker-scaler');
            if (markerDOM) {
                markerDOM.setAttribute('data-scale', newScale.toString());
                scaleDraftSymbols(); // Re-trigger zoom multiplier
            }
            
            // Update data instantly
            const activeProject = getActiveProject();
            const feature = activeProject.features.find(f => f.id === selectedFeatureId);
            if (feature) feature.scale = newScale;
        }
    }, { passive: false });

    mapContainer.addEventListener('touchend', (e) => {
        if (isResizing) {
            isResizing = false;
            map.dragging.enable();
            saveState(); // Commit the resize to Omni-Vault
        }
    });
}

// ==========================================
// 2. ELITE TOUCH PHYSICS & RUBBER-BANDING
// ==========================================
function setupTouchPhysics() {
    const mapContainer = document.getElementById('map');

    mapContainer.addEventListener('touchstart', (e) => {
        if (isResizing) return;
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
        if (isDrawingLine && e.touches.length === 1 && !isResizing) {
            e.preventDefault(); 
            const rect = mapContainer.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            const latlng = map.containerPointToLatLng([x, y]);
            updateLine(latlng);
        }
    }, { passive: false });

    mapContainer.addEventListener('touchend', (e) => {
        if (isDrawingLine && e.touches.length === 0) finishLine();
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
// 3. UNIVERSAL EDIT & SELECTION ROUTER
// ==========================================
function bindFeatureEvents(layer, featureData) {
    layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e); // Stop map click from firing
        handleFeatureTap(featureData, layer);
    });
    // Universal Double-Tap (Works regardless of active tool)
    layer.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        openInspector(featureData, layer);
    });
}

function handleFeatureTap(featureData, layer) {
    if (state.ui.currentCategory === CATEGORIES.ERASER) {
        if (confirm(`Eradicate this ${featureData.category}?`)) {
            featureLayer.removeLayer(layer);
            const activeProject = getActiveProject();
            activeProject.features = activeProject.features.filter(f => f.id !== featureData.id);
            saveState(); 
        }
        return;
    }

    // V8: Selection Physics (Bounding Box Activation)
    if (featureData.category === CATEGORIES.BUILDING || featureData.category === CATEGORIES.LANDMARK) {
        selectedFeatureId = featureData.id;
        redrawAllFeatures(); // Quick refresh to apply selection border
    }
}

// ==========================================
// 4. ELITE VECTOR GENERATORS (V8 Geometry)
// ==========================================
function getInitials(fullName) {
    const raw = fullName.replace(/\[|\]/g, '').trim();
    const parts = raw.split(' ');
    let initials = parts[0].charAt(0).toUpperCase();
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (!isNaN(lastPart)) initials += lastPart; 
        else initials += lastPart.charAt(0).toUpperCase(); 
    }
    return initials.substring(0, 3); 
}

function generateLandmarkIcon(tool, fullName, scaleMultiplier = 1, isSelected = false) {
    const initials = getInitials(fullName);
    let iconHtml = '';
    
    // Base scale dropped from 44px to 24px for tighter mapping
    if (tool === 'lm_square') {
        iconHtml = `<div class="w-6 h-6 border-[2px] border-black bg-white shadow-md flex items-center justify-center font-black text-[10px] text-black">${initials}</div>`;
    } else if (tool === 'lm_pentagon') {
        iconHtml = `<div class="relative w-7 h-7 flex items-center justify-center drop-shadow-md"><svg width="28" height="28" viewBox="0 0 36 36" class="absolute inset-0"><polygon points="18,3 34,14 28,32 8,32 2,14" fill="white" stroke="black" stroke-width="3"/></svg><span class="relative z-10 font-black text-[10px] text-black mt-1">${initials}</span></div>`;
    } else if (tool === 'lm_hexagon') {
        iconHtml = `<div class="relative w-7 h-7 flex items-center justify-center drop-shadow-md"><svg width="28" height="28" viewBox="0 0 36 36" class="absolute inset-0"><polygon points="18,3 32,10 32,26 18,33 4,26 4,10" fill="white" stroke="black" stroke-width="3"/></svg><span class="relative z-10 font-black text-[10px] text-black">${initials}</span></div>`;
    } else {
        // Circle fallback
        iconHtml = `<div class="w-6 h-6 rounded-full border-[2px] border-black bg-white shadow-md flex items-center justify-center font-black text-[10px] text-black">${initials}</div>`;
    }

    const wrapperClass = isSelected ? "draft-symbol symbol-selected" : "draft-symbol";
    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center" data-scale="${scaleMultiplier}">${iconHtml}<div class="resize-handle"></div></div>`;
    return L.divIcon({ className: wrapperClass, html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
}

function generateBuildingIcon(tool, bldgNo, houseCount, scaleMultiplier = 1, isSelected = false) {
    let iconHtml = '';
    const hatch = `background: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 6px);`;

    if (tool === TOOLS.PUCCA_RES) {
        iconHtml = `<div class="w-6 h-6 border-[2px] border-black bg-white shadow flex items-center justify-center font-bold text-[10px]">${bldgNo}</div>`;
    } else if (tool === TOOLS.PUCCA_NON_RES) {
        iconHtml = `<div class="w-6 h-6 border-[2px] border-black shadow flex items-center justify-center font-bold text-[10px] bg-white" style="${hatch}"><span class="bg-white/90 px-[1px] rounded">${bldgNo}</span></div>`;
    } else if (tool === TOOLS.KUTCHA_RES) {
        iconHtml = `<div class="relative w-7 h-7 flex items-center justify-center drop-shadow"><svg width="24" height="24" viewBox="0 0 28 28" class="absolute inset-0"><polygon points="14,2 26,26 2,26" fill="white" stroke="black" stroke-width="2.5"/></svg><span class="relative z-10 text-[9px] font-bold text-black mt-2">${bldgNo}</span></div>`;
    } else if (tool === TOOLS.KUTCHA_NON_RES) {
        iconHtml = `<div class="relative w-7 h-7 flex items-center justify-center drop-shadow"><svg width="24" height="24" viewBox="0 0 28 28" class="absolute inset-0"><defs><pattern id="hatch" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="4" stroke="black" stroke-width="1"/></pattern></defs><polygon points="14,2 26,26 2,26" fill="url(#hatch)" stroke="black" stroke-width="2.5"/><polygon points="14,2 26,26 2,26" fill="transparent" stroke="black" stroke-width="2.5"/></svg><span class="relative z-10 text-[9px] font-bold text-black bg-white/90 px-[2px] rounded mt-2">${bldgNo}</span></div>`;
    }

    const subText = `<div class="text-[8px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    const wrapperClass = isSelected ? "draft-symbol symbol-selected" : "draft-symbol";
    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center" data-scale="${scaleMultiplier}">${iconHtml}${subText}<div class="resize-handle"></div></div>`;
    
    return L.divIcon({ className: wrapperClass, html: wrapperHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
}

function placeBuilding(latlng, tool) {
    const featureId = `bldg_${Date.now()}`;
    const bNo = currentBldgNo.toString();
    const hC = "1";
    
    selectedFeatureId = featureId; // Auto-select new creations
    const featureData = { id: featureId, category: CATEGORIES.BUILDING, type: tool, bldgNo: bNo, houseCount: hC, scale: 1.0, coordinates: [latlng.lat, latlng.lng] };
    
    saveState(featureData);
    currentBldgNo++;
    redrawAllFeatures(); 
}

function placeLandmark(latlng, tool) {
    const featureId = `lm_${Date.now()}`;
    let baseName = tool.replace('lm_', '');
    baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    
    selectedFeatureId = featureId;
    const featureData = { id: featureId, category: CATEGORIES.LANDMARK, type: tool, label: `[${baseName}]`, scale: 1.0, coordinates: [latlng.lat, latlng.lng] };
    
    saveState(featureData);
    redrawAllFeatures();
}

// ==========================================
// 5. LINE ENGINE
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
        saveState(featureData);
        redrawAllFeatures();
    } else if (activePolylineGroup) {
        featureLayer.removeLayer(activePolylineGroup); 
    }
    activePolylineGroup = null;
    activeCoordinates = [];
}

function renderLineGraphics(group, coords, tool) {
    if (tool === TOOLS.LINE_MAINROAD) {
        L.polyline(coords, { color: '#000', weight: 8 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 4 }).addTo(group);
    } else if (tool === TOOLS.LINE_METALLED) {
        L.polyline(coords, { color: '#000', weight: 5 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 2 }).addTo(group);
    } else if (tool === TOOLS.LINE_PATHWAY) {
        L.polyline(coords, { color: '#000', weight: 6, dashArray: '5, 5' }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 4, dashArray: '5, 5' }).addTo(group);
    } else if (tool === TOOLS.LINE_UNMETALLED) {
        L.polyline(coords, { color: '#4b5563', weight: 5 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 2, dashArray: '5, 5' }).addTo(group);
    } else if (tool === TOOLS.LINE_BOUNDARY) {
        L.polyline(coords, { color: '#000', weight: 4, dashArray: '15, 10, 5, 10' }).addTo(group);
    } else {
        L.polyline(coords, { color: '#000', weight: 3, smoothFactor: 1.0 }).addTo(group); // Freehand
    }
    L.polyline(coords, { color: 'transparent', weight: 30, opacity: 0.01 }).addTo(group);
}

// ==========================================
// 6. INSPECTOR UI
// ==========================================
function openInspector(featureData, layer) {
    activeInspectorFeatureId = featureData.id;
    activeInspectorMarker = layer;
    
    const panel = document.getElementById('inspector-panel');
    const overlay = document.getElementById('ui-overlay');

    if (featureData.category === CATEGORIES.BUILDING) {
        document.getElementById('inspect-ref-no').value = featureData.bldgNo;
        document.getElementById('inspect-sub-count').value = (featureData.houseCount || 1).toString();
    } else {
        document.getElementById('inspect-ref-no').value = featureData.label.replace(/\[|\]/g, '');
        document.getElementById('inspect-sub-count').value = (featureData.scale || 1).toString(); // Hidden or locked for landmarks
    }

    overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100', 'z-[190]', 'pointer-events-auto');
    panel.classList.remove('hidden');
    
    setTimeout(() => panel.classList.remove('scale-95', 'opacity-0'), 10);
}

function initInspectorUI() {
    document.getElementById('btn-save-feature').addEventListener('click', () => {
        const activeProject = getActiveProject();
        const feature = activeProject.features.find(f => f.id === activeInspectorFeatureId);
        
        if (feature) {
            const refVal = document.getElementById('inspect-ref-no').value;
            const subVal = document.getElementById('inspect-sub-count').value;

            if (feature.category === CATEGORIES.BUILDING) {
                feature.bldgNo = refVal;
                feature.houseCount = subVal;
            } else if (feature.category === CATEGORIES.LANDMARK) {
                feature.label = `[${refVal}]`;
            }
            
            saveState();
            redrawAllFeatures(); 
        }
        document.getElementById('btn-close-inspector').click();
    });

    document.getElementById('btn-delete-feature').addEventListener('click', () => {
        if(confirm("Delete this feature?")) {
            const activeProject = getActiveProject();
            activeProject.features = activeProject.features.filter(f => f.id !== activeInspectorFeatureId);
            saveState();
            redrawAllFeatures();
            document.getElementById('btn-close-inspector').click();
        }
    });
}

// ==========================================
// 7. UTILITIES & SCALING MATH
// ==========================================
function scaleDraftSymbols() {
    const currentZoom = map.getZoom();
    const baseZoom = 18; 
    let mapScale = Math.pow(1.5, currentZoom - baseZoom);
    if (mapScale > 2.5) mapScale = 2.5; 
    if (mapScale < 0.2) mapScale = 0.2;
    
    document.querySelectorAll('.marker-scaler').forEach(el => {
        const customScale = parseFloat(el.getAttribute('data-scale')) || 1;
        el.style.transform = `scale(${mapScale * customScale})`;
    });
}

function saveState(newFeature = null) {
    const activeProject = getActiveProject();
    if (newFeature) {
        activeProject.features.push(newFeature);
        activeProject.redoStack = []; 
        activeProject.undoStack.push(JSON.parse(JSON.stringify(activeProject.features)));
    }
    saveDraftLocally();
}
export function redrawAllFeatures() {
    featureLayer.clearLayers();
    let highestBldgNo = 0;
    const activeProject = getActiveProject();

    activeProject.features.forEach(f => {
        const isSelected = (f.id === selectedFeatureId);

        if (f.category === CATEGORIES.BUILDING) {
            if (parseInt(f.bldgNo) > highestBldgNo) highestBldgNo = parseInt(f.bldgNo);
            const marker = L.marker(f.coordinates, { icon: generateBuildingIcon(f.type, f.bldgNo, f.houseCount, f.scale, isSelected) }).addTo(featureLayer);
            bindFeatureEvents(marker, f);

        } else if (f.category === CATEGORIES.LANDMARK) {
            const marker = L.marker(f.coordinates, { icon: generateLandmarkIcon(f.type, f.label, f.scale, isSelected) }).addTo(featureLayer);
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