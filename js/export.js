/**
 * MAP LAYOUT DRAFTER - V9 Premium Architecture
 * Elite Export Engine (Pure White CAD Canvas & Filtered Reports)
 * Fixes: Flawless White Background Capture, Removed Scale Bar, Filtered Line Data.
 */

import { state, CATEGORIES, getActiveProject } from './config.js';
import { map } from './map.js';

async function ensureHTML2Canvas() {
    if (window.html2canvas) return true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => { 
            alert("Network connection required for the first-time export initialization."); 
            resolve(false); 
        };
        document.head.appendChild(script);
    });
}

// ==========================================
// 1. THE V9 PURE CAD CANVAS CAPTURE
// ==========================================
export async function generatePNG() {
    const activeProject = getActiveProject();
    if (!activeProject || activeProject.features.length === 0) {
        alert("No layout data to capture! Draw your map first.");
        return null;
    }

    const isReady = await ensureHTML2Canvas();
    if (!isReady) return null;

    const mapContainer = document.getElementById('map');
    if (!(mapContainer instanceof HTMLElement)) return null;
    
    // 1. Calculate Exact Bounding Box of all drawn features
    const featureGroup = L.featureGroup();
    activeProject.features.forEach(f => {
        if (f.category === CATEGORIES.LINE) {
            L.polyline(f.coordinates).addTo(featureGroup);
        } else {
            L.marker(f.coordinates).addTo(featureGroup);
        }
    });
    
    const drawingBounds = featureGroup.getBounds();
    
    // 2. Save Original Map State
    const originalCenter = map.getCenter();
    const originalZoom = map.getZoom();
    const originalMaxBounds = map.options.maxBounds;
    
    // 3. Initiate The Pure White Canvas Mode
    map.setMaxBounds(null);
    if(drawingBounds.isValid()) {
        // Center the camera perfectly on the drawing with a 50px margin
        map.fitBounds(drawingBounds, { padding: [50, 50], animate: false });
    }
    
    // Physically hide satellite tiles and force white background
    const tilePane = document.querySelector('.leaflet-tile-pane');
    if (tilePane instanceof HTMLElement) {
        tilePane.style.visibility = 'hidden';
    }
    
    const originalBg = mapContainer.style.backgroundColor;
    mapContainer.style.backgroundColor = '#ffffff';

    // Deselect any currently selected bounding boxes so blue dashed lines don't print
    document.querySelectorAll('.draft-symbol').forEach(el => {
        if (el instanceof HTMLElement) el.classList.remove('symbol-selected');
    });
    
    // Wait for Leaflet to mathematically re-render vector SVG lines
    await new Promise(r => setTimeout(r, 600));

    try {
        const canvas = await window.html2canvas(mapContainer, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff', 
            scale: 2, 
            logging: false
        });

        // 4. RESTORE ORIGINAL STATE INSTANTLY
        if (tilePane instanceof HTMLElement) tilePane.style.visibility = 'visible';
        mapContainer.style.backgroundColor = originalBg;
        
        map.setMaxBounds(originalMaxBounds);
        map.setView(originalCenter, originalZoom, { animate: false });
        
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error("Canvas capture failed:", err);
        
        // Safety Restore on failure
        if (tilePane instanceof HTMLElement) tilePane.style.visibility = 'visible';
        mapContainer.style.backgroundColor = originalBg;
        map.setMaxBounds(originalMaxBounds);
        map.setView(originalCenter, originalZoom, { animate: false });
        
        return null;
    }
}

