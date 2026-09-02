import re, html, sys
h = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
t = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', '', h)
t = re.sub(r'<[^>]+>', ' ', t); t = html.unescape(re.sub(r'\s+', ' ', t))
kw = sys.argv[2] if len(sys.argv) > 2 else None
i = t.find(kw) if kw else 0
print((t[max(0, i-40):] if i >= 0 else t)[:520])
