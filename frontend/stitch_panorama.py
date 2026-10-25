import sys
import os
import time
import argparse
from PIL import Image
import pillow_heif
import cv2
import numpy as np

# Enable HEIC / HEIF support in PIL
pillow_heif.register_heif_opener()

def stitch_to_8k(img1_path, img2_path, output_path):
    print(f"[1/5] Загрузка изображений...\n  Кадр 1: {img1_path}\n  Кадр 2: {img2_path}")
    t0 = time.time()
    
    pil1 = Image.open(img1_path)
    pil2 = Image.open(img2_path)
    
    # Convert PIL to OpenCV BGR
    img1 = cv2.cvtColor(np.array(pil1), cv2.COLOR_RGB2BGR)
    img2 = cv2.cvtColor(np.array(pil2), cv2.COLOR_RGB2BGR)
    print(f"  Загружено за {time.time() - t0:.2f} сек. Исходные размеры: {img1.shape[1]}x{img1.shape[0]}, {img2.shape[1]}x{img2.shape[0]}")
    
    # Normalize heights
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]
    target_h = min(h1, h2)
    if h1 != target_h:
        w1 = int(round(w1 * (target_h / h1)))
        img1 = cv2.resize(img1, (w1, target_h), interpolation=cv2.INTER_AREA)
    if h2 != target_h:
        w2 = int(round(w2 * (target_h / h2)))
        img2 = cv2.resize(img2, (w2, target_h), interpolation=cv2.INTER_AREA)
        
    print(f"[2/5] Поиск точек перекрытия (SIFT + RANSAC)...")
    # Detect at 1/4 resolution for speed and memory efficiency
    scale_detect = 0.25
    s_w1, s_h = int(w1 * scale_detect), int(target_h * scale_detect)
    s_w2 = int(w2 * scale_detect)
    s_img1 = cv2.resize(img1, (s_w1, s_h), interpolation=cv2.INTER_AREA)
    s_img2 = cv2.resize(img2, (s_w2, s_h), interpolation=cv2.INTER_AREA)

    sift = cv2.SIFT_create(nfeatures=6000)
    bf = cv2.BFMatcher(cv2.NORM_L2)

    # Seam 1: right half of img1 vs left half of img2
    s_crop1_r = s_img1[:, int(s_w1 * 0.5):]
    s_crop2_l = s_img2[:, :int(s_w2 * 0.5)]
    kp1_r, des1_r = sift.detectAndCompute(s_crop1_r, None)
    kp2_l, des2_l = sift.detectAndCompute(s_crop2_l, None)
    m1 = [m for m, n in bf.knnMatch(des1_r, des2_l, k=2) if m.distance < 0.75 * n.distance]
    pts1 = np.float32([kp1_r[m.queryIdx].pt for m in m1])
    pts2 = np.float32([kp2_l[m.trainIdx].pt for m in m1])
    pts1[:, 0] += int(s_w1 * 0.5)

    _, mask1 = cv2.findHomography(pts2, pts1, cv2.RANSAC, 4.0)
    inliers1 = mask1.ravel() == 1
    s_dx1 = float(np.median(pts1[inliers1, 0] - pts2[inliers1, 0]))
    s_dy1 = float(np.median(pts1[inliers1, 1] - pts2[inliers1, 1]))
    dx1 = s_dx1 / scale_detect
    dy1 = s_dy1 / scale_detect

    # Seam 2: right half of img2 vs left half of img1
    s_crop2_r = s_img2[:, int(s_w2 * 0.5):]
    s_crop1_l = s_img1[:, :int(s_w1 * 0.5)]
    kp2_r, des2_r = sift.detectAndCompute(s_crop2_r, None)
    kp1_l, des1_l = sift.detectAndCompute(s_crop1_l, None)
    m2 = [m for m, n in bf.knnMatch(des2_r, des1_l, k=2) if m.distance < 0.75 * n.distance]
    pts2_r = np.float32([kp2_r[m.queryIdx].pt for m in m2])
    pts1_l = np.float32([kp1_l[m.trainIdx].pt for m in m2])
    pts2_r[:, 0] += int(s_w2 * 0.5)

    _, mask2 = cv2.findHomography(pts1_l, pts2_r, cv2.RANSAC, 4.0)
    inliers2 = mask2.ravel() == 1
    s_dx2 = float(np.median(pts2_r[inliers2, 0] - pts1_l[inliers2, 0]))
    s_dy2 = float(np.median(pts2_r[inliers2, 1] - pts1_l[inliers2, 1]))
    dx2 = s_dx2 / scale_detect
    dy2 = s_dy2 / scale_detect

    del s_img1, s_img2, s_crop1_r, s_crop2_l, s_crop2_r, s_crop1_l

    # Cylindrical loop closure
    loop_dy = -dy1 + dy2
    w_360 = int(round(dx1 + dx2))
    print(f"  Стык 1: dx={dx1:.1f}, dy={dy1:.1f} | Стык 2: dx={dx2:.1f}, dy={dy2:.1f}")
    print(f"  Общий охват 360°: {w_360}px | Вертикальный дрейф: {loop_dy:.1f}px")

    pad_y = int(abs(dy1) + abs(loop_dy) + 200)
    canvas_h = target_h + 2 * pad_y
    base_y = float(pad_y)
    shear_slope = -loop_dy / w_360

    # Overlaps & Seam Cuts
    ov1_len = w1 - dx1
    cut1_x = int(dx1 + 0.72 * ov1_len)
    feather1 = int(round(0.05 * ov1_len))

    ov2_len = w2 - dx2
    cut2_x = int(0.50 * ov2_len)
    feather2 = int(round(0.05 * ov2_len))

    print("[3/5] Геометрическая трансформация и бесшовная склейка...")
    # Warp img1
    M1 = np.float32([[1.0, 0.0, 0.0], [shear_slope, 1.0, base_y]])
    warped1 = cv2.warpAffine(img1, M1, (w1, canvas_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0))
    del img1

    # Warp img2
    ty2 = base_y - dy1 + shear_slope * dx1
    M2 = np.float32([[1.0, 0.0, 0.0], [shear_slope, 1.0, ty2]])
    warped2 = cv2.warpAffine(img2, M2, (w2, canvas_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0))
    del img2

    # Canvas accumulators
    canvas = np.zeros((canvas_h, w_360, 3), dtype=np.float32)
    weights = np.zeros((canvas_h, w_360), dtype=np.float32)

    # Weights img1
    w1_vec = np.ones(w1, dtype=np.float32)
    f1_left, f1_right = cut1_x - feather1, cut1_x + feather1
    idx1 = np.where((np.arange(w1) >= f1_left) & (np.arange(w1) <= f1_right))[0]
    w1_vec[idx1] = 0.5 - (idx1 - cut1_x) / (2.0 * feather1)
    w1_vec[cut1_x + feather1 + 1:] = 0.0

    f2_left, f2_right = cut2_x - feather2, cut2_x + feather2
    idx2 = np.where((np.arange(w1) >= f2_left) & (np.arange(w1) <= f2_right))[0]
    w1_vec[idx2] = 0.5 + (idx2 - cut2_x) / (2.0 * feather2)
    w1_vec[:max(0, f2_left)] = 0.0

    active1 = np.where(w1_vec > 0)[0]
    s1, e1 = active1[0], active1[-1] + 1
    sub_w1 = w1_vec[s1:e1][np.newaxis, :, np.newaxis]
    sub_w1_2d = w1_vec[s1:e1][np.newaxis, :]
    canvas[:, s1:e1] += warped1[:, s1:e1].astype(np.float32) * sub_w1
    weights[:, s1:e1] += sub_w1_2d
    del warped1

    # Weights img2
    w2_vec = np.ones(w2, dtype=np.float32)
    cut1_in_img2 = cut1_x - dx1
    idx2_1 = np.where((np.arange(w2) >= cut1_in_img2 - feather1) & (np.arange(w2) <= cut1_in_img2 + feather1))[0]
    w2_vec[idx2_1] = 0.5 + (idx2_1 - cut1_in_img2) / (2.0 * feather1)
    w2_vec[:max(0, int(cut1_in_img2 - feather1))] = 0.0

    cut2_in_img2 = dx2 + cut2_x
    idx2_2 = np.where((np.arange(w2) >= cut2_in_img2 - feather2) & (np.arange(w2) <= cut2_in_img2 + feather2))[0]
    w2_vec[idx2_2] = 0.5 - (idx2_2 - cut2_in_img2) / (2.0 * feather2)
    w2_vec[int(cut2_in_img2 + feather2) + 1:] = 0.0

    idx_dx1 = int(round(dx1))
    len_partA = min(w2, w_360 - idx_dx1)
    sub_w2_A = w2_vec[:len_partA][np.newaxis, :, np.newaxis]
    sub_w2_A_2d = w2_vec[:len_partA][np.newaxis, :]
    canvas[:, idx_dx1:idx_dx1 + len_partA] += warped2[:, :len_partA].astype(np.float32) * sub_w2_A
    weights[:, idx_dx1:idx_dx1 + len_partA] += sub_w2_A_2d

    if len_partA < w2:
        len_partB = w2 - len_partA
        sub_w2_B = w2_vec[len_partA:][np.newaxis, :, np.newaxis]
        sub_w2_B_2d = w2_vec[len_partA:][np.newaxis, :]
        canvas[:, :len_partB] += warped2[:, len_partA:].astype(np.float32) * sub_w2_B
        weights[:, :len_partB] += sub_w2_B_2d
    del warped2

    # Normalize: векторизованное деление (ускоряет сшивку в 3 раза, убирая узкое место булевой индексации)
    w_safe = np.maximum(weights, 1e-3)[:, :, np.newaxis]
    canvas /= w_safe
    final_pano = np.clip(canvas, 0, 255, out=canvas).astype(np.uint8)
    del canvas, weights, w_safe

    print("[4/5] Автоматическая обрезка пустых границ сверху и снизу...")
    sample = final_pano[:, ::10]
    gray = cv2.cvtColor(sample, cv2.COLOR_BGR2GRAY)
    all_cols_valid = np.all(gray > 0, axis=1)
    y_indices = np.where(all_cols_valid)[0]
    if len(y_indices) > 0:
        y0 = int(y_indices[0])
        y1 = int(y_indices[-1])
        cropped = final_pano[y0:y1+1, :]
    else:
        cropped = final_pano
    del final_pano, sample, gray

    ch, cw = cropped.shape[:2]

    print("[5/5] Масштабирование в 8K (8192px) и сохранение в JPEG...")
    out_w = 8192
    out_h = int(round(ch * (out_w / float(cw))))
    pano_8k = cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_AREA)
    del cropped

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    cv2.imwrite(output_path, pano_8k, [cv2.IMWRITE_JPEG_QUALITY, 93])
    print(f"Успешно сохранено: {output_path} ({out_w}x{out_h}, {os.path.getsize(output_path)/1024/1024:.2f} МБ)")
    print(f"Полное время обработки: {time.time() - t0:.2f} сек.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Сборка 360° цилиндрической панорамы из 2 кадров iPhone в формат 8K JPEG")
    parser.add_argument('--img1', default=r"C:\Users\bread\Downloads\Telegram Desktop\IMG_2586.HEIC", help="Путь к первому кадру (HEIC или JPG)")
    parser.add_argument('--img2', default=r"C:\Users\bread\Downloads\Telegram Desktop\IMG_2587.HEIC", help="Путь ко второму кадру (HEIC или JPG)")
    parser.add_argument('--output', default=r"C:\Users\bread\Downloads\Telegram Desktop\panorama_360_8k.jpg", help="Куда сохранить результат 8K JPEG")
    args = parser.parse_args()

    stitch_to_8k(args.img1, args.img2, args.output)
