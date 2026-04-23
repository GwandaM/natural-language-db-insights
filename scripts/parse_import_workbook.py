from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import PurePosixPath
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET


NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_PACKAGE_RELS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_DOC_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

BUILTIN_DATE_FORMAT_IDS = {
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    27,
    30,
    36,
    45,
    46,
    47,
    50,
    57,
}


def qname(namespace: str, tag: str) -> str:
    return f"{{{namespace}}}{tag}"


def is_date_format(format_code: str) -> bool:
    if not format_code:
        return False

    cleaned = re.sub(r'"[^"]*"', "", format_code)
    cleaned = re.sub(r"\[[^\]]*\]", "", cleaned)
    cleaned = cleaned.replace("\\", "")
    cleaned = cleaned.replace("_", "")
    cleaned = cleaned.replace("*", "")
    lowered = cleaned.lower()

    return any(token in lowered for token in ("yy", "dd", "mm", "hh", "ss"))


def column_index(cell_ref: str) -> int | None:
    match = re.match(r"([A-Z]+)", cell_ref or "")
    if not match:
        return None

    value = 0
    for character in match.group(1):
        value = value * 26 + (ord(character) - ord("A") + 1)
    return value


def parse_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    path = "xl/sharedStrings.xml"
    if path not in archive.namelist():
        return []

    root = ET.fromstring(archive.read(path))
    strings: list[str] = []

    for item in root.findall(qname(NS_MAIN, "si")):
        parts = [node.text or "" for node in item.iter(qname(NS_MAIN, "t"))]
        strings.append("".join(parts))

    return strings


def parse_date_style_flags(archive: zipfile.ZipFile) -> list[bool]:
    path = "xl/styles.xml"
    if path not in archive.namelist():
        return [False]

    root = ET.fromstring(archive.read(path))
    num_fmts = {
        int(node.attrib["numFmtId"]): node.attrib.get("formatCode", "")
        for node in root.findall(f"{qname(NS_MAIN, 'numFmts')}/{qname(NS_MAIN, 'numFmt')}")
    }

    flags: list[bool] = []
    cell_xfs = root.find(qname(NS_MAIN, "cellXfs"))
    if cell_xfs is None:
        return [False]

    for xf in cell_xfs.findall(qname(NS_MAIN, "xf")):
        num_fmt_id = int(xf.attrib.get("numFmtId", "0"))
        flags.append(
            num_fmt_id in BUILTIN_DATE_FORMAT_IDS
            or is_date_format(num_fmts.get(num_fmt_id, ""))
        )

    return flags or [False]


def excel_serial_to_iso(value: str, use_1904_system: bool) -> str:
    try:
        serial = float(value)
    except ValueError:
        return value

    base = datetime(1904, 1, 1) if use_1904_system else datetime(1899, 12, 30)
    converted = base + timedelta(days=serial)
    converted = converted.replace(microsecond=0)

    if abs(serial - round(serial)) < 1e-9:
        return converted.date().isoformat()

    return converted.isoformat()


def parse_workbook_structure(
    archive: zipfile.ZipFile,
) -> tuple[list[tuple[str, str]], bool]:
    workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
    workbook_pr = workbook_root.find(qname(NS_MAIN, "workbookPr"))
    use_1904_system = (
        workbook_pr is not None
        and workbook_pr.attrib.get("date1904", "").lower() in {"1", "true"}
    )

    rels_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets_by_id = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels_root.findall(qname(NS_PACKAGE_RELS, "Relationship"))
    }

    sheets: list[tuple[str, str]] = []
    sheets_parent = workbook_root.find(qname(NS_MAIN, "sheets"))
    if sheets_parent is None:
        return sheets, use_1904_system

    for sheet in sheets_parent.findall(qname(NS_MAIN, "sheet")):
        relation_id = sheet.attrib.get(f"{{{NS_DOC_RELS}}}id")
        if not relation_id:
            continue
        target = targets_by_id.get(relation_id)
        if not target:
            continue
        sheet_path = str(PurePosixPath("xl") / PurePosixPath(target))
        sheets.append((sheet.attrib.get("name", "Sheet"), sheet_path))

    return sheets, use_1904_system


