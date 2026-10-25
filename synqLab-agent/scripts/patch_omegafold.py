"""Patch OmegaFold setup.py for Python 3.11+ compatibility.

Instead of fragile regex matching, we just rewrite the setup.py
to remove the torch dependency entirely (torch is pre-installed
via requirements.txt).
"""
import pathlib, sys

clone_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/tmp/OmegaFold")
setup_path = clone_dir / "setup.py"

# Just rewrite the entire setup.py — upstream one is tiny
setup_path.write_text('''\
from setuptools import setup, find_packages

with open("README.md", "r") as f:
    readme = f.read()

setup(
    name="OmegaFold",
    description="OmegaFold Release Code",
    long_description=readme,
    long_description_content_type="text/markdown",
    license="Apache-2.0",
    packages=find_packages(exclude=["tests", "tests.*"]),
    entry_points={"console_scripts": ["omegafold=omegafold.__main__:main"]},
    install_requires=["biopython"],
    python_requires=">=3.8",
)
''')
print("✓ setup.py rewritten (torch dependency removed, Python 3.11+ compatible)")
