/**
 * MAP LAYOUT DRAFTER - Elite Export Engine (V7 Master)
 * Features: Print-Mode Viewport, Metric Scale Bar, Line Length Math & Multi-Project Routing.
 */

import { state, CATEGORIES, getActiveProject } from './config.js';
import { map } from './map.js';

// ==========================================
// 1. DEPENDENCY & HELPER ENGINES
// ==========================================
async function ensureHTML2Canvas() {
    if (window.html2canvas) return true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => {
            alert("Network required for first-time PNG/PDF engine initialization.");
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

// Haversine Math for Polyline distance in meters
function calculateLineLengthMeters(coords) {
    let totalMeters = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        totalMeters += L.latLng(coords[i][0], coords[i][1]).distanceTo(L.latLng(coords[i+1][0], coords[i+1][1]));
    }
    return Math.round(totalMeters);
}

// Injects a physical Scale Bar into the DOM just for the picture
function injectGraphicScaleBar() {
    const scaleDiv = document.createElement('div');
    scaleDiv.id = 'export-scale-bar';
    scaleDiv.style.position = 'absolute';
    scaleDiv.style.bottom = '30px';
    scaleDiv.style.right = '30px';
    scaleDiv.style.zIndex = '9999';
    scaleDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    scaleDiv.style.border = '2px solid #000';
    scaleDiv.style.padding = '8px 15px';
    scaleDiv.style.fontFamily = 'monospace';
    scaleDiv.style.fontWeight = '900';
    scaleDiv.style.fontSize = '16px';
    scaleDiv.style.color = '#000';
    scaleDiv.style.boxShadow = '5px 5px 0px rgba(0,0,0,0.2)';
    
    // Calculate real-world distance of 150 pixels at map center
    const center = map.getCenter();
    const pt1 = map.latLngToContainerPoint(center);
    const pt2 = L.point(pt1.x + 150, pt1.y);
    const latlng2 = map.containerPointToLatLng(pt2);
    const distanceMeters = Math.round(center.distanceTo(latlng2));
    
    scaleDiv.innerHTML = `
        <div style="border-bottom: 3px solid #000; border-left: 3px solid #000; border-right: 3px solid #000; height: 10px; width: 150px; margin-bottom: 5px;"></div>
        <div style="text-align: center;">0 &mdash; ${distanceMeters} Meters</div>
    `;
    
    document.getElementById('map').appendChild(scaleDiv);
    return scaleDiv;
}

// ==========================================
// 2. THE PRINT-MODE PNG CAPTURE ENGINE
// ==========================================
export async function generatePNG() {
    const activeProject = getActiveProject();
    if (activeProject.features.length === 0) {
        alert("No layout data to capture in this project! Draw your map first.");
        return null;
    }

    const isReady = await ensureHTML2Canvas();
    if (!isReady) return null;

    const mapContainer = document.getElementById('map');
    
    // SAVE ORIGINAL STATE
    const originalWidth = mapContainer.style.width;
    const originalHeight = mapContainer.style.height;
    const originalPos = mapContainer.style.position;
    
    // THE ELITE FIX: Force Print-Mode Viewport (1200x1200px High-Res Square)
    mapContainer.style.position = 'absolute';
    mapContainer.style.width = '1200px';
    mapContainer.style.height = '1200px';
    
    // Force Leaflet SVG Pane to recalculate lines for the new geometry
    map.invalidateSize(); 
    
    // Hide Tile Pane to prevent CORS poisoning & background noise
    const tilePane = document.querySelector('.leaflet-tile-pane');
    const originalDisplay = tilePane ? tilePane.style.display : '';
    if (tilePane) tilePane.style.display = 'none';

    const scaleDOM = injectGraphicScaleBar();
    
    // Wait exactly 400ms for DOM layout and Leaflet SVG re-rendering to stabilize
    await new Promise(r => setTimeout(r, 400));

    try {
        const canvas = await window.html2canvas(mapContainer, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff', // Force pristine white paper
            scale: 2, // 2400x2400 final output
            logging: false
        });

        // RESTORE ORIGINAL STATE
        if (tilePane) tilePane.style.display = originalDisplay;
        mapContainer.style.position = originalPos;
        mapContainer.style.width = originalWidth;
        mapContainer.style.height = originalHeight;
        if (scaleDOM) scaleDOM.remove();
        map.invalidateSize(); 
        
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error("Canvas capture failed:", err);
        if (tilePane) tilePane.style.display = originalDisplay;
        mapContainer.style.position = originalPos;
        mapContainer.style.width = originalWidth;
        mapContainer.style.height = originalHeight;
        if (scaleDOM) scaleDOM.remove();
        map.invalidateSize();
        alert("Failed to capture map image. Check developer logs.");
        return null;
    }
}

