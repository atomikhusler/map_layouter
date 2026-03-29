/**
 * LAYOUT MAP DRAFTER
 * Central Configuration & State Engine
 */

export const state = {
    user: {
        enumeratorName: "",
        enumeratorId: "",
        hlbId: "",
        districtId: ""
    },
    
    ui: {
        phase: 1,                 
        currentCategory: "hand",  
        currentTool: "pan",       
        smokiness: 0,             
        isAreaLocked: false,      
        mapBounds: null           
    },
    
    gps: {
        lat: null,
        lng: null,
        accuracy: null,           
        isTracking: false
    },
    
    // THE VAULT
    features: [],
    
    // UNDO/REDO MEMORY BANKS
    undoStack: [],
    redoStack: []
};

export const CATEGORIES = {
    HAND: 'hand',
    BUILDING: 'building',
    LINE: 'line',
    LANDMARK: 'landmark',
    ERASER: 'eraser'
};

export const TOOLS = {
    PAN: 'pan',
    
    PUCCA_RES: 'pucca_res',           
    PUCCA_NON_RES: 'pucca_non_res',   
    KUTCHA_RES: 'kutcha_res',         
    KUTCHA_NON_RES: 'kutcha_non_res', 
    
    // Upgraded Line Tools
    LINE_STRAIGHT: 'line_straight',
    LINE_PATHWAY: 'line_pathway',
    LINE_UNMETALLED: 'line_unmetalled',
    LINE_METALLED: 'line_metalled',
    LINE_MAINROAD: 'line_mainroad', // NEW: True Parallel Black Lines
    LINE_BOUNDARY: 'line_boundary',
    LINE_FREEHAND: 'line_freehand',
    
    LM_TAP: 'lm_tap',
    LM_HANDPUMP: 'lm_handpump',
    LM_TEMPLE: 'lm_temple',
    LM_MASJID: 'lm_masjid',
    LM_CHURCH: 'lm_church',
    LM_CUSTOM: 'lm_custom',           
    
    ERASER: 'eraser'
};
