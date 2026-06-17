import os, re

ROOT = r"E:\哈吉语创制计划\文创相关"
count = 0
files = []

for dirpath, dirnames, filenames in os.walk(ROOT):
    if "node_modules" in dirpath or ".git" in dirpath or "_inbox" in dirpath:
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

        if 'src="/images/' in text or 'href="/images/' in text:
            new_text = text.replace('src="/images/', 'src="./images/').replace('href="/images/', 'href="./images/')
            with open(fp, "w", encoding="utf-8") as f:
                f.write(new_text)
            files.append(os.path.relpath(fp, ROOT))
            count += text.count('src="/images/') + text.count('href="/images/')

for f in sorted(files):
    print("  " + f)
print(f"\n共在 {len(files)} 个文件中替换 {count} 处 /images/ → ./images/")
