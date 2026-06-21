import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'silkworm_uploads'
MODEL_PATH = "runs/classify/train/weights/best.pt"
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'mp4', 'avi', 'mov'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load your trained YOLO classification model
if os.path.exists(MODEL_PATH):
    model = YOLO(MODEL_PATH)
else:
    print(f"Warning: {MODEL_PATH} not found. Loading default classification base model.")
    model = YOLO("yolov8n-cls.pt")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/assess-health', methods=['POST'])
def assess_silkworm_health():
    # 1. Validate file payload
    if 'media' not in request.files:
        return jsonify({"error": "No image or video file provided"}), 400
    
    file = request.files['media']
    if file.filename == '':
        return jsonify({"error": "Empty filename selection"}), 400

    # 2. Extract environmental variables sent from the UI form
    try:
        temperature = float(request.form.get('temperature', 25.0))
        humidity = float(request.form.get('humidity', 70.0))
        ventilation_poor = request.form.get('ventilation_poor', 'false').lower() == 'true'
        hygiene_poor = request.form.get('hygiene_poor', 'false').lower() == 'true'
    except ValueError:
        return jsonify({"error": "Invalid format for temperature or humidity numerical values"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # 3. Process image/tray using YOLOv8 computer vision model
            results = model.predict(source=filepath, imgsz=224)
            result = results[0]
            
            # Extract top predicted class and confidence
            top_idx = result.probs.top1
            top_class = result.names[top_idx]
            top_confidence = round(float(result.probs.top1conf) * 100, 2)
            
            # 4. Hybrid Risk Rule Matrix (Combining Visual Cues + Environmental Risk Metrics)
            # Default classification states from YOLO classes can be labeled as 'healthy', 'stressed', or 'diseased'
            visual_risk_high = top_class.lower() in ['diseased', 'infection', 'flacherie', 'pebrine', 'grasserie']
            visual_risk_med = top_class.lower() in ['stressed', 'lethargic', 'suboptimal']

            # Count sub-optimal physical environmental cues
            env_stress_count = 0
            if temperature < 22 or temperature > 28: env_stress_count += 1
            if humidity < 65 or humidity > 85: env_stress_count += 1
            if ventilation_poor: env_stress_count += 1
            if hygiene_poor: env_stress_count += 1

            # Determine Health Risk Score (Low, Medium, High)
            if visual_risk_high or env_stress_count >= 3:
                risk_score = "High Risk"
                status_color = "#ef4444"
            elif visual_risk_med or env_stress_count >= 1:
                risk_score = "Medium Risk"
                status_color = "#f59e0b"
            else:
                risk_score = "Low Risk"
                status_color = "#10b981"

            # 5. Map Standardized Departmental SOP Recommendations based on variables
            recommendations = []
            if hygiene_poor or visual_risk_high:
                recommendations.append("Initiate instant bed disinfection using Vijetha or Sanitech powders immediately.")
            if temperature < 22:
                recommendations.append("Activate electric room heaters/chawki controllers to safely stabilize temperature above 24°C.")
            if temperature > 28:
                recommendations.append("Enhance thatch ventilation proxies, apply wet gunny bags to cool structural boundaries.")
            if humidity > 85:
                recommendations.append("Spread slaked lime powder over bed frames to absorb excess ambient moisture index.")
            if ventilation_poor:
                recommendations.append("Open mesh windows and clear structural blockages to improve cross-ventilation flow.")
            if not recommendations:
                recommendations.append("Rearing parameters are within target ranges. Continue normal feeding schedules and daily hygiene routines.")

            # Clean up upload file
            os.remove(filepath)

            return jsonify({
                "success": True,
                "detected_visual_anomaly": top_class,
                "vision_confidence": top_confidence,
                "health_risk_score": risk_score,
                "status_color": status_color,
                "environmental_stressors": env_stress_count,
                "recommendations": recommendations
            })

        except Exception as e:
            if os.path.exists(filepath): os.remove(filepath)
            return jsonify({"error": f"Analysis pipeline breakdown: {str(e)}"}), 500

    return jsonify({"error": "Unsupported extension format"}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
