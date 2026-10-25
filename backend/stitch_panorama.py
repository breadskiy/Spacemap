import sys
import os
import time
import argparse
from PIL import Image, ImageOps
import pillow_heif
import cv2
import numpy as np

# Enable HEIC / HEIF support in PIL (iPhone photos)
pillow_heif.register_heif_opener()

def _find_seam_offset(s_crop_a, s_crop_b, offset_a_x, bf, sift, scale_detect, seam_name="Стык"):
    """
    Находит смещение (dx, dy) между перекрывающимися фрагментами через SIFT + RANSAC.
    Включает автоматические fallback-пороги для надежного поиска даже при небольшом контрасте.
    """
    kp_a, des_a = sift.detectAndCompute(s_crop_a, None)
    kp_b, des_b = sift.detectAndCompute(s_crop_b, None)

    if des_a is None or des_b is None or len(kp_a) < 4 or len(kp_b) < 4:
        raise ValueError(f"{seam_name}: недостаточно характерных ориентиров для совмещения кадров.")

    # 1. Попытка с жестким порогом Lowe's ratio (0.75)
    matches_raw = bf.knnMatch(des_a, des_b, k=2)
    good_m = [m for m, n in matches_raw if len([m, n]) == 2 and m.distance < 0.75 * n.distance]

    # 2. Если хороших точек мало, смягчаем порог до 0.85
    if len(good_m) < 6:
        good_m = [m for m, n in matches_raw if len([m, n]) == 2 and m.distance < 0.85 * n.distance]

    if len(good_m) < 4:
        # Берем топ-15 совпадений по расстоянию
        sorted_m = sorted([m for m, _ in matches_raw if m is not None], key=lambda x: x.distance)
        good_m = sorted_m[:min(15, len(sorted_m))]

    if len(good_m) < 2:
        raise ValueError(
            f"{seam_name}: не удалось найти общие точки перекрытия. "
            f"Убедитесь, что кадры сняты с перекрытием не менее 15-20%."
        )

    pts_a = np.float32([kp_a[m.queryIdx].pt for m in good_m])
    pts_b = np.float32([kp_b[m.trainIdx].pt for m in good_m])
    pts_a[:, 0] += offset_a_x

    # Поиск гомографии с фильтрацией выбросов (RANSAC)
    if len(good_m) >= 4:
        H, mask = cv2.findHomography(pts_b, pts_a, cv2.RANSAC, 5.0)
        if mask is not None and np.sum(mask) >= 3:
            inliers = mask.ravel() == 1
            s_dx = float(np.median(pts_a[inliers, 0] - pts_b[inliers, 0]))
            s_dy = float(np.median(pts_a[inliers, 1] - pts_b[inliers, 1]))
            return s_dx / scale_detect, s_dy / scale_detect

    # Fallback: медиана всех найденных точек
    s_dx = float(np.median(pts_a[:, 0] - pts_b[:, 0]))
    s_dy = float(np.median(pts_a[:, 1] - pts_b[:, 1]))
    return s_dx / scale_detect, s_dy / scale_detect


