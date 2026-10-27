"""
Jugadores de MPFB para el partido de la tele: un humano por pose, con el rig aplicado, y la
ropa pintada por altura (botines, medias, short, camiseta), sin texturas. A la distancia de una
transmisión no hace falta más. Lo usa partido.py; solo, renderiza tres de cerca para revisarlos:

  Blender -b --python arte/jugador.py -- prueba.png
"""
import math
import sys

import bpy
from mathutils import Euler

from bl_ext.blender_org.mpfb.services.humanservice import HumanService


def limpiar():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def huesos(rig):
    return {b.name: b for b in rig.pose.bones}


def posar(rig, zancada):
    """Brazos abajo y una zancada: + adelanta la pierna izquierda, − la derecha, 0 parado."""
    pb = huesos(rig)
    for lado, s in (("L", 1), ("R", -1)):
        brazo = pb.get(f"upperarm01.{lado}")
        if brazo:
            brazo.rotation_mode = "XYZ"
            # De la T al costado del cuerpo (eje Y), y el balanceo que acompaña la pierna contraria (eje X).
            brazo.rotation_euler = Euler((math.radians(18 * zancada * s), math.radians(80 * s), 0))
        ante = pb.get(f"lowerarm01.{lado}")
        if ante:
            ante.rotation_mode = "XYZ"
            ante.rotation_euler = Euler((math.radians(-35), 0, 0))
        muslo = pb.get(f"upperleg01.{lado}")
        if muslo:
            muslo.rotation_mode = "XYZ"
            muslo.rotation_euler = Euler((math.radians(28 * zancada * s), 0, 0))
        pierna = pb.get(f"lowerleg01.{lado}")
        if pierna:
            pierna.rotation_mode = "XYZ"
            pierna.rotation_euler = Euler((math.radians(-30 * max(0, -zancada * s) - 8), 0, 0))


def ropa(nombre, camiseta, short, medias):
    """Un material por equipo: la ropa sale de la altura y del ancho, sin texturas."""
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.75
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs[0])
    piel = (0.50, 0.33, 0.24, 1)
    # De abajo hacia arriba: botín, media, rodilla, short, camiseta, cuello y cabeza.
    franjas = [(0.09, (0.03, 0.03, 0.03, 1)), (0.47, (*medias, 1)), (0.80, piel), (1.02, (*short, 1)), (1.42, (*camiseta, 1))]
    color = nt.nodes.new("ShaderNodeMix"); color.data_type = "RGBA"
    color.inputs["A"].default_value = piel
    color.inputs["B"].default_value = piel
    ultimo = color.outputs["Result"]
    for tope, c in reversed(franjas):
        menor = nt.nodes.new("ShaderNodeMath"); menor.operation = "LESS_THAN"; menor.inputs[1].default_value = tope
        nt.links.new(sep.outputs["Z"], menor.inputs[0])
        mezcla = nt.nodes.new("ShaderNodeMix"); mezcla.data_type = "RGBA"
        nt.links.new(menor.outputs[0], mezcla.inputs["Factor"])
        nt.links.new(ultimo, mezcla.inputs["A"])
        mezcla.inputs["B"].default_value = c
        ultimo = mezcla.outputs["Result"]
    # Los antebrazos van sin manga: lejos del tronco y por debajo del hombro, piel.
    ancho = nt.nodes.new("ShaderNodeMath"); ancho.operation = "ABSOLUTE"
    nt.links.new(sep.outputs["X"], ancho.inputs[0])
    afuera = nt.nodes.new("ShaderNodeMath"); afuera.operation = "GREATER_THAN"; afuera.inputs[1].default_value = 0.2
    nt.links.new(ancho.outputs[0], afuera.inputs[0])
    bajo = nt.nodes.new("ShaderNodeMath"); bajo.operation = "LESS_THAN"; bajo.inputs[1].default_value = 1.27
    nt.links.new(sep.outputs["Z"], bajo.inputs[0])
    alto = nt.nodes.new("ShaderNodeMath"); alto.operation = "GREATER_THAN"; alto.inputs[1].default_value = 0.85
    nt.links.new(sep.outputs["Z"], alto.inputs[0])
    y1 = nt.nodes.new("ShaderNodeMath"); y1.operation = "MULTIPLY"
    nt.links.new(afuera.outputs[0], y1.inputs[0]); nt.links.new(bajo.outputs[0], y1.inputs[1])
    y2 = nt.nodes.new("ShaderNodeMath"); y2.operation = "MULTIPLY"
    nt.links.new(y1.outputs[0], y2.inputs[0]); nt.links.new(alto.outputs[0], y2.inputs[1])
    brazo = nt.nodes.new("ShaderNodeMix"); brazo.data_type = "RGBA"
    nt.links.new(y2.outputs[0], brazo.inputs["Factor"])
    nt.links.new(ultimo, brazo.inputs["A"])
    brazo.inputs["B"].default_value = piel
    # El pelo: lo de más arriba, oscuro.
    pelo = nt.nodes.new("ShaderNodeMath"); pelo.operation = "GREATER_THAN"; pelo.inputs[1].default_value = 1.57
    nt.links.new(sep.outputs["Z"], pelo.inputs[0])
    final = nt.nodes.new("ShaderNodeMix"); final.data_type = "RGBA"
    nt.links.new(pelo.outputs[0], final.inputs["Factor"])
    nt.links.new(brazo.outputs["Result"], final.inputs["A"])
    final.inputs["B"].default_value = (0.04, 0.03, 0.02, 1)
    nt.links.new(final.outputs["Result"], bsdf.inputs["Base Color"])
    return m


