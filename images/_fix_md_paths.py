import os
import re

ROOT = r"E:\哈吉语创制计划\文创相关"

patterns = [
    re.compile(r'<img\s+(.*?)src="\.\./\.\./images/([^"]+\.svg)"'),
    re.compile(r'<img\s+(.*?)src="\.\./images/([^"]+\.svg)"'),
    re.compile(r'<img\s+(.*?)src="\.\./\.\./images/([^"]+\.png)"'),
    re.compile(r'<img\s+(.*?)src="\.\./images/([^"]+\.png)"'),
]

count = 0
files_updated = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    if "_inbox" in dirpath or "node_modules" in dirpath or ".git" in dirpath:
        continue
    for fn in filenames:
        if not fn.endswith(".md"):
            continue
        fp = os.path.join(dirpath, fn)
        try:
            with open(fp, "r", encoding="utf-8") as f:
                text = f.read()
        except (UnicodeDecodeError, PermissionError):
            continue
        new_text = text
        for p in patterns:
            new_text = p.sub(r'<img \1src="/images/\2"', new_text)
        if new_text != text:
            with open(fp, "w", encoding="utf-8") as f:
                f.write(new_text)
            count += 1
            files_updated.append(os.path.relpath(fp, ROOT))

for f in sorted(files_updated):
    print("  " + f)
print("\n共更新 " + str(count) + " 个 .md 文件")