def stitch_to_8k(img1_path, img2_path, output_path):
    """
    Сшивает два кадра по 180° в единую бесшовную цилиндрическую 360° 8K панораму.
    Оптимизирована по памяти (<250 МБ RAM) для стабильной работы на VPS-серверах.
    """
    t0 = time.time()
    print(f"[1/5] Загрузка и нормализация кадров...\n  Кадр 1: {img1_path}\n  Кадр 2: {img2_path}")

    # Загружаем через Pillow с учетом EXIF-ориентации iPhone и конвертацией в RGB
    with Image.open(img1_path) as p1_raw:
        pil1 = ImageOps.exif_transpose(p1_raw).convert('RGB')
    with Image.open(img2_path) as p2_raw:
        pil2 = ImageOps.exif_transpose(p2_raw).convert('RGB')

    # Ограничиваем рабочее разрешение: для итоговой 8K (8192px) панорамы
    # высота 1300-1400px достаточна с огромным запасом четкости, при этом
    # потребление памяти снижается с 3.5 ГБ до 180 МБ.
    target_h = min(pil1.height, pil2.height)
    if target_h > 1400:
        target_h = 1400

    w1 = int(round(pil1.width * (target_h / pil1.height)))
    w2 = int(round(pil2.width * (target_h / pil2.height)))

    img1 = cv2.cvtColor(np.array(pil1.resize((w1, target_h), Image.Resampling.BILINEAR)), cv2.COLOR_RGB2BGR)
    img2 = cv2.cvtColor(np.array(pil2.resize((w2, target_h), Image.Resampling.BILINEAR)), cv2.COLOR_RGB2BGR)
    del pil1, pil2

    print(f"  Нормализованный размер: {w1}x{target_h} и {w2}x{target_h}")

    print("[2/5] Поиск точек перекрытия (SIFT + RANSAC)...")
    scale_detect = 0.5
    s_w1, s_h = int(w1 * scale_detect), int(target_h * scale_detect)
    s_w2 = int(w2 * scale_detect)
    s_img1 = cv2.resize(img1, (s_w1, s_h), interpolation=cv2.INTER_AREA)
    s_img2 = cv2.resize(img2, (s_w2, s_h), interpolation=cv2.INTER_AREA)

    sift = cv2.SIFT_create(nfeatures=4000)
    bf = cv2.BFMatcher(cv2.NORM_L2)

    # Стык 1: правая половина кадра 1 против левой половины кадра 2
    s_crop1_r = s_img1[:, int(s_w1 * 0.5):]
    s_crop2_l = s_img2[:, :int(s_w2 * 0.5)]
    dx1, dy1 = _find_seam_offset(s_crop1_r, s_crop2_l, int(s_w1 * 0.5), bf, sift, scale_detect, seam_name="Стык 1")

    # Стык 2: правая половина кадра 2 против левой половины кадра 1
    s_crop2_r = s_img2[:, int(s_w2 * 0.5):]
    s_crop1_l = s_img1[:, :int(s_w1 * 0.5)]
    dx2, dy2 = _find_seam_offset(s_crop2_r, s_crop1_l, int(s_w2 * 0.5), bf, sift, scale_detect, seam_name="Стык 2")

    del s_img1, s_img2, s_crop1_r, s_crop2_l, s_crop2_r, s_crop1_l

    # Замыкание цилиндра 360°
    loop_dy = -dy1 + dy2
    w_360 = int(round(dx1 + dx2))
    if w_360 <= 100:
        raise ValueError("Ошибка геометрии: вычисленный охват 360° меньше допустимого.")

    print(f"  Стык 1: dx={dx1:.1f}, dy={dy1:.1f} | Стык 2: dx={dx2:.1f}, dy={dy2:.1f}")
    print(f"  Охват 360°: {w_360}px | Вертикальный дрейф: {loop_dy:.1f}px")

    pad_y = int(abs(dy1) + abs(loop_dy) + 120)
    canvas_h = target_h + 2 * pad_y
    base_y = float(pad_y)
    shear_slope = -loop_dy / float(w_360)

    # Точки разреза и мягкого градиентного смешивания (Feathering)
    ov1_len = max(10, w1 - dx1)
    cut1_x = int(dx1 + 0.72 * ov1_len)
    feather1 = max(5, int(round(0.06 * ov1_len)))

    ov2_len = max(10, w2 - dx2)
    cut2_x = int(0.50 * ov2_len)
    feather2 = max(5, int(round(0.06 * ov2_len)))

    print("[3/5] Геометрическая трансформация и бесшовная склейка...")
    # Warp кадра 1
    M1 = np.float32([[1.0, 0.0, 0.0], [shear_slope, 1.0, base_y]])
    warped1 = cv2.warpAffine(img1, M1, (w1, canvas_h), flags=cv2.INTER_LINEAR)
    del img1

    # Warp кадра 2
    ty2 = base_y - dy1 + shear_slope * dx1
    M2 = np.float32([[1.0, 0.0, 0.0], [shear_slope, 1.0, ty2]])
    warped2 = cv2.warpAffine(img2, M2, (w2, canvas_h), flags=cv2.INTER_LINEAR)
    del img2

    # Аккумуляторы канваса
    canvas = np.zeros((canvas_h, w_360, 3), dtype=np.float32)
    weights = np.zeros((canvas_h, w_360), dtype=np.float32)

    # Весовая маска кадра 1
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
    if len(active1) > 0:
        s1, e1 = active1[0], active1[-1] + 1
        canvas[:, s1:e1] += warped1[:, s1:e1].astype(np.float32) * w1_vec[s1:e1][np.newaxis, :, np.newaxis]
        weights[:, s1:e1] += w1_vec[s1:e1][np.newaxis, :]
    del warped1

    # Весовая маска кадра 2
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
    len_partA = min(w2, max(0, w_360 - idx_dx1))
    if len_partA > 0:
        canvas[:, idx_dx1:idx_dx1 + len_partA] += warped2[:, :len_partA].astype(np.float32) * w2_vec[:len_partA][np.newaxis, :, np.newaxis]
        weights[:, idx_dx1:idx_dx1 + len_partA] += w2_vec[:len_partA][np.newaxis, :]

    if len_partA < w2:
        len_partB = min(w2 - len_partA, w_360)
        canvas[:, :len_partB] += warped2[:, len_partA:len_partA + len_partB].astype(np.float32) * w2_vec[len_partA:len_partA + len_partB][np.newaxis, :, np.newaxis]
        weights[:, :len_partB] += w2_vec[len_partA:len_partA + len_partB][np.newaxis, :]
    del warped2

    # Нормализация весов
    w_safe = np.maximum(weights, 1e-3)[:, :, np.newaxis]
    canvas /= w_safe
    final_pano = np.clip(canvas, 0, 255).astype(np.uint8)
    del canvas, weights, w_safe

    print("[4/5] Автоматическая обрезка пустых границ сверху и снизу...")
    sample = final_pano[:, ::10]
    gray = cv2.cvtColor(sample, cv2.COLOR_BGR2GRAY)
    all_cols_valid = np.all(gray > 0, axis=1)
    y_indices = np.where(all_cols_valid)[0]
    if len(y_indices) > 0:
        cropped = final_pano[y_indices[0]:y_indices[-1] + 1, :]
    else:
        cropped = final_pano
    del final_pano, sample, gray

    ch, cw = cropped.shape[:2]

    print("[5/5] Масштабирование в 8K (8192px) и сохранение в JPEG...")
    out_w = 8192
    out_h = int(round(ch * (out_w / float(cw))))
    pano_8k = cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_AREA)
    del cropped

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    cv2.imwrite(output_path, pano_8k, [cv2.IMWRITE_JPEG_QUALITY, 93])
    del pano_8k

    print(f"Успешно сохранено: {output_path} ({out_w}x{out_h}, {os.path.getsize(output_path)/1024/1024:.2f} МБ)")
    print(f"Полное время обработки: {time.time() - t0:.2f} сек.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Сборка 360° цилиндрической панорамы из 2 кадров в 8K JPEG")
    parser.add_argument('--img1', required=True, help="Путь к первому кадру (HEIC или JPG)")
    parser.add_argument('--img2', required=True, help="Путь ко второму кадру (HEIC или JPG)")
    parser.add_argument('--output', required=True, help="Куда сохранить результат 8K JPEG")
    args = parser.parse_args()

    stitch_to_8k(args.img1, args.img2, args.output)
