// Gather target DOM Elements
const mediaInput = document.getElementById('mediaInput');
const dropzone = document.getElementById('dropzone');
const previewBox = document.getElementById('previewBox');
const mediaPreview = document.getElementById('mediaPreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');

const emptyState = document.getElementById('emptyState');
const activeContent = document.getElementById('activeContent');
const scoreCard = document.getElementById('scoreCard');
const riskLabel = document.getElementById('riskLabel');
const visionMeta = document.getElementById('visionMeta');
const sopList = document.getElementById('sopList');

const loader = document.getElementById('loader');
const btnText = document.getElementById('btnText');

let uploadedFile = null;

// Trigger click routing for file input wrapper
dropzone.addEventListener('click', () => mediaInput.click());

// Load and preview selected image/video files
mediaInput.addEventListener('change', function(e) {
    if (e.target.files.length === 0) return;
    uploadedFile = e.target.files[0];
    
    const reader = new FileReader();
    reader.onload = function(event) {
        mediaPreview.src = event.target.result;
        dropzone.style.display = 'none';
        previewBox.style.display = 'flex';
        analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(uploadedFile);
});

// Reset the user interface elements
clearBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    uploadedFile = null;
    mediaInput.value = '';
    previewBox.style.display = 'none';
    dropzone.style.display = 'block';
    analyzeBtn.disabled = true;
    
    emptyState.style.display = 'block';
    activeContent.style.display = 'none';
});

// Asynchronously transfer data to the Flask backend
async function sendAssessmentRequest() {
    if (!uploadedFile) return;

    const formData = new FormData();
    formData.append('media', uploadedFile);
    formData.append('temperature', document.getElementById('tempInput').value);
    formData.append('humidity', document.getElementById('humidityInput').value);
    formData.append('ventilation_poor', document.getElementById('ventCheck').checked);
    formData.append('hygiene_poor', document.getElementById('hygieneCheck').checked);

    // Enter loading state
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
            emptyState.style.display = 'none';
            activeContent.style.display = 'block';
            
            // Render risk results
            riskLabel.innerText = data.health_risk_score;
            scoreCard.style.backgroundColor = data.status_color + "15"; // Adds mild background tint alpha
            scoreCard.style.border = `2px solid ${data.status_color}`;
            riskLabel.style.color = data.status_color;

            visionMeta.innerText = `Visual Classification: ${data.detected_visual_anomaly} (${data.vision_confidence}% confidence)`;

            // Inject SOP recommended items dynamically
            sopList.innerHTML = '';
            data.recommendations.forEach(action => {
                const li = document.createElement('li');
                li.innerText = action;
                li.style.borderLeftColor = data.status_color;
                sopList.appendChild(li);
            });
        } else {
            alert("Error processing pipeline parameters: " + data.error);
        }
    } catch (err) {
        alert("Could not reach the classification execution server. Verify your Flask app is running.");
        console.error(err);
    } finally {
        loader.style.display = 'none';
        btnText.style.display = 'inline';
        analyzeBtn.disabled = false;
    }
}

// Bind process handler function
analyzeBtn.addEventListener('click', sendAssessmentRequest);
