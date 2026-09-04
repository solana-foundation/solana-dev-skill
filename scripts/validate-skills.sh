#!/usr/bin/env bash
# Validates every skill under skills/ against the Agent Skills spec.
#
#   ./scripts/validate-skills.sh
#
# Runs Anthropic's quick_validate.py (vendored as validate-skill.py) on each skill directory.
# It checks the frontmatter: required name and description, the six allowed keys, name and
# description length and character rules. Things it does not check are added here:
#
#   - `name` must equal the directory name, since installers key on the directory
#   - `description` must be a non-empty string; upstream only length-checks a truthy value
#   - `compatibility`, when present, must be a non-empty string for the same reason
#   - the skill directory must exist at all, since a bare glob miss would otherwise pass
#
# Requires python3 with PyYAML (`pip install pyyaml`).

set -euo pipefail

cd "$(dirname "$0")/.."

python3 -c 'import yaml' 2>/dev/null || {
  echo "PyYAML is not installed. Run: pip install pyyaml" >&2
  exit 2
}

rc=0
found=0
for skill in skills/*/; do
  found=1
  skill="${skill%/}"
  dir="$(basename "$skill")"

  if ! msg="$(python3 scripts/validate-skill.py "$skill")"; then
    echo "FAIL  $skill: $msg"
    rc=1
    continue
  fi

  if ! name="$(python3 - "$skill/SKILL.md" <<'PY'
import re, sys, yaml
text = open(sys.argv[1], encoding="utf-8").read()
match = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
fm = yaml.safe_load(match.group(1))
description = fm.get("description")
if not isinstance(description, str) or not description.strip():
    print("description must be a non-empty string")
    sys.exit(1)
if "compatibility" in fm:
    compatibility = fm["compatibility"]
    if not isinstance(compatibility, str) or not compatibility.strip():
        print("compatibility must be a non-empty string when present")
        sys.exit(1)
print(str(fm.get("name", "")).strip())
PY
)"; then
    echo "FAIL  $skill: $name"
    rc=1
    continue
  fi
  if [[ "$name" != "$dir" ]]; then
    echo "FAIL  $skill: frontmatter name '$name' does not match directory name '$dir'"
    rc=1
    continue
  fi

  echo "ok    $skill"
done

if [[ $found -eq 0 ]]; then
  echo "No skills found under skills/" >&2
  exit 1
fi

exit $rc
