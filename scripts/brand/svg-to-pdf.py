# SPDX-License-Identifier: AGPL-3.0-only
"""Convert this kit's path-based SVGs to vector PDF with system Cairo.

Deliberately supports only our generated vocabulary and fails on unsupported
elements. Does not rasterize or fetch remote content. No Python packages needed.
"""

import argparse
import ctypes as C
import ctypes.util
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path


def library():
    name = ctypes.util.find_library("cairo")
    if not name:
        name = next((str(p) for p in [Path("/opt/homebrew/lib/libcairo.2.dylib"), Path("/usr/local/lib/libcairo.2.dylib")] if p.exists()), None)
    if not name:
        raise SystemExit("Cairo is required for PDF exports (libcairo2 / brew cairo).")
    lib = C.CDLL(name)
    functions = {
        "cairo_pdf_surface_create": ([C.c_char_p, C.c_double, C.c_double], C.c_void_p),
        "cairo_pdf_surface_set_size": ([C.c_void_p, C.c_double, C.c_double], None),
        "cairo_pdf_surface_set_metadata": ([C.c_void_p, C.c_int, C.c_char_p], None),
        "cairo_create": ([C.c_void_p], C.c_void_p),
        "cairo_status": ([C.c_void_p], C.c_int),
        "cairo_surface_status": ([C.c_void_p], C.c_int),
        "cairo_surface_finish": ([C.c_void_p], None),
        "cairo_surface_destroy": ([C.c_void_p], None),
    }
    for name in ["save", "restore", "new_path", "close_path", "fill", "fill_preserve", "stroke", "show_page", "destroy"]:
        functions["cairo_" + name] = ([C.c_void_p], None)
    for name, count in [("translate", 2), ("scale", 2), ("rotate", 1), ("move_to", 2), ("line_to", 2), ("curve_to", 6), ("rectangle", 4), ("arc", 5), ("set_line_width", 1), ("set_source_rgba", 4)]:
        functions["cairo_" + name] = ([C.c_void_p] + [C.c_double] * count, None)
    for name, (args, result) in functions.items():
        fn = getattr(lib, name)
        fn.argtypes = args
        fn.restype = result
    return lib


NUM = r"[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?"


def numbers(s):
    return [float(x) for x in re.findall(NUM, s)]


def transform(lib, cr, s):
    for op, raw in re.findall(r"([a-zA-Z]+)\(([^)]+)\)", s):
        v = numbers(raw)
        if op == "translate":
            lib.cairo_translate(cr, v[0], v[1] if len(v) > 1 else 0)
        elif op == "scale":
            lib.cairo_scale(cr, v[0], v[1] if len(v) > 1 else v[0])
        elif op == "rotate":
            if len(v) == 3:
                lib.cairo_translate(cr, v[1], v[2])
            lib.cairo_rotate(cr, math.radians(v[0]))
            if len(v) == 3:
                lib.cairo_translate(cr, -v[1], -v[2])
        else:
            raise ValueError("Unsupported transform: " + op)


def path(lib, cr, data):
    tokens = re.findall(r"[a-zA-Z]|" + NUM, data)
    i, command = 0, None
    x = y = start_x = start_y = 0.0
    while i < len(tokens):
        if tokens[i].isalpha():
            command = tokens[i]
            i += 1
        if command in ("Z", "z"):
            lib.cairo_close_path(cr)
            x, y = start_x, start_y
            command = None
            continue
        if not command:
            raise ValueError("Missing SVG path command")
        op = command.upper()
        count = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "Q": 4}.get(op)
        if not count:
            raise ValueError("Unsupported SVG path command: " + command)
        v = list(map(float, tokens[i:i + count]))
        i += count
        if command.islower():
            if op == "H":
                v[0] += x
            elif op == "V":
                v[0] += y
            else:
                v = [z + (x if n % 2 == 0 else y) for n, z in enumerate(v)]
        if op in ("M", "L"):
            x, y = v
            if op == "M":
                lib.cairo_move_to(cr, x, y)
                start_x, start_y = x, y
                command = "l" if command.islower() else "L"
            else:
                lib.cairo_line_to(cr, x, y)
        elif op == "H":
            x = v[0]
            lib.cairo_line_to(cr, x, y)
        elif op == "V":
            y = v[0]
            lib.cairo_line_to(cr, x, y)
        elif op == "C":
            lib.cairo_curve_to(cr, *v)
            x, y = v[-2:]
        elif op == "Q":
            qx, qy, nx, ny = v
            lib.cairo_curve_to(cr, x + (qx-x)*2/3, y + (qy-y)*2/3, nx + (qx-nx)*2/3, ny + (qy-ny)*2/3, nx, ny)
            x, y = nx, ny


