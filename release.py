"""Package a deterministic source ZIP and record exact native archive hashes."""
from pathlib import Path
import hashlib
import json
import zipfile

base = Path(__file__).resolve().parent
files = ["package.json", "package-lock.json", "tsconfig.json", "build.mjs", "release.py", "README.md", "PRIVACY.md", "LICENSE", "THIRD-PARTY-NOTICES.md", "CHANGELOG.md"]
for folder in ["src", "api", "tests", "examples", "publish"]:
    files += [p.relative_to(base).as_posix() for p in (base / folder).rglob("*") if p.is_file()]
files = sorted(set(files))
out = base / "release"
out.mkdir(exist_ok=True)
archive = out / "sewlore-joplin-fabric-specimen-log-1.0.0-source.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in files:
        data = (base / name).read_bytes()
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 11, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, data)
artifacts = [archive, *sorted((base / "publish").glob("*"))]
receipt = {"version": "1.0.0", "nativeAppInstalledTested": False, "externallyPublished": False, "artifacts": [{"path": p.relative_to(base).as_posix(), "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in artifacts]}
(out / "artifact-hashes.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps(receipt))
