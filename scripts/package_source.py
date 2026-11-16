"""Build a source-only archive using explicit file and directory allowlists."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ('.gitignore', '.gitattributes', 'README.md', 'THIRD_PARTY_NOTICES.md', 'requirements.txt',
         'server.py', 'paper_search.py', 'Start-PaperAgent.cmd', 'Start-PaperAgent.ps1',
         'Install-PaperAgent.cmd', 'Install-PaperAgent.ps1')
DIRECTORIES = {'web': {'.html', '.css', '.js'}, 'tests': {'.py', '.cjs'}, 'scripts': {'.py'},
               'docs': {'.md'}, '.github/workflows': {'.yml', '.yaml'}}


def source_files():
    selected = [ROOT / name for name in FILES]
    for folder, extensions in DIRECTORIES.items():
        selected.extend(path for path in (ROOT / folder).rglob('*')
                        if path.is_file() and path.suffix in extensions and '__pycache__' not in path.parts)
    license_path = ROOT / 'LICENSE'
    if license_path.is_file():
        selected.append(license_path)
    for path in selected:
        if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise ValueError('Unsafe or missing source file: ' + path.name)
    return sorted(set(selected))


def main():
    output = ROOT / 'dist'
    output.mkdir(exist_ok=True)
    archive = output / 'PaperAgent-source.zip'
    manifest = []
    for path in source_files():
        relative = path.relative_to(ROOT).as_posix()
        raw = path.read_bytes()
        manifest.append({'path': relative, 'size': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    # Reject an accidentally embedded live key without printing it or its value.
    settings_path = ROOT / 'data/settings.json'
    if settings_path.exists():
        key = json.loads(settings_path.read_text('utf-8')).get('api_key', '')
        if key and any(key.encode() in (ROOT / item['path']).read_bytes() for item in manifest):
            raise ValueError('A configured secret appears in source files. Packaging stopped.')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as zipped:
        for item in manifest:
            zipped.write(ROOT / item['path'], 'PaperAgent/' + item['path'])
    (output / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output / 'SHA256SUMS.txt').write_text(digest + '  PaperAgent-source.zip\n', encoding='ascii')
    print('Source archive:', archive)
    print('Files:', len(manifest), '| Bytes:', archive.stat().st_size)
    print('Local settings, documents, histories, profiles, dependencies and caches excluded.')


if __name__ == '__main__':
    main()