def color(lib, cr, value, alpha):
    if value.startswith("#") and len(value) in (4, 7):
        h = value[1:]
        if len(h) == 3:
            h = "".join(x*2 for x in h)
        lib.cairo_set_source_rgba(cr, *(int(h[i:i+2], 16) / 255 for i in (0, 2, 4)), alpha)
    else:
        raise ValueError("Unsupported fill color: " + value)


def draw(lib, cr, element, inherited=None):
    tag = element.tag.split("}")[-1]
    if tag in ("title", "desc"):
        return
    if tag not in ("svg", "g", "rect", "path", "circle"):
        raise ValueError("Unsupported SVG element: " + tag)
    a = element.attrib
    style = dict(inherited or {"fill": "#000000", "stroke": "none", "opacity": "1", "fill-opacity": "1", "stroke-width": "1"})
    for key in ("fill", "stroke", "opacity", "fill-opacity", "stroke-width"):
        if key in a:
            style[key] = a[key]
    lib.cairo_save(cr)
    transform(lib, cr, a.get("transform", ""))
    if tag == "svg":
        w, h = float(a["width"]), float(a["height"])
        vx, vy, vw, vh = numbers(a.get("viewBox", f"0 0 {w} {h}"))
        scale = min(w/vw, h/vh)
        lib.cairo_translate(cr, float(a.get("x", 0)) + (w-vw*scale)/2, float(a.get("y", 0)) + (h-vh*scale)/2)
        lib.cairo_scale(cr, scale, scale)
        lib.cairo_translate(cr, -vx, -vy)
    if tag in ("g", "svg"):
        for child in element:
            draw(lib, cr, child, style)
    else:
        lib.cairo_new_path(cr)
        if tag == "path":
            path(lib, cr, a["d"])
        elif tag == "circle":
            lib.cairo_arc(cr, float(a["cx"]), float(a["cy"]), float(a["r"]), 0, math.tau)
        else:
            x, y, w, h = [float(a.get(k, 0)) for k in ("x", "y", "width", "height")]
            r = min(float(a.get("rx", 0)), w/2, h/2)
            if not r:
                lib.cairo_rectangle(cr, x, y, w, h)
            else:
                lib.cairo_move_to(cr, x+r, y)
                lib.cairo_line_to(cr, x+w-r, y)
                lib.cairo_arc(cr, x+w-r, y+r, r, -math.pi/2, 0)
                lib.cairo_arc(cr, x+w-r, y+h-r, r, 0, math.pi/2)
                lib.cairo_arc(cr, x+r, y+h-r, r, math.pi/2, math.pi)
                lib.cairo_arc(cr, x+r, y+r, r, math.pi, 3*math.pi/2)
                lib.cairo_close_path(cr)
        if style["fill"] != "none":
            color(lib, cr, style["fill"], float(style["opacity"]) * float(style["fill-opacity"]))
            lib.cairo_fill_preserve(cr)
        if style["stroke"] != "none":
            color(lib, cr, style["stroke"], float(style["opacity"]))
            lib.cairo_set_line_width(cr, float(style["stroke-width"]))
            lib.cairo_stroke(cr)
        else:
            lib.cairo_new_path(cr)
    lib.cairo_restore(cr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("sources", nargs="+")
    args = parser.parse_args()
    roots = [ET.parse(source).getroot() for source in args.sources]
    lib = library()
    first = roots[0]
    # Guideline pages use an A4 ratio; preserve natural vector aspect ratios.
    scale = 595.276 / float(first.attrib["width"]) if "guidelines" in args.output else 1
    surface = lib.cairo_pdf_surface_create(str(Path(args.output)).encode(), float(first.attrib["width"])*scale, float(first.attrib["height"])*scale)
    lib.cairo_pdf_surface_set_metadata(surface, 0, b"FocusKept Side by Side")
    lib.cairo_pdf_surface_set_metadata(surface, 5, b"2026-11-23T00:00:00Z")
    lib.cairo_pdf_surface_set_metadata(surface, 6, b"2026-11-23T00:00:00Z")
    cr = lib.cairo_create(surface)
    try:
        for element in roots:
            lib.cairo_pdf_surface_set_size(surface, float(element.attrib["width"])*scale, float(element.attrib["height"])*scale)
            lib.cairo_save(cr)
            lib.cairo_scale(cr, scale, scale)
            draw(lib, cr, element)
            lib.cairo_restore(cr)
            if lib.cairo_status(cr):
                raise RuntimeError("Cairo render failed")
            lib.cairo_show_page(cr)
        lib.cairo_surface_finish(surface)
        if lib.cairo_surface_status(surface):
            raise RuntimeError("Cairo PDF write failed")
    finally:
        lib.cairo_destroy(cr)
        lib.cairo_surface_destroy(surface)


if __name__ == "__main__":
    main()
