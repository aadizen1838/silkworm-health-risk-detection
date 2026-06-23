// Auth DOM Elements
const loginOverlay = document.getElementById('loginOverlay');
const appContainer = document.getElementById('appContainer');
const displayUser = document.getElementById('displayUser');

// Operational Core Elements
const mediaInput = document.getElementById('mediaInput');
const dropzone = document.getElementById('dropzone');
const previewBox = document.getElementById('previewBox');
const mediaPreview = document.getElementById('mediaPreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');

// Output Desk Elements
const emptyState = document.getElementById('emptyState');
const activeContent = document.getElementById('activeContent');
const scoreCard = document.getElementById('scoreCard');
const riskLabel = document.getElementById('riskLabel');
const visionMeta = document.getElementById('visionMeta');
const sopList = document.getElementById('sopList');
const loader = document.getElementById('loader');
const btnText = document.getElementById('btnText');

// Sidebar Elements
const sidebarNetworkState = document.getElementById('sidebarNetworkState');
const sidebarSyncQueueCount = document.getElementById('sidebarSyncQueueCount');
const batchHistoryMenu = document.getElementById('batchHistoryMenu');
const sopMenu = document.getElementById('sopMenu');
const liveRiskMenu = document.getElementById('liveRiskMenu');

let uploadedFile = null;
let base64MediaString = null;

// ========================================================
// FRONTEND BYPASS & ROLE ASSIGNMENT ENGINE
// ========================================================
function handleLogin(event) {
    event.preventDefault();
    
    const inputUsername = document.getElementById('username').value;
    const selectedRole = document.getElementById('userRole').value;
    
    loginOverlay.style.display = 'none';
    appContainer.style.display = 'flex';
    
    displayUser.innerText = inputUsername || "Authorized User";
    document.querySelector('.user-info small').innerText = `${selectedRole} Account`;
    
    window.currentUserRole = selectedRole;
    refreshSidebarWidgets();
}

function handleLogout() {
    appContainer.style.display = 'none';
    loginOverlay.style.display = 'flex';
    document.getElementById('password').value = '';
}

// Media Handling Hooks
dropzone.addEventListener('click', () => mediaInput.click());

mediaInput.addEventListener('change', function(e) {
    if (e.target.files.length === 0) return;
    uploadedFile = e.target.files[0];
    
    const reader = new FileReader();
    reader.onload = function(event) {
        mediaPreview.src = event.target.result;
        base64MediaString = event.target.result;
        dropzone.style.display = 'none';
        previewBox.style.display = 'flex';
        analyzeBtn.disabled = false;
        updateButtonText();
    };
    reader.readAsDataURL(uploadedFile);
});

window.addEventListener('online', () => { updateButtonText(); refreshSidebarWidgets(); syncOfflineData(); });
window.addEventListener('offline', () => { updateButtonText(); refreshSidebarWidgets(); });

function updateButtonText() {
    if (navigator.onLine) {
        btnText.innerText = "Execute Diagnosis Pipeline";
        analyzeBtn.style.background = "var(--primary-accent)";
    } else {
        btnText.innerText = "Capture Data Offline (Save locally)";
        analyzeBtn.style.background = "#2563eb"; 
    }
}

function refreshSidebarWidgets() {
    let offlineQueue = JSON.parse(localStorage.getItem('silkworm_offline_queue')) || [];
    sidebarSyncQueueCount.innerText = `${offlineQueue.length} Records`;
    
    if (navigator.onLine) {
        sidebarNetworkState.innerText = "Online";
        sidebarNetworkState.className = "status-online";
    } else {
        sidebarNetworkState.innerText = "Offline";
        sidebarNetworkState.className = "status-offline";
    }
}

clearBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    uploadedFile = null;
    base64MediaString = null;
    mediaInput.value = '';
    previewBox.style.display = 'none';
    dropzone.style.display = 'block';
    analyzeBtn.disabled = true;
    emptyState.style.display = 'block';
    activeContent.style.display = 'none';
});

async function handleAssessment() {
    if (!uploadedFile) return;
    if (navigator.onLine) {
        await sendLiveAssessmentRequest();
    } else {
        saveAssessmentOffline();
    }
}

