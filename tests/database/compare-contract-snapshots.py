#!/usr/bin/env python3
from __future__ import annotations
import difflib, sys
from pathlib import Path
FILES = ("extensions","relations","columns","functions","function-definitions","policies","grants","constraints","indexes","triggers","views")
def read(root: Path, name: str):
    p=root/name
    if not p.exists(): raise SystemExit(f"missing snapshot file: {p}")
    return p.read_text(encoding="utf-8").splitlines()
def main():
    if len(sys.argv)!=3:
        print("usage: compare-contract-snapshots.py FRESH_DIR LIVE_DIR", file=sys.stderr); return 2
    fresh, live = map(Path, sys.argv[1:])
    if read(fresh,"server-version") != read(live,"server-version"):
        print("INFO: server-version differs; not treated as application contract drift.")
    failures=0
    for name in FILES:
        a,b=read(fresh,name),read(live,name)
        if name=="extensions":
            if {line.split(":",1)[0] for line in a} != {line.split(":",1)[0] for line in b}:
                failures += 1
                print("FAIL: required extension set differs")
                print("\n".join(difflib.unified_diff(a,b,fromfile="fresh/extensions",tofile="live/extensions",lineterm="")))
            elif a != b:
                print("INFO: extension versions differ; classify platform-managed version differences separately.")
            continue
        if a==b:
            print(f"PASS: {name}")
        else:
            failures += 1
            print(f"FAIL: {name} differs")
            print("\n".join(difflib.unified_diff(a,b,fromfile=f"fresh/{name}",tofile=f"live/{name}",lineterm="")))
    if failures:
        print(f"CONTRACT COMPARISON FAIL: {failures} contract category/categories differ."); return 1
    print("CONTRACT COMPARISON PASS: all application-owned contract categories match."); return 0
if __name__=="__main__":
    raise SystemExit(main())