// ==========================================
// 2. PDF GENERATOR (Filtered Registry)
// ==========================================
export async function generatePDF() {
    const activeProject = getActiveProject();
    if (!activeProject || activeProject.features.length === 0) return alert("No data to export!");
    if (!window.jspdf) return alert("PDF Engine failed to load.");

    const exportBtn = document.getElementById('export-pdf');
    let originalText = "PDF Canvas";
    if (exportBtn instanceof HTMLElement) { 
        originalText = exportBtn.innerHTML; 
        exportBtn.innerHTML = "Rendering CAD..."; 
    }

    const mapImageStr = await generatePNG();
    if (!mapImageStr) { 
        if (exportBtn instanceof HTMLElement) exportBtn.innerHTML = originalText; 
        return; 
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // --- PAGE 1: The Blueprint ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text("OFFICIAL SCHEMATIC LAYOUT", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(75, 85, 99);
    doc.text(`Area / Block ID: ${state.user.hlbId || "UNSPECIFIED"} | Project: ${activeProject.name}`, 105, 28, { align: "center" });

    // Inject the pure white vector drawing
    doc.addImage(mapImageStr, 'PNG', 15, 35, 180, 180);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Drafter Name/ID: ${state.user.enumeratorName || "Unknown"}`, 15, 230);
    doc.text(`Date Drafted: ${new Date().toLocaleDateString()}`, 15, 236);
    
    // Count only physical structures for the total
    const structuralFeatures = activeProject.features.filter(f => f.category !== CATEGORIES.LINE);
    doc.text(`Total Physical Elements: ${structuralFeatures.length}`, 15, 242);

    // --- PAGE 2: Filtered Feature Registry ---
    if (structuralFeatures.length > 0) {
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("LAYOUT FEATURE REGISTRY", 105, 20, { align: "center" });

        doc.setLineWidth(0.5);
        doc.line(15, 30, 195, 30);
        doc.setFontSize(10);
        doc.text("Sl.", 15, 36);
        doc.text("Category", 30, 36);
        doc.text("Details / Dimensions", 65, 36);
        doc.text("GPS Anchor", 145, 36);
        doc.line(15, 40, 195, 40);

        doc.setFont("helvetica", "normal");
        let yPos = 48;

        // Iterate ONLY through Buildings and Landmarks (Lines excluded per Point 12)
        structuralFeatures.forEach((f, index) => {
            if (yPos > 270) { doc.addPage(); yPos = 20; }

            let cleanName = f.label ? f.label.replace(/\[|\]/g, '') : "-";
            let coords = ""; 
            let details = "";

            if (f.category === CATEGORIES.BUILDING) {
                details = `Bldg ${f.bldgNo} | Houses: ${f.houseCount} | Scale: ${f.scale.toFixed(1)}x`;
                coords = `${f.coordinates[0].toFixed(5)}, ${f.coordinates[1].toFixed(5)}`;
            } else {
                // Landmarks
                details = `${cleanName} | Scale: ${f.scale.toFixed(1)}x`;
                coords = `${f.coordinates[0].toFixed(5)}, ${f.coordinates[1].toFixed(5)}`;
            }

            doc.text((index + 1).toString(), 15, yPos);
            doc.text(f.category.toUpperCase(), 30, yPos);
            doc.text(details.substring(0, 45), 65, yPos); 
            doc.text(coords, 145, yPos);
            yPos += 8;
        });
    }

    doc.save(`Schematic_${state.user.hlbId || "Draft"}_${activeProject.name.replace(/\\s+/g, '')}.pdf`);
    if (exportBtn instanceof HTMLElement) exportBtn.innerHTML = originalText;
}

// ==========================================
// 3. DATA EXPORTS (Filtered)
// ==========================================
export function generateCSV() {
    const activeProject = getActiveProject();
    if (!activeProject || activeProject.features.length === 0) return alert("No data to export!");

    let csvContent = "Sl_No,Project,Feature_ID,Category,Type,Building_No,House_Count,Scale,Feature_Name,Latitude,Longitude\n";

    // Filter out lines for the CSV as well
    const structuralFeatures = activeProject.features.filter(f => f.category !== CATEGORIES.LINE);

    structuralFeatures.forEach((f, index) => {
        const id = f.id || "Unknown";
        const cat = f.category || "Unknown";
        const type = f.type || "Unknown";
        const bNo = f.bldgNo || "N/A";
        const hC = f.houseCount || "N/A";
        const scale = f.scale || 1;
        let label = (f.label || "N/A").replace(/,/g, " "); 
        
        const lat = f.coordinates[0].toFixed(6);
        const lng = f.coordinates[1].toFixed(6);

        csvContent += `${index + 1},${activeProject.name},${id},${cat},${type},${bNo},${hC},${scale},${label},${lat},${lng}\n`;
    });

    triggerFileDownload(csvContent, `DataLog_${activeProject.name}.csv`, 'text/csv;charset=utf-8;');
}

export function generateJSON() {
    const activeProject = getActiveProject();
    if (!activeProject || activeProject.features.length === 0) return alert("No data to export!");
    
    // JSON exports everything (including lines) to act as a true backup file
    const exportData = { metadata: state.user, projectData: activeProject };
    triggerFileDownload(JSON.stringify(exportData, null, 2), `GIS_Twin_${activeProject.name}.json`, 'application/json');
}

function triggerFileDownload(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