def crear_poses(zancadas):
    """Una malla quieta por pose: el rig se aplica y se tira. Las copias comparten la malla."""
    mallas = []
    for i, z in enumerate(zancadas):
        cuerpo = HumanService.create_human(scale=0.1)
        rig = HumanService.add_builtin_rig(cuerpo, "default")
        posar(rig, z)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        malla = bpy.data.meshes.new_from_object(cuerpo.evaluated_get(dg))
        malla.name = f"Jugador pose {i}"
        # El rig es padre del cuerpo: se juntan los nombres antes de borrar.
        nombres = {o.name for o in [rig, cuerpo, *cuerpo.children, *rig.children]}
        for n in nombres:
            if n in bpy.data.objects:
                bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
        mallas.append(malla)
    return mallas


def poner(malla, material, x, y, giro):
    """Una copia de la malla, con el material de su equipo puesto en el objeto y no en la malla."""
    if not malla.materials:
        malla.materials.append(None)
    o = bpy.data.objects.new("Jugador", malla)
    bpy.context.scene.collection.objects.link(o)
    o.location = (x, y, 0)
    o.rotation_euler.z = giro
    for slot in o.material_slots:
        slot.link = "OBJECT"
        slot.material = material
    return o


if __name__ == "__main__" and "--" in sys.argv and sys.argv[-1].endswith(".png") and "jugador.py" in " ".join(sys.argv):
    salida = sys.argv[sys.argv.index("--") + 1]
    limpiar()
    mallas = crear_poses([0, 1, -1])
    local = ropa("Local", (0.62, 0.06, 0.05), (0.9, 0.9, 0.9), (0.62, 0.06, 0.05))
    visita = ropa("Visita", (0.85, 0.87, 0.9), (0.05, 0.07, 0.15), (0.85, 0.87, 0.9))
    for i, m in enumerate(mallas):
        poner(m, local if i % 2 == 0 else visita, i * 1.0 - 1.0, 0, 0)
    bpy.ops.mesh.primitive_plane_add(size=20)
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), 0, math.radians(30)))
    bpy.context.object.data.energy = 4
    bpy.ops.object.camera_add(location=(0, -6, 1.2), rotation=(math.radians(86), 0, 0))
    e = bpy.context.scene
    e.camera = bpy.context.object
    e.camera.data.lens = 40
    e.render.engine = "CYCLES"; e.cycles.samples = 16
    e.render.resolution_x, e.render.resolution_y = 800, 500
    e.render.filepath = salida
    bpy.ops.render.render(write_still=True)
    print("LISTO", salida)
