/**
 * LAYOUT MAP DRAFTER
 * Central Configuration & State Engine
 * * This file acts as the single source of truth for the application.
 * No UI or Map changes happen without reflecting here first.
 */

// 1. THE GLOBAL STATE OBJECT
export const state = {
    // Phase 1 Metadata
    user: {
        enumeratorName: "",
        enumeratorId: "",
        hlbId: "",
        districtId: ""
    },
    
    // UI & Hardware Status
    ui: {
        phase: 1,                 // 1 = Area Setup, 2 = Drafting Dashboard
        currentCategory: "hand",  // The active Level 1 FAB category
        currentTool: "pan",       // The specific Level 2 tool selected
        smokiness: 0,             // 0 = Full Map, 100 = Pure White Paper
        isAreaLocked: false,      // Triggers the pan-restriction logic
        mapBounds: null           // Stores the L.latLngBounds of the HLB
    },
    
    // Live Geolocation Data
    gps: {
        lat: null,
        lng: null,
        accuracy: null,           // In meters
        isTracking: false
    },
    
    // THE VAULT: Holds every drawn building, line, and landmark
    features: [] 
};

// 2. STRICT CATEGORY ENUMS (Level 1 FAB Menu)
export const CATEGORIES = {
    HAND: 'hand',
    BUILDING: 'building',
    LINE: 'line',
    LANDMARK: 'landmark',
    ERASER: 'eraser'
};

// 3. STRICT TOOL ENUMS (Level 2 Sub-Menus)
// Using these prevents string typos across different JS modules.
export const TOOLS = {
    // Navigation
    PAN: 'pan',
    
    // Buildings
    PUCCA_RES: 'pucca_res',           // Solid Square
    PUCCA_NON_RES: 'pucca_non_res',   // Hatched Square
    KUTCHA_RES: 'kutcha_res',         // Solid Triangle
    KUTCHA_NON_RES: 'kutcha_non_res', // Hatched Triangle
    
    // Lines & Roads
    LINE_STRAIGHT: 'line_straight',
    LINE_PATHWAY: 'line_pathway',
    LINE_UNMETALLED: 'line_unmetalled',
    LINE_METALLED: 'line_metalled',
    LINE_RAILWAY: 'line_railway',
    LINE_BOUNDARY: 'line_boundary',
    LINE_FREEHAND: 'line_freehand',
    
    // Landmarks (Bracketed Text)
    LM_TAP: 'lm_tap',
    LM_HANDPUMP: 'lm_handpump',
    LM_TEMPLE: 'lm_temple',
    LM_MASJID: 'lm_masjid',
    LM_CHURCH: 'lm_church',
    LM_CUSTOM: 'lm_custom',           // Triggers user prompt
    
    // Utilities
    ERASER: 'eraser'
};