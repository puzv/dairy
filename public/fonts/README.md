# Bundled typefaces

The library loads these self-hosted regular faces on first selection. Each WOFF2 contains the entire character repertoire of its pinned upstream file. The two Adobe inputs are the official Simplified Chinese regional editions. The filename includes the first 12 hexadecimal digits of the shipped file’s SHA-256 digest so the browser can cache each revision independently.

| Upstream font | Font version | Internal family | Unicode code points in the best cmap | WOFF2 bytes | Source and license |
| --- | --- | --- | ---: | ---: | --- |
| LXGW WenKai Regular | 1.530 | `ShanJianWenKai` | 46,926 | 8,098,624 | [Original font](https://raw.githubusercontent.com/lxgw/LxgwWenKai/4becfb4d5cf0c92cfdb60a6e9b504bda43315325/fonts/TTF/LXGWWenKai-Regular.ttf) · [Original license](https://raw.githubusercontent.com/lxgw/LxgwWenKai/4becfb4d5cf0c92cfdb60a6e9b504bda43315325/OFL.txt) · [Bundled notice](licenses/wenkai-OFL.txt) |
| Source Han Serif CN Regular | 2.003 | `ShanJianSong` | 30,930 | 8,439,400 | [Original font](https://raw.githubusercontent.com/adobe-fonts/source-han-serif/7889f11bf31170b5d092a083b357c8c8130f89e0/SubsetOTF/CN/SourceHanSerifCN-Regular.otf) · [Original license](https://raw.githubusercontent.com/adobe-fonts/source-han-serif/7889f11bf31170b5d092a083b357c8c8130f89e0/LICENSE.txt) · [Bundled notice](licenses/source-han-serif-OFL.txt) |
| Source Han Sans CN Regular | 2.005 | `ShanJianHei` | 30,926 | 6,192,216 | [Original font](https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF/CN/SourceHanSansCN-Regular.otf) · [Original license](https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/LICENSE.txt) · [Bundled notice](licenses/source-han-sans-OFL.txt) |
| Ma Shan Zheng Regular | 2.003 | `ShanJianBrush` | 7,015 | 3,247,964 | [Original font](https://raw.githubusercontent.com/google/fonts/869789e84da92782c144d83d69b64cec54905b5f/ofl/mashanzheng/MaShanZheng-Regular.ttf) · [Original license](https://raw.githubusercontent.com/google/fonts/869789e84da92782c144d83d69b64cec54905b5f/ofl/mashanzheng/OFL.txt) · [Bundled notice](licenses/mashan-OFL.txt) |
| ZCOOL XiaoWei Regular | 1.000 | `ShanJianXiaoWei` | 7,016 | 2,633,032 | [Original font](https://raw.githubusercontent.com/google/fonts/869789e84da92782c144d83d69b64cec54905b5f/ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf) · [Original license](https://raw.githubusercontent.com/google/fonts/869789e84da92782c144d83d69b64cec54905b5f/ofl/zcoolxiaowei/OFL.txt) · [Bundled notice](licenses/xiaowei-OFL.txt) |

## File checksums

| File | Upstream SHA-256 | WOFF2 SHA-256 |
| --- | --- | --- |
| `wenkai.5803e2a52caa.woff2` | `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b` | `5803e2a52caa150979bfd05790804dc27ea5543f173bf51cd90d812e5ff263fd` |
| `source-han-serif.7ef59b41f49f.woff2` | `3754ea669c530e2473354f8f6d9f79680a44d7e26ec7d00eeabee4a7e0753c5d` | `7ef59b41f49f0ad23cdf5c1dd4f202cb652e8a9c27511d112d9aa01e04210950` |
| `source-han-sans.829f3f89c087.woff2` | `e2bc8a2e7f37474b774fff8db758681ece40bb6947a90d571bce9dd60671a8e4` | `829f3f89c08758c3dd7920c6fbbb9aa12556f387685fce80b15d703a2e88c07e` |
| `mashan.984a446bbcdb.woff2` | `6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb` | `984a446bbcdbdb6623f52b839de647a4f3dd641c67a0086862846abef0cf2b64` |
| `xiaowei.0175def33369.woff2` | `a42b620140f493db42f741351dfbf343c0936d58588ee8004b8b2a218d997ff1` | `0175def333698887c12a1ac21215a8107a3644a637ca832f392430ca01121c6a` |

## Reproduce a file

Use Python 3.12, fontTools 4.62.1 and Brotli 1.2.0. Download the pinned original font and verify its SHA-256 above. Save the following as `pack.py`, then run `python pack.py ORIGINAL INTERNAL_FAMILY OUTPUT.woff2` with the family from the table.

```python
from sys import argv
from fontTools.ttLib import TTFont

source, family, output = argv[1:]
font = TTFont(source, recalcTimestamp=False)
for record in font["name"].names:
    if record.nameID in (1, 3, 4, 6, 16, 18, 21, 25):
        record.string = family.encode(record.getEncoding())

if "CFF " in font:
    cff = font["CFF "].cff
    cff.fontNames[0] = family
    top = cff.topDictIndex[0]
    top.FullName = top.FamilyName = family
    if hasattr(top, "FDArray"):
        for index, dictionary in enumerate(top.FDArray):
            dictionary.FontName = f"{family}-FD{index}"

font.flavor = "woff2"
font.save(output)
```

The web editions use their own internal family names. Their original copyright, trademark, license and license URL records are preserved. The WOFF2 encoder drops obsolete digital signatures. Release verification compares every character mapping, including variation sequences, and the full glyph order with the original. Each font’s upstream SIL Open Font License is included in `licenses/`.