def cell_value(
    cell: ET.Element,
    shared_strings: list[str],
    date_style_flags: list[bool],
    use_1904_system: bool,
) -> str | None:
    cell_type = cell.attrib.get("t")

    if cell_type == "inlineStr":
        parts = [node.text or "" for node in cell.iter(qname(NS_MAIN, "t"))]
        value = "".join(parts).strip()
        return value or None

    value_node = cell.find(qname(NS_MAIN, "v"))
    if value_node is None or value_node.text is None:
        return None

    raw_value = value_node.text.strip()
    if raw_value == "":
        return None

    if cell_type == "s":
        index = int(raw_value)
        if 0 <= index < len(shared_strings):
            return shared_strings[index]
        return None

    if cell_type == "b":
        return "TRUE" if raw_value == "1" else "FALSE"

    if cell_type in {"str", "e"}:
        return raw_value

    style_index = int(cell.attrib.get("s", "0"))
    if 0 <= style_index < len(date_style_flags) and date_style_flags[style_index]:
        return excel_serial_to_iso(raw_value, use_1904_system)

    return raw_value


def sheet_to_json(
    archive: zipfile.ZipFile,
    sheet_path: str,
    shared_strings: list[str],
    date_style_flags: list[bool],
    use_1904_system: bool,
) -> dict[str, object]:
    root = ET.fromstring(archive.read(sheet_path))
    sheet_data = root.find(qname(NS_MAIN, "sheetData"))
    if sheet_data is None:
        return {"headers": [], "rows": []}

    parsed_rows: list[tuple[int, dict[int, str]]] = []

    for row in sheet_data.findall(qname(NS_MAIN, "row")):
        row_number = int(row.attrib.get("r", "0") or "0")
        values_by_column: dict[int, str] = {}

        for cell in row.findall(qname(NS_MAIN, "c")):
            ref = cell.attrib.get("r", "")
            index = column_index(ref)
            if index is None:
                continue
            value = cell_value(cell, shared_strings, date_style_flags, use_1904_system)
            if value is None or value == "":
                continue
            values_by_column[index] = value

        parsed_rows.append((row_number, values_by_column))

    if not parsed_rows:
        return {"headers": [], "rows": []}

    header_row_number, header_cells = parsed_rows[0]
    del header_row_number

    headers_by_column: dict[int, str] = {}
    headers: list[str] = []
    for column in sorted(header_cells):
        header = header_cells[column].strip()
        if not header:
            continue
        headers_by_column[column] = header
        headers.append(header)

    data_rows: list[dict[str, object]] = []
    for row_number, row_cells in parsed_rows[1:]:
        row_json: dict[str, object] = {"__row_number": row_number}
        has_values = False

        for column, header in headers_by_column.items():
            value = row_cells.get(column)
            if value is None:
                row_json[header] = None
                continue
            trimmed = value.strip()
            row_json[header] = trimmed if trimmed else None
            has_values = has_values or bool(trimmed)

        if has_values:
            data_rows.append(row_json)

    return {"headers": headers, "rows": data_rows}


def parse_workbook(path: str) -> dict[str, object]:
    with zipfile.ZipFile(path, "r") as archive:
        shared_strings = parse_shared_strings(archive)
        date_style_flags = parse_date_style_flags(archive)
        sheets, use_1904_system = parse_workbook_structure(archive)

        parsed_sheets: dict[str, object] = {}
        for sheet_name, sheet_path in sheets:
            parsed_sheets[sheet_name] = sheet_to_json(
                archive,
                sheet_path,
                shared_strings,
                date_style_flags,
                use_1904_system,
            )

        return {"sheets": parsed_sheets}


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/parse_import_workbook.py <workbook-path>", file=sys.stderr)
        return 1

    workbook_path = sys.argv[1]
    result = parse_workbook(workbook_path)
    json.dump(result, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
