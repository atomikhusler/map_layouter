/**
 * MAP LAYOUT DRAFTER - V9 Premium Architecture
 * Central Configuration & Omni-Vault State Engine
 */

export const state = {
    // Core User Identity
    user: { 
        enumeratorName: "", 
        enumeratorId: "", 
        hlbId: "", 
        districtId: "" 
    },
    
    // UI State Engine
    ui: {
        phase: 1,                 
        currentCategory: "hand",  
        currentTool: "pan",       
        smokiness: 0,
        isDarkMode: false
        // Removed failed Smart Tracing state
    },
    
    // Hardware Sensors
    gps: { 
        lat: null, 
        lng: null, 
        accuracy: null, 
        isTracking: false 
    },
    
    // Multi-Draft Memory Banks
    activeProjectId: "draft_1",
    projects: {
        "draft_1": { id: "draft_1", name: "Draft 1", isAreaLocked: false, mapCenterLat: null, mapCenterLng: null, mapZoom: null, mapBounds: null, features: [], undoStack: [], redoStack: [] },
        "draft_2": { id: "draft_2", name: "Draft 2", isAreaLocked: false, mapCenterLat: null, mapCenterLng: null, mapZoom: null, mapBounds: null, features: [], undoStack: [], redoStack: [] },
        "draft_3": { id: "draft_3", name: "Draft 3", isAreaLocked: false, mapCenterLat: null, mapCenterLng: null, mapZoom: null, mapBounds: null, features: [], undoStack: [], redoStack: [] }
    }
};

export function getActiveProject() {
    return state.projects[state.activeProjectId];
}

// Immutable Tool Registries
export const CATEGORIES = { 
    HAND: 'hand', 
    BUILDING: 'building', 
    LINE: 'line', 
    LANDMARK: 'landmark', 
    ERASER: 'eraser' 
};

export const TOOLS = {
    PAN: 'pan',
    
    // Buildings
    PUCCA_RES: 'pucca_res', 
    PUCCA_NON_RES: 'pucca_non_res', 
    KUTCHA_RES: 'kutcha_res', 
    KUTCHA_NON_RES: 'kutcha_non_res', 
    
    // Lines (Railway Added)
    LINE_STRAIGHT: 'line_straight', 
    LINE_PATHWAY: 'line_pathway', 
    LINE_MAINROAD: 'line_mainroad', 
    LINE_RAILWAY: 'line_railway', 
    LINE_FREEHAND: 'line_freehand',
    
    // Landmarks (Strict Big 4)
    LM_SQUARE: 'lm_square',
    LM_CIRCLE: 'lm_circle',
    LM_PENTAGON: 'lm_pentagon',
    LM_HEXAGON: 'lm_hexagon',
    
    ERASER: 'eraser'
};
