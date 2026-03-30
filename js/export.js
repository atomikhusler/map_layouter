/**
 * MAP LAYOUT DRAFTER - Elite Export Engine (V8 Master)
 * Features: Pure White Schematic Canvas, Dynamic Bounding Boxes, Metric Scale Bar.
 */

import { state, CATEGORIES, getActiveProject } from './config.js';
import { map, currentBaseLayer, toggleSmartTrace } from './map.js';

async function ensureHTML2Canvas() {
    if (window.html2canvas) return true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => { alert("Network required for first-time export initialization."); resolve(false); };
        document.head.appendChild(script);
    });
}

function calculateLineLengthMeters(coords) {
    let totalMeters = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        totalMeters += L.latLng(coords[i][0], coords[i][1]).distanceTo(L.latLng(coords[i+1][0], coords[i+1][1]));
    }
    return Math.round(totalMeters);
}

function injectGraphicScaleBar() {
    const scaleDiv = document.createElement('div');
    scaleDiv.id = 'export-scale-bar';
    scaleDiv.style.position = 'absolute';
    scaleDiv.style.bottom = '30px';
    scaleDiv.style.right = '30px';
    scaleDiv.style.zIndex = '9999';
    scaleDiv.style.backgroundColor = '#ffffff';
    scaleDiv.style.border = '2px solid #000';
    scaleDiv.style.padding = '8px 15px';
    scaleDiv.style.fontFamily = 'monospace';
    scaleDiv.style.fontWeight = '900';
    scaleDiv.style.fontSize = '16px';
    scaleDiv.style.color = '#000';
    
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
// THE V8 WHITE CANVAS CAPTURE ENGINE
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
    
    // 1. Calculate Exact Bounding Box of all drawn features
    const featureGroup = L.featureGroup();
    activeProject.features.forEach(f => {
        if (f.category === CATEGORIES.LINE) L.polyline(f.coordinates).addTo(featureGroup);
        else L.marker(f.coordinates).addTo(featureGroup);
    });
    
    const drawingBounds = featureGroup.getBounds();
    
    // 2. Save Original State
    const originalCenter = map.getCenter();
    const originalZoom = map.getZoom();
    const originalMaxBounds = map.options.maxBounds;
    
    // 3. Initiate The White Canvas Mode
    // Temporarily unrestrict the map so we can frame the photo perfectly
    map.setMaxBounds(null);
    if(drawingBounds.isValid()) {
        // Zoom out to fit the entire drawing with a 10% padding margin
        map.fitBounds(drawingBounds, { padding: [50, 50], animate: false });
    }
    
    // Physically strip the Google Map Tiles and set background to pure white
    if (currentBaseLayer) map.removeLayer(currentBaseLayer);
    toggleSmartTrace(false); // Turn off blue helper lines
    mapContainer.style.backgroundColor = '#ffffff';

    // Deselect any currently selected bounding boxes so they don't print
    document.querySelectorAll('.draft-symbol').forEach(el => el.classList.remove('symbol-selected'));
    
    const scaleDOM = injectGraphicScaleBar();
    
    // Wait for Leaflet to re-calculate vector SVG lines
    await new Promise(r => setTimeout(r, 600));

    try {
        const canvas = await window.html2canvas(mapContainer, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff', // Guarantee white
            scale: 2, 
            logging: false
        });

        // 4. RESTORE ORIGINAL STATE INSTANTLY
        if (currentBaseLayer) currentBaseLayer.addTo(map);
        if (state.ui.isTracingOn) toggleSmartTrace(true);
        mapContainer.style.backgroundColor = '';
        if (scaleDOM) scaleDOM.remove();
        
        map.setMaxBounds(originalMaxBounds);
        map.setView(originalCenter, originalZoom, { animate: false });
        
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error("Canvas capture failed:", err);
        if (currentBaseLayer) currentBaseLayer.addTo(map);
        mapContainer.style.backgroundColor = '';
        if (scaleDOM) scaleDOM.remove();
        map.setMaxBounds(originalMaxBounds);
        map.setView(originalCenter, originalZoom, { animate: false });
        return null;
    }
}

export async function generatePDF() {
    const activeProject = getActiveProject();
    if (activeProject.features.length === 0) return alert("No data to export!");
    if (!window.jspdf) return alert("PDF Engine failed to load.");

    const exportBtn = document.getElementById('export-pdf');
    let originalText = "PDF";
    if (exportBtn) { originalText = exportBtn.innerHTML; exportBtn.innerHTML = "Rendering CAD..."; }

    const mapImageStr = await generatePNG();
    if (!mapImageStr) { if (exportBtn) exportBtn.innerHTML = originalText; return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text("OFFICIAL SCHEMATIC LAYOUT", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(75, 85, 99);
    doc.text(`Area / Block ID: ${state.user.hlbId || "UNSPECIFIED"} | Project: ${activeProject.name}`, 105, 28, { align: "center" });

    // The image is now a perfect white-background vector representation
    doc.addImage(mapImageStr, 'PNG', 15, 35, 180, 180);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Drafter Name/ID: ${state.user.enumeratorName || "Unknown"}`, 15, 230);
    doc.text(`Date Drafted: ${new Date().toLocaleDateString()}`, 15, 236);
    doc.text(`Total Elements: ${activeProject.features.length}`, 15, 242);

    // Page 2: Feature Registry
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

    activeProject.features.forEach((f, index) => {
        if (yPos > 270) { doc.addPage(); yPos = 20; }

        let cleanName = f.label ? f.label.replace(/\[|\]/g, '') : "-";
        let coords = ""; let details = "";

        if (f.category === CATEGORIES.BUILDING) {
            details = `Bldg ${f.bldgNo} | Houses: ${f.houseCount} | Scale: ${f.scale.toFixed(1)}x`;
            coords = `${f.coordinates[0].toFixed(5)}, ${f.coordinates[1].toFixed(5)}`;
        } else if (f.category === CATEGORIES.LINE) {
            const length = calculateLineLengthMeters(f.coordinates);
            details = `${cleanName} | Length: ~${length} Meters`;
            coords = `[Path: ${f.coordinates.length} Nodes]`;
        } else {
            details = `${cleanName} | Scale: ${f.scale.toFixed(1)}x`;
            coords = `${f.coordinates[0].toFixed(5)}, ${f.coordinates[1].toFixed(5)}`;
        }

        doc.text((index + 1).toString(), 15, yPos);
        doc.text(f.category.toUpperCase(), 30, yPos);
        doc.text(details.substring(0, 45), 65, yPos); 
        doc.text(coords, 145, yPos);
        yPos += 8;
    });

    doc.save(`Schematic_${state.user.hlbId || "Draft"}_${activeProject.name.replace(/\s+/g, '')}.pdf`);
    if (exportBtn) exportBtn.innerHTML = originalText;
}

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
    
    const enrichedProject = JSON.parse(JSON.stringify(activeProject));
    enrichedProject.features.forEach(f => {
        if (f.category === CATEGORIES.LINE) {
            f.calculatedLengthMeters = calculateLineLengthMeters(f.coordinates);
        }
    });

    const exportData = { metadata: state.user, projectData: enrichedProject };
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
