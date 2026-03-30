/**
 * MAP LAYOUT DRAFTER
 * Central Configuration & Omni-Vault State Engine (V8 Master)
 */

export const state = {
    user: { enumeratorName: "", enumeratorId: "", hlbId: "", districtId: "" },
    
    ui: {
        phase: 1,                 
        currentCategory: "hand",  
        currentTool: "pan",       
        smokiness: 0,
        isDarkMode: false,
        isTracingOn: false // V8 Smart Tracing State
    },
    
    gps: { lat: null, lng: null, accuracy: null, isTracking: false },
    
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

export const CATEGORIES = { HAND: 'hand', BUILDING: 'building', LINE: 'line', LANDMARK: 'landmark', ERASER: 'eraser' };

export const TOOLS = {
    PAN: 'pan',
    PUCCA_RES: 'pucca_res', PUCCA_NON_RES: 'pucca_non_res', KUTCHA_RES: 'kutcha_res', KUTCHA_NON_RES: 'kutcha_non_res', 
    LINE_STRAIGHT: 'line_straight', LINE_PATHWAY: 'line_pathway', LINE_UNMETALLED: 'line_unmetalled', LINE_METALLED: 'line_metalled', LINE_MAINROAD: 'line_mainroad', LINE_BOUNDARY: 'line_boundary', LINE_FREEHAND: 'line_freehand',
    
    // V8 Geometry Purge: The Big 4
    LM_SQUARE: 'lm_square',
    LM_CIRCLE: 'lm_circle',
    LM_PENTAGON: 'lm_pentagon',
    LM_HEXAGON: 'lm_hexagon',
    
    ERASER: 'eraser'
};
