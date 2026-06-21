import os
import shutil
import random



SOURCE = "dataset/raw"
TRAIN = "dataset/train"
VAL = "dataset/val"
TEST = "dataset/test"

print("Current directory:", os.getcwd())
print("Source exists:", os.path.exists(SOURCE))
print("Source path:", SOURCE)

classes = os.listdir(SOURCE)

for cls in classes:

    src_folder = os.path.join(SOURCE, cls)

    images = os.listdir(src_folder)

    random.shuffle(images)

    train_size = int(0.7 * len(images))
    val_size = int(0.15 * len(images))

    train_imgs = images[:train_size]
    val_imgs = images[train_size:train_size+val_size]
    test_imgs = images[train_size+val_size:]

    for folder in [TRAIN, VAL, TEST]:
        os.makedirs(os.path.join(folder, cls), exist_ok=True)

    for img in train_imgs:
        shutil.copy(
            os.path.join(src_folder, img),
            os.path.join(TRAIN, cls, img)
        )

    for img in val_imgs:
        shutil.copy(
            os.path.join(src_folder, img),
            os.path.join(VAL, cls, img)
        )

    for img in test_imgs:
        shutil.copy(
            os.path.join(src_folder, img),
            os.path.join(TEST, cls, img)
        )

print("Dataset split completed!")