async function sendLiveAssessmentRequest() {
    const formData = new FormData();
    formData.append('media', uploadedFile);
    formData.append('temperature', document.getElementById('tempInput').value);
    formData.append('humidity', document.getElementById('humidityInput').value);
    formData.append('ventilation_poor', document.getElementById('ventCheck').checked);
    formData.append('hygiene_poor', document.getElementById('hygieneCheck').checked);

    analyzeBtn.disabled = true;
    btnText.style.display = 'none';
    loader.style.display = 'block';

    try {
        const response = await fetch('http://127.0.0.1:5000/api/assess-health', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (response.ok) {
            renderResultsOnUI(data);
        } else {
            alert("Error processing pipeline: " + data.error);
        }
    } catch (err) {
        alert("Could not reach server. Caching record locally.");
        saveAssessmentOffline();
    } finally {
        loader.style.display = 'none';
        btnText.style.display = 'inline';
        analyzeBtn.disabled = false;
        updateButtonText();
    }
}

function saveAssessmentOffline() {
    const offlineRecord = {
        timestamp: new Date().toISOString(),
        temperature: document.getElementById('tempInput').value,
        humidity: document.getElementById('humidityInput').value,
        ventilation_poor: document.getElementById('ventCheck').checked,
        hygiene_poor: document.getElementById('hygieneCheck').checked,
        mediaData: base64MediaString,
        fileName: uploadedFile.name
    };

    let offlineQueue = JSON.parse(localStorage.getItem('silkworm_offline_queue')) || [];
    offlineQueue.push(offlineRecord);
    localStorage.setItem('silkworm_offline_queue', JSON.stringify(offlineQueue));

    refreshSidebarWidgets();

    emptyState.style.display = 'none';
    activeContent.style.display = 'block';
    
    riskLabel.innerText = "QUEUED OFFLINE";
    riskLabel.style.color = "#2563eb";
    scoreCard.style.backgroundColor = "rgba(37, 99, 235, 0.05)";
    scoreCard.style.border = "2px dashed #2563eb";
    visionMeta.innerText = "Connection lost. Encoded string stored inside local device cache.";
    
    sopList.innerHTML = `
        <li><strong>Status:</strong> Parameter blocks buffered locally.</li>
        <li><strong>Deferred Sync:</strong> Processing pipeline will automatically push queue to host server upon Wi-Fi handshake.</li>
    `;
}

function renderResultsOnUI(data) {
    emptyState.style.display = 'none';
    activeContent.style.display = 'block';
    
    riskLabel.innerText = data.health_risk_score;
    scoreCard.style.backgroundColor = data.status_color + "12";
    scoreCard.style.border = `2px solid ${data.status_color}`;
    riskLabel.style.color = data.status_color;

    visionMeta.innerText = `Visual Classification: ${data.detected_visual_anomaly} (${data.vision_confidence}% confidence)`;

    sopList.innerHTML = '';
    data.recommendations.forEach(action => {
        const li = document.createElement('li');
        li.innerText = action;
        li.style.borderLeftColor = data.status_color;
        sopList.appendChild(li);
    });
}

async function syncOfflineData() {
    let offlineQueue = JSON.parse(localStorage.getItem('silkworm_offline_queue')) || [];
    if (offlineQueue.length === 0) return;

    for (let i = offlineQueue.length - 1; i >= 0; i--) {
        const record = offlineQueue[i];
        try {
            const res = await fetch(record.mediaData);
            const blob = await res.blob();
            
            const formData = new FormData();
            formData.append('media', blob, record.fileName);
            formData.append('temperature', record.temperature);
            formData.append('humidity', record.humidity);
            formData.append('ventilation_poor', record.ventilation_poor);
            formData.append('hygiene_poor', record.hygiene_poor);

            const response = await fetch('http://127.0.0.1:5000/api/assess-health', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                offlineQueue.splice(i, 1);
                localStorage.setItem('silkworm_offline_queue', JSON.stringify(offlineQueue));
                refreshSidebarWidgets();
            }
        } catch (err) {
            break; 
        }
    }
}

// ========================================================
// DYNAMIC VIEW CHANGER ENGINE (OFFICER + CULTIVATOR ILLUSIONS)
// ========================================================
batchHistoryMenu.addEventListener('click', function(e) {
    e.preventDefault();
    liveRiskMenu.classList.remove('active');
    sopMenu.classList.remove('active');
    batchHistoryMenu.classList.add('active');
    
    emptyState.style.display = 'block';
    activeContent.style.display = 'none';
    
    if (window.currentUserRole === "Officer") {
        emptyState.innerHTML = `
            <div style="text-align: left;">
                <h4 style="color: var(--text-primary); margin-bottom: 5px;"><i class="fa-solid fa-globe"></i> District Regional Telemetry Matrix</h4>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 15px;">
                    Displaying macro aggregated risk tracking across monitored farming sectors.
                </p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">
                            <th style="padding: 8px 0;">Zone Sector</th>
                            <th>Active Farmers</th>
                            <th>Avg Temp/Hum</th>
                            <th>Current Risk Index</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 10px 0; font-weight:600;">Sector Alpha (North)</td>
                            <td>42</td>
                            <td>24.5°C / 72%</td>
                            <td style="color: #10b981; font-weight:700;">LOW</td>
                        </tr>
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 10px 0; font-weight:600;">Sector Beta (East)</td>
                            <td>19</td>
                            <td>29.1°C / 88%</td>
                            <td style="color: #ef4444; font-weight:700;">HIGH (Flacherie Alert)</td>
                        </tr>
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 10px 0; font-weight:600;">Sector Gamma (South)</td>
                            <td>31</td>
                            <td>26.0°C / 78%</td>
                            <td style="color: #f59e0b; font-weight:700;">MEDIUM</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    } else if (window.currentUserRole === "Cultivator") {
        emptyState.innerHTML = `
            <div style="text-align: left;">
                <h4 style="color: var(--text-primary); margin-bottom: 5px;"><i class="fa-solid fa-network-wired"></i> Assigned Cluster Monitor</h4>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 15px;">
                    Tracking active cooperative cycles under your supervisor token.
                </p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="background: var(--bg-main); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="font-size:14px; display:block;">Greenwood Nest Cluster</strong>
                            <span style="font-size:12px; color:var(--text-secondary);">14 Farmers • Chawki Rearing Stage</span>
                        </div>
                        <span style="background:#10b981; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:700;">STABLE</span>
                    </div>
                    <div style="background: var(--bg-main); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="font-size:14px; display:block;">Silk Valley Hub</strong>
                            <span style="font-size:12px; color:var(--text-secondary);">8 Farmers • 5th Instar Feeding Stage</span>
                        </div>
                        <span style="background:#f59e0b; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:700;">ATTENTION</span>
                    </div>
                    <div style="background: var(--bg-main); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="font-size:14px; display:block;">Resham Village Alliance</strong>
                            <span style="font-size:12px; color:var(--text-secondary);">22 Farmers • Cocoon Spinning Cycle</span>
                        </div>
                        <span style="background:#10b981; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:700;">STABLE</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        emptyState.innerHTML = `
            <i class="fa-solid fa-box-archive" style="color: var(--text-muted);"></i>
            <p><strong>Batch History Dashboard (Farmer)</strong></p>
            <span style="font-size: 13px; color: var(--text-muted); display:block; margin-top:5px;">
                Displaying your personal rearing shed history logs. All completed threads have synced safely.
            </span>
        `;
    }
});

liveRiskMenu.addEventListener('click', function(e) {
    e.preventDefault();
    batchHistoryMenu.classList.remove('active');
    sopMenu.classList.remove('active');
    liveRiskMenu.classList.add('active');
    
    emptyState.style.display = 'block';
    activeContent.style.display = 'none';
    emptyState.innerHTML = `
        <i class="fa-solid fa-shield-virus"></i>
        <p>Submit tray observations and environmental factors to generate the warning matrix score.</p>
    `;
});

sopMenu.addEventListener('click', function(e) {
    e.preventDefault();
    liveRiskMenu.classList.remove('active');
    batchHistoryMenu.classList.remove('active');
    sopMenu.classList.add('active');
    
    emptyState.style.display = 'none';
    activeContent.style.display = 'block';
    
    riskLabel.innerText = "SOP MASTER INDEX";
    riskLabel.style.color = "var(--text-secondary)";
    scoreCard.style.backgroundColor = "var(--bg-input)";
    scoreCard.style.border = "1px solid var(--border-color)";
    visionMeta.innerText = "Authorized Departmental Directives (Active Standby Mode)";
    
    sopList.innerHTML = `
        <li><strong>Bed Disinfection SOP:</strong> Apply Vijetha or Sanitech powders uniformly across affected sections if fungal or pathogen vectors trigger visual tags.</li>
        <li><strong>Moisture Management SOP:</strong> Dust slaked lime absorbent over tray spaces immediately if relative moisture levels scale past 85% RH thresholds.</li>
        <li><strong>Thermal Baseline SOP:</strong> Trigger environmental heaters or adjust modular shed ventilation barriers to bring temperatures back inside the 24°C - 27°C safety envelope.</li>
    `;
});

analyzeBtn.addEventListener('click', handleAssessment);
if (navigator.onLine) { syncOfflineData(); }
