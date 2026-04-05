#!/usr/bin/env python3

import json
import sys
from pathlib import Path

from python.form_e_pdf_parser import parse_form_e


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: extract_form_e_pdfplumber.py <pdf_path>"}))
        return 2

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(json.dumps({"error": f"PDF not found: {pdf_path}"}))
        return 2

    try:
        result = parse_form_e(pdf_path)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
