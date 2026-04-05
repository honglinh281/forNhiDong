import re
from pathlib import Path

import pdfplumber


HS_SPLIT = re.compile(r"HS\s*CODE\s*:\s*([0-9.]+)", re.IGNORECASE)
QTY_UNIT = re.compile(r"^(?P<quantity>[0-9][0-9,\.]*)\s*(?P<unit>[A-Z]{2,15})(?:\b.*)?$")


def clean_lines(text):
    if not text:
        return []
    return [line.strip() for line in text.splitlines() if line and line.strip()]


def get_item_table(page):
    for table in page.extract_tables():
        if len(table) < 5:
            continue
        header_row = table[3] or []
        first_cell = header_row[0] if header_row else ""
        if first_cell and "5.item" in first_cell:
            return table
    return None


def parse_quantity_token(token):
    normalized = " ".join((token or "").strip().split())
    match = QTY_UNIT.search(normalized)
    if not match:
        return {
            "quantity": token or "",
            "unit": "",
        }
    return match.groupdict()


def normalize_inline_text(text):
    return re.sub(r"\s+", " ", text or "").strip(" .")


def parse_form_e(path):
    pdf_path = Path(path)
    rows = []
    warnings = []
    pending = None

    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            table = get_item_table(page)
            if not table:
                warnings.append(f"Trang {page_number}: khong tim thay bang item Form E.")
                continue

            item_row = table[4] if len(table) > 4 else None
            if not item_row or len(item_row) < 6:
                warnings.append(f"Trang {page_number}: cau truc bang item khong dung mong doi.")
                continue

            numbers = clean_lines(item_row[0] or "")
            descriptions_text = (item_row[2] or "").strip()
            origins = clean_lines(item_row[4] or "")
            quantity_tokens = clean_lines(item_row[5] or "")

            meta = []
            for index, item_number in enumerate(numbers):
                quantity_parts = parse_quantity_token(quantity_tokens[index] if index < len(quantity_tokens) else "")
                meta.append(
                    {
                        "itemNumber": item_number,
                        "pageNumber": page_number,
                        "origin": (origins[index] if index < len(origins) else "").replace('"', ""),
                        "quantity": quantity_parts["quantity"],
                        "unit": quantity_parts["unit"],
                    }
                )

            parts = HS_SPLIT.split(descriptions_text)
            meta_index = 0

            if pending and len(parts) >= 2:
                leading_description = normalize_inline_text(parts[0])
                if leading_description:
                    pending["itemName"] = normalize_inline_text(f'{pending["itemName"]} {leading_description}')
                pending["hsCode"] = parts[1].strip()
                rows.append(pending)
                pending = None
                parts = parts[2:]
            elif pending and len(parts) < 2:
                pending["itemName"] = normalize_inline_text(f'{pending["itemName"]} {descriptions_text}')
                continue

            for index in range(0, len(parts) - 1, 2):
                description = normalize_inline_text(parts[index])
                hs_code = parts[index + 1].strip()
                if not hs_code:
                    continue
                if meta_index >= len(meta):
                    warnings.append(
                        f"Trang {page_number}: tim thay HS code {hs_code} nhung khong con dong item de map."
                    )
                    continue

                row = meta[meta_index]
                meta_index += 1
                row["itemName"] = description
                row["hsCode"] = hs_code
                rows.append(row)

            if len(parts) % 2 == 1:
                trailing_text = parts[-1].strip()
                if trailing_text:
                    if meta_index < len(meta):
                        pending = meta[meta_index]
                        meta_index += 1
                        pending["itemName"] = normalize_inline_text(trailing_text)
                    else:
                        warnings.append(
                            f"Trang {page_number}: bo qua noi dung du khong thuoc item: {normalize_inline_text(trailing_text)}"
                        )

            if meta_index != len(meta):
                unused_numbers = ",".join(item["itemNumber"] for item in meta[meta_index:])
                warnings.append(
                    f"Trang {page_number}: con {len(meta) - meta_index} item chua duoc doc het ({unused_numbers})."
                )

    if pending:
        warnings.append(
            f'Trang {pending["pageNumber"]}: item {pending["itemNumber"]} bi do dang o cuoi file PDF.'
        )

    return {
        "rows": rows,
        "warnings": warnings,
    }

