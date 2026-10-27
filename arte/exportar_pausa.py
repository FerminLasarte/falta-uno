"""
Exporta la pausa: levantás la vista del celular y mirás la tele. Se corre con living.blend:

  Blender -b arte/living.blend --python arte/exportar_pausa.py -- <carpeta> [cuadros]

Escribe en <carpeta>:

  pausa.png        Mirando la tele, con el foco en la pantalla. Sin el celular ni las manos.
  pausa.json       Las cuatro esquinas de la pantalla de la tele en el cuadro, para poner encima
                   la placa del menú, que es HTML: arriba izq, arriba der, abajo der, abajo izq.
  transicion/      La mirada que sube, cuadro por cuadro (0000.png…): de los ojos de siempre a los
                   de la tele. Al volver al celular el juego la pasa al revés.

La cámara de la pausa es "Ojos tele". La de siempre, "Ojos", no se toca: exportar_capas.py la
sigue usando. No guarda el archivo.
"""
import json
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Vector

args = sys.argv[sys.argv.index("--") + 1:]
SALIDA = args[0]
CUADROS = int(args[1]) if len(args) > 1 else 18
ANCHO, ALTO = 2560, 1600

escena = bpy.context.scene
objetos = bpy.data.objects
ojos = objetos["Ojos"]
ojos_tele = objetos["Ojos tele"]
tele = objetos["Tele pantalla"]
celular = objetos["Celular"]

# Al mirar la tele el ojo se acomoda a la pantalla: el living se oscurece y la tele no se lava.
EXPOSICION_PAUSA = -1.8
exposicion_celular = escena.view_settings.exposure

arbol = escena.compositing_node_group
salida_grupo = next(n for n in arbol.nodes if n.bl_idname == "NodeGroupOutput")
capa_fondo = next(n for n in arbol.nodes if n.bl_idname == "CompositorNodeRLayers" and n.layer == "Fondo")


def esquinas(camara):
    puntos = [world_to_camera_view(escena, camara, tele.matrix_world @ v.co) for v in tele.data.vertices]
    puntos = [(p.x, 1 - p.y) for p in puntos]
    # Ordenadas como las espera el CSS: arriba izq, arriba der, abajo der, abajo izq.
    arriba = sorted(sorted(puntos, key=lambda p: p[1])[:2])
    abajo = sorted(sorted(puntos, key=lambda p: p[1])[2:])
    return [arriba[0], arriba[1], abajo[1], abajo[0]]


def una_pasada(con_manos):
    """Todo en la capa Fondo, con el desenfoque de la cámara: la composición no desenfoca."""
    for vl in escena.view_layers:
        vl.use = vl.name == "Fondo"
    fondo = escena.view_layers["Fondo"]
    for lc in fondo.layer_collection.children:
        if lc.name in ("Primer plano", "Luces manos"):
            lc.exclude = not con_manos
    arbol.links.new(capa_fondo.outputs["Image"], salida_grupo.inputs[0])


def renderizar(ruta, porcentaje):
    r = escena.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = ANCHO, ALTO, porcentaje
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.filepath = ruta
    bpy.ops.render.render(write_still=True)


def suave(t):
    return t * t * (3 - 2 * t)


def exportar():
    os.makedirs(os.path.join(SALIDA, "transicion"), exist_ok=True)

    # La toma quieta.
    escena.camera = ojos_tele
    escena.view_settings.exposure = EXPOSICION_PAUSA
    una_pasada(con_manos=False)
    bpy.context.view_layer.update()
    with open(os.path.join(SALIDA, "pausa.json"), "w", encoding="utf-8") as f:
        json.dump({"tele": esquinas(ojos_tele)}, f, indent=2)
        f.write("\n")
    renderizar(os.path.join(SALIDA, "pausa.png"), 100)

    # La transición: una cámara que va de unos ojos a los otros. El celular cuelga de "Ojos":
    # se suelta en su lugar y baja un poco, como las manos cuando levantás la vista.
    mundo = celular.matrix_world.copy()
    celular.parent = None
    celular.matrix_world = mundo
    celular_desde = celular.location.copy()
    inclinacion_desde = celular.rotation_euler.x
    pantalla = objetos["Celular pantalla"]
    # La app es HTML: en el video la pantalla es una luz pareja que el juego tapa al arrancar.
    luz = bpy.data.materials.new("Pantalla en transición")
    luz.use_nodes = True
    emision = luz.node_tree.nodes.new("ShaderNodeEmission")
    emision.inputs["Color"].default_value = (0.86, 0.88, 0.9, 1)
    emision.inputs["Strength"].default_value = 0.6
    salida_mat = next(n for n in luz.node_tree.nodes if n.bl_idname == "ShaderNodeOutputMaterial")
    luz.node_tree.links.new(emision.outputs[0], salida_mat.inputs["Surface"])
    pantalla.is_holdout = False
    pantalla.data.materials.clear()
    pantalla.data.materials.append(luz)

    datos = bpy.data.cameras.new("Mirada")
    datos.sensor_width = ojos.data.sensor_width
    datos.dof.use_dof = True
    camara = bpy.data.objects.new("Mirada", datos)
    escena.collection.objects.link(camara)
    camara.location = ojos.location.copy()
    camara.rotation_mode = "XYZ"
    escena.camera = camara
    una_pasada(con_manos=True)

    desde, hasta = Euler(ojos.rotation_euler), Euler(ojos_tele.rotation_euler)
    foco_desde = ojos.data.dof.focus_distance
    foco_hasta = ojos_tele.data.dof.focus_distance
    for i in range(CUADROS):
        t = suave(i / (CUADROS - 1))
        camara.rotation_euler = Euler([a + (b - a) * t for a, b in zip(desde, hasta)])
        datos.lens = ojos.data.lens + (ojos_tele.data.lens - ojos.data.lens) * t
        # El foco viaja en distancia inversa: así el salto de cerca a lejos se ve parejo.
        datos.dof.focus_distance = 1 / (1 / foco_desde + (1 / foco_hasta - 1 / foco_desde) * t)
        datos.dof.aperture_fstop = 2.0 + 0.8 * t
        escena.view_settings.exposure = exposicion_celular + (EXPOSICION_PAUSA - exposicion_celular) * t
        celular.location = celular_desde - Vector((0, 0, 0.05 * t))
        celular.rotation_euler.x = inclinacion_desde + math.radians(-12) * t
        bpy.context.view_layer.update()
        renderizar(os.path.join(SALIDA, "transicion", f"{i:04d}.png"), 50)


exportar()
print("LISTO", SALIDA)
