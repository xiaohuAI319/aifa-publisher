from bs4 import BeautifulSoup
from pathlib import Path
from dataclasses import dataclass
import json

@dataclass
class GuideSection:
    index: int
    title: str
    text_blocks: list
    images: list

def load_sections(source_path: Path) -> list[GuideSection]:
    html = source_path.read_text(encoding="gb2312", errors="ignore")
    soup = BeautifulSoup(html, "html.parser")

    # collect headings with actual content (skip empty ones)
    headings = [h for h in soup.find_all("h2") if h.get_text(strip=True)]
    sections: list[GuideSection] = []

    for idx, heading in enumerate(headings, start=1):
        title = heading.get_text(strip=True)
        text_blocks: list[str] = []
        images: list[str] = []

        for sibling in heading.next_siblings:
            if getattr(sibling, "name", None) == "h2":
                break
            tag_name = getattr(sibling, "name", None)
            if tag_name in {"p", "div", "ul", "ol"}:
                text = sibling.get_text("\n", strip=True)
                if text:
                    text_blocks.append(text)
            elif tag_name == "img":
                images.append(sibling.get("src", ""))
            else:
                raw_text = str(sibling).strip()
                if raw_text:
                    text_blocks.append(raw_text)
        sections.append(GuideSection(index=idx, title=title, text_blocks=text_blocks, images=images))

    return sections

def main() -> None:
    source = Path("editor/assets/images/chrome-guide/source.html")
    sections = load_sections(source)
    data = [section.__dict__ for section in sections]
    Path("editor/assets/images/chrome-guide/sections.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

if __name__ == "__main__":
    main()
