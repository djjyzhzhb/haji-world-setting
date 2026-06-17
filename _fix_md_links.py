import os
import re

ROOT = r"E:\哈吉语创制计划\文创相关"

count = 0
files = []

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
        if "file:///" not in text:
            continue

        new_text = text
        changed = False

        # 匹配所有 (file:///E:/....md) 形式的链接
        pattern = r"\(file:///([^\)]+\.md)\)"
        matches = re.findall(pattern, new_text)
        for match in matches:
            # match 是 E:/哈吉语创制计划/文创相关/xx/yy.md 或已含编码的路径
            abs_path = os.path.normpath(match)
            cur_dir = os.path.dirname(fp)
            try:
                rel = os.path.relpath(abs_path, cur_dir)
                rel = rel.replace("\\", "/")
                old = "(file:///" + match + ")"
                new = "(" + rel + ")"
                new_text = new_text.replace(old, new)
                changed = True
                count += 1
            except ValueError:
                pass

        if changed:
            with open(fp, "w", encoding="utf-8") as f:
                f.write(new_text)
            files.append(os.path.relpath(fp, ROOT))

for f in sorted(files):
    print("  " + f)
print("\n共替换 " + str(count) + " 处 file:/// 链接为相对路径")
