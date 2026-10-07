"""
Exporta las capas de la escena para el juego.

Se corre dentro de Blender con living.blend abierto (desde la consola de Python de Blender o
por MCP: exec(open(ruta).read())). Escribe en src/app/escena/capas/:

  fondo.webp        El living desenfocado. Opaco, a media resolución: está borroso igual.
  primer_plano.webp Manos, buzo y celular, nítidos, con alfa. La pantalla es un agujero.
  escena.json       Dónde cae la pantalla y la tele en el cuadro, en fracciones del cuadro.

El HTML de la app va entre las dos capas: el fondo atrás, la app en el agujero, y las manos
adelante tapando lo que tienen que tapar (los pulgares, el borde del celular).
"""
import json
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

RAIZ = os.path.dirname(os.path.dirname(bpy.data.filepath))
SALIDA = os.path.join(RAIZ, "src", "app", "escena", "capas")
ANCHO, ALTO = 2560, 1600  # 16:10, el cuadro de Steam Deck; en 16:9 se recorta arriba y abajo

escena = bpy.context.scene
camara = escena.camera
objetos = bpy.data.objects
arbol = escena.compositing_node_group
nodos = arbol.nodes
salida_grupo = next(n for n in nodos if n.bl_idname == "NodeGroupOutput")
capa_fondo = next(n for n in nodos if n.bl_idname == "CompositorNodeRLayers" and n.layer == "Fondo")
capa_frente = next(n for n in nodos if n.bl_idname == "CompositorNodeRLayers" and n.layer == "Primer plano")
desenfoque = next(n for n in nodos if n.bl_idname == "CompositorNodeDefocus")
mezcla = next(n for n in nodos if n.bl_idname == "CompositorNodeAlphaOver")


def proyectar(obj, puntos_locales):
    """Puntos locales de un objeto a fracciones del cuadro: x a la derecha, y hacia abajo."""
    salida = []
    for p in puntos_locales:
        v = world_to_camera_view(escena, camara, obj.matrix_world @ Vector(p))
        salida.append((v.x, 1 - v.y))
    return salida


def caja(obj):
    """Rectángulo que ocupa un objeto en el cuadro: izquierda, arriba, ancho, alto."""
    puntos = proyectar(obj, [v.co for v in obj.data.vertices])
    xs = [p[0] for p in puntos]
    ys = [p[1] for p in puntos]
    return min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)


def renderizar(ruta, capa, porcentaje, alfa):
    for vl in escena.view_layers:
        vl.use = vl.name == capa
    arbol.links.new(
        (desenfoque.outputs[0] if capa == "Fondo" else capa_frente.outputs["Image"]),
        salida_grupo.inputs[0],
    )
    r = escena.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = ANCHO, ALTO, porcentaje
    r.use_border = False
    r.image_settings.file_format = "WEBP"
    r.image_settings.color_mode = "RGBA" if alfa else "RGB"
    r.image_settings.quality = 92
    r.filepath = ruta
    bpy.ops.render.render(write_still=True)


def exportar():
    os.makedirs(SALIDA, exist_ok=True)
    pantalla = objetos["Celular pantalla"]
    pantalla.is_holdout = True

    izq, arriba, ancho, alto = caja(pantalla)
    ancho_m = pantalla.dimensions.x
    radio_m = 0.0095 - 0.0019  # radio de la esquina del vidrio menos el borde negro
    # La cámara frontal tapa la pantalla: la barra de estado se acomoda alrededor.
    cam_izq, cam_arriba, cam_ancho, cam_alto = caja(objetos["Cámara frontal"])
    # La tele queda cortada por el borde de arriba: se exporta el rectángulo entero,
    # aunque parte caiga fuera del cuadro.
    t_izq, t_arriba, t_ancho, t_alto = caja(objetos["Tele pantalla"])

    datos = {
        "cuadro": {"ancho": ANCHO, "alto": ALTO},
        "pantalla": {
            "izquierda": izq,
            "arriba": arriba,
            "ancho": ancho,
            "alto": alto,
            "radio": radio_m / ancho_m,  # en fracciones del ancho de la pantalla
        },
        # En fracciones de la pantalla, no del cuadro.
        "camaraFrontal": {
            "centroY": (cam_arriba + cam_alto / 2 - arriba) / alto,
            "diametro": cam_ancho / ancho,
        },
        "tele": {"izquierda": t_izq, "arriba": t_arriba, "ancho": t_ancho, "alto": t_alto},
    }
    with open(os.path.join(SALIDA, "escena.json"), "w", encoding="utf-8") as f:
        json.dump(datos, f, indent=2)
        f.write("\n")

    # El desenfoque se mide en píxeles: a media resolución, la mitad.
    blur_original = desenfoque.blur_max
    desenfoque.blur_max = blur_original / 2
    renderizar(os.path.join(SALIDA, "fondo.webp"), "Fondo", 50, alfa=False)
    desenfoque.blur_max = blur_original
    renderizar(os.path.join(SALIDA, "primer_plano.webp"), "Primer plano", 100, alfa=True)

    # Dejar el archivo como estaba: las dos capas activas y la composición completa.
    for vl in escena.view_layers:
        vl.use = True
    arbol.links.new(mezcla.outputs[0], salida_grupo.inputs[0])
    pantalla.is_holdout = False
    return datos


print(exportar())
