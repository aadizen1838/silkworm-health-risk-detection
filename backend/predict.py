from ultralytics import YOLO

model = YOLO("runs/classify/train/weights/best.pt")

result = model.predict(
    source="testImage.jpg",
    imgsz=224
)

print(result[0].probs)