"""
La imagen de la tele: un partido de viernes a la noche visto desde la cámara alta de la
transmisión. Escena nueva, desde cero, sin assets de terceros: los jugadores son humanos de
MPFB (CC0, ver jugador.py). No toca living.blend; la imagen se empaqueta ahí aparte.

  Blender -b --python arte/partido.py -- salida.png

Sin --factory-startup: MPFB es una extensión de Blender y tiene que estar cargada.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

SALIDA = sys.argv[sys.argv.index("--") + 1]
random.seed(7)
# jugador.py está al lado; sin dejar __pycache__ adentro de arte/.
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jugador as J  # noqa: E402
J.limpiar()
e = bpy.context.scene


def material(nombre, color, rugosidad=0.6, emision=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rugosidad
    if emision:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emision
    return m


def caja(nombre, centro, medidas, mat):
    bpy.ops.mesh.primitive_cube_add(location=centro)
    o = bpy.context.object
    o.name = nombre
    o.scale = (medidas[0] / 2, medidas[1] / 2, medidas[2] / 2)
    o.data.materials.append(mat)
    return o


# El pasto, a franjas de cortadora, con algo de ruido para que no sea un dibujo.
bpy.ops.mesh.primitive_plane_add(size=1)
pasto = bpy.context.object
pasto.scale = (150, 110, 1)
m = bpy.data.materials.new("Pasto")
m.use_nodes = True
nt = m.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.85
coord = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
div = nt.nodes.new("ShaderNodeMath"); div.operation = "DIVIDE"; div.inputs[1].default_value = 5.5
piso = nt.nodes.new("ShaderNodeMath"); piso.operation = "FLOOR"
mod = nt.nodes.new("ShaderNodeMath"); mod.operation = "FLOORED_MODULO"; mod.inputs[1].default_value = 2
ruido = nt.nodes.new("ShaderNodeTexNoise"); ruido.inputs["Scale"].default_value = 0.6
mezcla = nt.nodes.new("ShaderNodeMix"); mezcla.data_type = "RGBA"
mezcla.inputs["A"].default_value = (0.055, 0.20, 0.035, 1)
mezcla.inputs["B"].default_value = (0.075, 0.26, 0.05, 1)
var = nt.nodes.new("ShaderNodeMix"); var.data_type = "RGBA"; var.blend_type = "MULTIPLY"
var.inputs["Factor"].default_value = 0.35
nt.links.new(coord.outputs["Object"], sep.inputs[0])
nt.links.new(sep.outputs["X"], div.inputs[0])
nt.links.new(div.outputs[0], piso.inputs[0])
nt.links.new(piso.outputs[0], mod.inputs[0])
nt.links.new(mod.outputs[0], mezcla.inputs["Factor"])
nt.links.new(mezcla.outputs["Result"], var.inputs["A"])
nt.links.new(ruido.outputs["Color"], var.inputs["B"])
nt.links.new(var.outputs["Result"], bsdf.inputs["Base Color"])
pasto.data.materials.append(m)
# El plano escala 150 × 110 pero la textura va en coordenadas del objeto: se corrige el paso.
div.inputs[1].default_value = 5.5 / 150

# Las líneas de cal.
cal = material("Cal", (0.85, 0.87, 0.85), 0.7)
L, A, G = 105, 68, 0.12
for y in (-A / 2, A / 2):
    caja("Lateral", (0, y, 0.01), (L, G, 0.02), cal)
for x in (-L / 2, L / 2, 0):
    caja("Fondo", (x, 0, 0.01), (G, A, 0.02), cal)
for x in (-L / 2 + 16.5, L / 2 - 16.5):
    caja("Área", (x, 0, 0.01), (G, 40.3, 0.02), cal)
for s in (-1, 1):
    for y in (-20.15, 20.15):
        caja("Área lado", (s * (L / 2 - 8.25), y, 0.01), (16.5, G, 0.02), cal)
bpy.ops.mesh.primitive_torus_add(major_radius=9.15, minor_radius=0.06, location=(0, 0, 0.01), major_segments=96)
bpy.context.object.scale.z = 0.15
bpy.context.object.data.materials.append(cal)

# Los arcos.
blanco = material("Arco", (0.9, 0.9, 0.9), 0.4)
for x in (-L / 2, L / 2):
    for y in (-3.66, 3.66):
        caja("Palo", (x, y, 1.22), (0.12, 0.12, 2.44), blanco)
    caja("Travesaño", (x, 0, 2.44), (0.12, 7.32, 0.12), blanco)

# La tribuna de enfrente, llena, y los carteles sin marca.
gente = bpy.data.materials.new("Hinchada")
gente.use_nodes = True
gn = gente.node_tree
vor = gn.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 90
osc = gn.nodes.new("ShaderNodeMix"); osc.data_type = "RGBA"; osc.blend_type = "MULTIPLY"
osc.inputs["Factor"].default_value = 0.93
osc.inputs["B"].default_value = (0.10, 0.095, 0.10, 1)
gris = gn.nodes.new("ShaderNodeHueSaturation"); gris.inputs["Saturation"].default_value = 0.55
gn.links.new(vor.outputs["Color"], osc.inputs["A"])
gn.links.new(osc.outputs["Result"], gris.inputs["Color"])
gn.links.new(gris.outputs["Color"], gn.nodes["Principled BSDF"].inputs["Base Color"])
gn.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 50, 9))
tribuna = bpy.context.object
tribuna.scale = (170, 30, 1)
tribuna.rotation_euler.x = math.radians(-34)
tribuna.data.materials.append(gente)
caja("Techo", (0, 64, 19), (170, 14, 0.6), material("Techo", (0.16, 0.17, 0.18)))
colores = [(0.05, 0.12, 0.35), (0.6, 0.08, 0.05), (0.85, 0.85, 0.8), (0.9, 0.55, 0.05)]
for i in range(-7, 8):
    caja("Cartel", (i * 9.5, 37.2, 0.5), (9.2, 0.25, 1.0), material(f"Cartel {i}", colores[i % 4], 0.5, 1.2))

# Los jugadores: humanos de MPFB en cinco poses, vestidos por equipo.
mallas = J.crear_poses([0, 1, -1, 0.5, -0.5])
equipos = [J.ropa("Local", (0.62, 0.06, 0.05), (0.92, 0.92, 0.92), (0.62, 0.06, 0.05)),
           J.ropa("Visita", (0.86, 0.88, 0.92), (0.05, 0.07, 0.16), (0.86, 0.88, 0.92))]
pelota = Vector((1.5, 1.2, 0))
def jugador(x, y, eq):
    # Miran más o menos hacia la pelota, que es para donde mira todo el mundo en una cancha.
    hacia = pelota - Vector((x, y, 0))
    giro = math.atan2(hacia.y, hacia.x) - math.pi / 2 + random.uniform(-0.6, 0.6)
    J.poner(random.choice(mallas), equipos[eq], x, y, giro)
formacion = [(-48, 0), (-34, -18), (-36, -6), (-36, 6), (-34, 18), (-18, -20), (-20, -4), (-16, 10), (-6, 22), (-4, -8), (2, 3)]
for x, y in formacion:
    jugador(x + random.uniform(-2, 2) + 6, y + random.uniform(-2, 2), 0)
    jugador(-x + random.uniform(-2, 2) - 4, -y + random.uniform(-3, 3), 1)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(1.5, 1.2, 0.11))
bpy.context.object.data.materials.append(blanco)

# Luz de viernes a la noche: torres de iluminación, el cielo oscuro.
mundo = bpy.data.worlds.new("Noche")
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.025, 0.04, 1)
mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
e.world = mundo
for x, y in ((-60, -45), (60, -45), (-60, 45), (60, 45)):
    bpy.ops.object.light_add(type="SPOT", location=(x, y, 38))
    luz = bpy.context.object
    luz.data.energy = 420_000
    luz.data.spot_size = math.radians(80)
    luz.data.shadow_soft_size = 3
    direccion = Vector((0, 0, 0)) - luz.location
    luz.rotation_euler = direccion.to_track_quat("-Z", "Y").to_euler()

# La cámara alta de la transmisión, en la platea, mirando el medio.
bpy.ops.object.camera_add(location=(0, -78, 27))
cam = bpy.context.object
cam.data.lens = 52
apunta = Vector((-2, 2, 0)) - cam.location
cam.rotation_euler = apunta.to_track_quat("-Z", "Y").to_euler()
e.camera = cam

# Con la configuración de fábrica Cycles no sabe de la GPU: se la presenta.
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for d in prefs.devices:
    d.use = True
e.render.engine = "CYCLES"
e.cycles.device = "GPU"
e.cycles.samples = 64
e.cycles.use_denoising = True
e.view_settings.view_transform = "AgX"
e.view_settings.look = "AgX - Punchy"
e.render.resolution_x, e.render.resolution_y = 1280, 720
e.render.image_settings.file_format = "PNG"
e.render.filepath = SALIDA
bpy.ops.render.render(write_still=True)
print("LISTO", SALIDA)