// ==========================================
// 3. THE MULTI-PAGE PDF ENGINE WITH METRICS
// ==========================================
export async function generatePDF() {
    const activeProject = getActiveProject();
    if (activeProject.features.length === 0) {
        alert("No data to export! Please draft the layout first.");
        return;
    }

    if (!window.jspdf) {
        alert("PDF Engine failed to load. Check internet connection for initial load.");
        return;
    }

    const exportBtn = document.getElementById('export-pdf');
    let originalText = "PDF";
    if (exportBtn) {
        originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = "Generating...";
    }

    const mapImageStr = await generatePNG();
    if (!mapImageStr) {
        if (exportBtn) exportBtn.innerHTML = originalText;
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // --- PAGE 1: The Official Drafted Map ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text("OFFICIAL LAYOUT MAP", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(75, 85, 99);
    doc.text(`Area / Block ID: ${state.user.hlbId || "UNSPECIFIED"} | Project: ${activeProject.name}`, 105, 28, { align: "center" });

    // Inject 1200x1200px Image into A4 (180mm x 180mm perfect square)
    doc.addImage(mapImageStr, 'PNG', 15, 35, 180, 180);

    // Footer Metadata
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Drafter Name/ID: ${state.user.enumeratorName || "Unknown"}`, 15, 230);
    doc.text(`Date Drafted: ${new Date().toLocaleDateString()}`, 15, 236);
    doc.text(`Total Elements: ${activeProject.features.length}`, 15, 242);

    // --- PAGE 2+: The Feature Data & Measurement Registry ---
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LAYOUT FEATURE REGISTRY", 105, 20, { align: "center" });

    // Table Headers
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

    activeProject.features.forEach((f, index) => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 20; 
        }

        let cleanName = f.label ? f.label.replace(/\[|\]/g, '') : "-";
        let coords = "";
        let details = "";

        if (f.category === CATEGORIES.BUILDING) {
            details = `Bldg ${f.bldgNo} | Houses: ${f.houseCount} | Scale: ${f.scale}x`;
            coords = `${f.coordinates[0].toFixed(5)}, ${f.coordinates[1].toFixed(5)}`;
        } else if (f.category === CATEGORIES.LINE) {
            const length = calculateLineLengthMeters(f.coordinates);
            details = `${cleanName} | Length: ~${length} Meters`;
            coords = `[Path: ${f.coordinates.length} Nodes]`;
        } else {
            details = `${cleanName} | Scale: ${f.scale}x`;
            coords = `${f.coordinates[0].toFixed(5)}, ${f.coordinates[1].toFixed(5)}`;
        }

        doc.text((index + 1).toString(), 15, yPos);
        doc.text(f.category.toUpperCase(), 30, yPos);
        doc.text(details.substring(0, 45), 65, yPos); 
        doc.text(coords, 145, yPos);

        yPos += 8;
    });

    doc.save(`Layout_Map_${state.user.hlbId || "Draft"}_${activeProject.name.replace(/\s+/g, '')}.pdf`);
    if (exportBtn) exportBtn.innerHTML = originalText;
}

// ==========================================
// 4. DATA EXPORT (CSV & JSON) WITH METRICS
// ==========================================
export function generateCSV() {
    const activeProject = getActiveProject();
    if (activeProject.features.length === 0) return alert("No data to export!");

    let csvContent = "Sl_No,Project,Feature_ID,Category,Type,Building_No,House_Count,Scale,Length_Meters,Feature_Name,Latitude,Longitude\n";

    activeProject.features.forEach((f, index) => {
        const id = f.id || "Unknown";
        const cat = f.category || "Unknown";
        const type = f.type || "Unknown";
        const bNo = f.bldgNo || "N/A";
        const hC = f.houseCount || "N/A";
        const scale = f.scale || 1;
        let lengthMeters = "N/A";
        let label = (f.label || "N/A").replace(/,/g, " "); 

        let lat, lng;
        if (cat === CATEGORIES.LINE) {
            lat = f.coordinates[0][0].toFixed(6);
            lng = f.coordinates[0][1].toFixed(6);
            label = `[Path Start] ${label}`;
            lengthMeters = calculateLineLengthMeters(f.coordinates).toString();
        } else {
            lat = f.coordinates[0].toFixed(6);
            lng = f.coordinates[1].toFixed(6);
        }

        csvContent += `${index + 1},${activeProject.name},${id},${cat},${type},${bNo},${hC},${scale},${lengthMeters},${label},${lat},${lng}\n`;
    });

    triggerFileDownload(csvContent, `DataLog_${activeProject.name}.csv`, 'text/csv;charset=utf-8;');
}

export function generateJSON() {
    const activeProject = getActiveProject();
    if (activeProject.features.length === 0) return alert("No data to export!");
    
    // Attach metric data before exporting
    const enrichedProject = JSON.parse(JSON.stringify(activeProject));
    enrichedProject.features.forEach(f => {
        if (f.category === CATEGORIES.LINE) {
            f.calculatedLengthMeters = calculateLineLengthMeters(f.coordinates);
        }
    });

    const exportData = {
        metadata: state.user,
        projectData: enrichedProject
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    triggerFileDownload(jsonStr, `GIS_Twin_${activeProject.name}.json`, 'application/json');
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