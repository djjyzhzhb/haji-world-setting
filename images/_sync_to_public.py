import shutil, os, sys

SRC = r"E:\哈吉语创制计划\文创相关\images"
DST = r"E:\哈吉语创制计划\文创相关\web\public\images"

os.makedirs(DST, exist_ok=True)
count = 0
for fn in sorted(os.listdir(SRC)):
    if fn.endswith((".svg", ".png")):
        shutil.copy(os.path.join(SRC, fn), os.path.join(DST, fn))
        count += 1
print(f"已复制 {count} 个图片到 web/public/images/")
for fn in sorted(os.listdir(DST)):
    print("  " + fn)
