"""Calculate rendered sRGB contrast using W3C relative luminance:
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
"""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('receipt', type=Path)
args = parser.parse_args()
receipt = json.loads(args.receipt.read_text())


def luminance(color):
    values = [float(value) for value in re.findall(r'[\d.]+', color)]
    if len(values) not in (3, 4) or (len(values) == 4 and values[3] != 1):
        raise ValueError('Expected opaque rendered RGB color: ' + color)
    channels = values[:3] if color.startswith('color(srgb ') else [value / 255 for value in values[:3]]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return sum(channel * weight for channel, weight in zip(linear, [0.2126, 0.7152, 0.0722]))


contrasts = []
for sample in receipt['samples']:
    foreground, background = luminance(sample['foreground']), luminance(sample['background'])
    ratio = (max(foreground, background) + 0.05) / (min(foreground, background) + 0.05)
    contrasts.append({**sample, 'ratio': ratio, 'passed': ratio >= sample['minimum']})
receipt['contrasts'] = contrasts
args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(contrasts, indent=2))
if not contrasts or any(not sample['passed'] for sample in contrasts):
    raise SystemExit(1)
