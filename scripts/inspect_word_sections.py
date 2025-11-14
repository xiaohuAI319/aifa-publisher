from __future__ import annotations
from bs4 import BeautifulSoup
from pathlib import Path
from typing import Any

def extract_sections(source_path: Path) -> list[dict[str, Any]]:
    html = source_path.read_text(encoding="gb2312", errors="ignore")
    soup = BeautifulSoup(html, "html.parser")

    def normalize_text(text: str) -> str:
        return " ".join(text.split())

    sections: list[dict[str, Any]] = []
    headings = [h for h in soup.find_all("h2") if h.get_text(strip=True)]
    for index, heading in enumerate(headings, start=1):
        section: dict[str, Any] = {
            "index": index,
            "title": normalize_text(heading.get_text()),
            "content": []
        }
        for sibling in heading.next_siblings:
            name = getattr(sibling, "name", None)
            if name == "h2":
                break
            if name == "p":
                text = normalize_text(sibling.get_text(" "))
                if text:
                    section["content"].append({"type": "paragraph", "text": text})
                images = sibling.find_all("img")
                for img in images:
                    section["content"].append({"type": "image", "src": img.get("src")})
            elif name in {"ul", "ol"}:
                items = []
                for li in sibling.find_all("li"):
                    text = normalize_text(li.get_text(" "))
                    if text:
                        items.append(text)
                if items:
                    section["content"].append({"type": "list", "items": items})
            elif name == "img":
                section["content"].append({"type": "image", "src": sibling.get("src")})
        sections.append(section)
    return sections


def main() -> None:
    source = Path("editor/assets/images/chrome-guide/source.html")
    sections = extract_sections(source)
    for section in sections:
        print(f"SECTION {section['index']}: {section['title']}")
        for block in section["content"]:
            if block["type"] == "paragraph":
                print(f"  P: {block['text']}")
            elif block["type"] == "list":
                for item in block["items"]:
                    print(f"  - {item}")
            elif block["type"] == "image":
                print(f"  [IMAGE] {block['src']}")
        print()

if __name__ == "__main__":
    main()
