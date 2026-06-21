from ultralytics import YOLO

model = YOLO("yolov8n-cls.pt")

model.train(
    data="dataset",
    epochs=20,
    imgsz=224
)