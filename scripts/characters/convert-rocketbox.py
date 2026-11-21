# Converts one RocketBox facial FBX into a glTF binary for the talk screen. Only the ARKit shapes (AK_) and the Oculus
# visemes (AA_VI_) are kept, under their standard names (jawOpen, viseme_aa, ...). The other shape keys (FACS, SR, HB)
# are dropped, so the file stays small. Run with: python scripts/characters/convert-rocketbox.py <source.fbx> <target.glb> <report.json>
import bpy
import json
import re
import sys

source, target, report_path = sys.argv[1:4]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=source)

ARKIT = re.compile(r"^AK_\d+_(.+)$")
VISEME = re.compile(r"^AA_VI_\d+_(.+)$")


def standard_name(name):
    match = ARKIT.match(name)
    if match:
        base = match.group(1)
        return base[0].lower() + base[1:]
    match = VISEME.match(name)
    if match:
        # The Oculus viseme names: lower case for kk and sil, as in the other avatars.
        viseme = {"KK": "kk", "Sil": "sil"}.get(match.group(1), match.group(1))
        return "viseme_" + viseme
    return None


report = {"meshes": {}, "bones": []}
for obj in bpy.data.objects:
    if obj.type == "ARMATURE":
        report["bones"] = [bone.name for bone in obj.data.bones]
    if obj.type != "MESH":
        continue
    before = 0
    if obj.data.shape_keys:
        blocks = list(obj.data.shape_keys.key_blocks)
        before = len(blocks) - 1
        for block in blocks[1:]:
            if standard_name(block.name) is None:
                obj.shape_key_remove(block)
        for block in obj.data.shape_keys.key_blocks[1:]:
            block.name = standard_name(block.name)
    after = len(obj.data.shape_keys.key_blocks) - 1 if obj.data.shape_keys else 0
    report["meshes"][obj.name] = {"shapes_before": before, "shapes_after": after, "vertices": len(obj.data.vertices)}

bpy.ops.export_scene.gltf(
    filepath=target,
    export_format="GLB",
    use_selection=False,
    export_morph=True,
    export_morph_normal=True,
    export_skins=True,
    export_animations=False,
    export_apply=False,
    export_image_format="WEBP",
    export_materials="EXPORT",
    export_yup=True,
)
with open(report_path, "w") as handle:
    json.dump(report, handle, indent=2)
print("exported", target)
