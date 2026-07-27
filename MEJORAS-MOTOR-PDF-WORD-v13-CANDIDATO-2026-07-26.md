# PDFPrivado Pro — Motor PDF→Word v13 candidato

Fecha: 2026-07-26

## Base estable

La base estrictamente validada continúa siendo **v11**, con SSIM estricto medio a 144 dpi de `0.7854564260168981` sobre el banco de 41 páginas y cero regresiones frente a v10.

v13 es un candidato y **no sustituye a v11 como versión estable** hasta que pueda ejecutarse la puerta DOCX→render→SSIM completa.

## Problema genérico encontrado

El modelo OCR real genera `styledRuns` por palabra. Esos runs no contienen los espacios que existen entre palabras y, además, nacen con estilos por defecto. En el generador DOCX anterior podían ocurrir dos efectos:

1. palabras OCR consecutivas podían perder su separación al convertirse en runs de Word;
2. la negrita, cursiva o color inferidos visualmente a nivel de línea podían quedar anulados por los estilos por defecto de esos runs.

El banco headless anterior no reproducía esta situación porque preparaba OCR con `styledRuns: []`.

## Cambios de v13

- OCR se emite como línea completa en Word cuando la fuente es OCR. Conserva espacios y permite que la calibración visual de línea sea la fuente de verdad.
- Los runs mixtos se mantienen para texto PDF nativo fiable.
- El preparador headless genera ahora runs por palabra para que el banco represente el modelo real de la aplicación.
- La supresión de texto raster usa clasificación por componentes también en páginas OCR densas. Se elimina la rama de borrado rectangular ciego.
- Se endurece la detección de reglas verticales: trazos estrechos de glifos como `I/l` ya no se confunden fácilmente con bordes de tabla; los bordes que atraviesan prácticamente toda la banda OCR siguen protegidos.
- Se añade un perfil genérico de protección de elementos OCR de baja confianza y tamaño atípico, pensado para no destruir logos, sellos, firmas y fragmentos gráficos.
- Cuando existe capa gráfica, una línea protegida no se duplica como texto editable ni participa en la calibración visual.
- No se han añadido reglas por nombre de archivo, documento ni número de página.

## Validación automática

Superados:

- `test-pdf-word-engine.mjs`
- `test-convert-export-core.mjs`
- `test-convert-export-adaptive-ocr.mjs`
- `test-convert-export-layout-refresh-v3.mjs`
- `test-ocr-original-readable-layout.mjs`
- `test-ocr-original-visual-layout.mjs`
- `verify-convert-docx-drawingml.mjs`
- comprobación de sintaxis JS y Python

El test de DrawingML confirma además que se mantienen formas Word DrawingML, posicionamiento absoluto, cuadros sin relleno/borde, JSZip local y ausencia de CDN nueva.

## Comprobación visual/proxy raster

Se compararon 7 páginas OCR reales de tres familias distintas: AXON de 1 y 13 páginas, y Maíz. Todas reducen el residuo de tinta raster en regiones OCR no protegidas respecto a v12.

La reducción relativa media del proxy es `69.52 %` y la mediana `89.73 %`. Este dato **no es SSIM**; sirve únicamente para comprobar la mejora de separación texto/gráfico antes de la puerta estricta.

La inspección visual confirma especialmente:

- `190604 p1`: desaparece la mayor parte del texto fantasma y se conservan logo, firma, sello y líneas de tabla;
- `190213 p1/p2`: se limpian mejor formularios densos sin borrar las estructuras de tablas, firmas y sellos;
- `190213 p13`: se conserva el logotipo AXON mientras el cuerpo OCR sale de la capa raster;
- `Maiz p1/p2/p15`: se elimina el texto fantasma manteniendo sellos, firma, ruido/papel y el logotipo HUERCASA de la cabecera.

## Puerta pendiente

La instalación disponible no contiene el paquete npm `docx`, por lo que no se puede generar en este entorno el banco DOCX completo y renderizarlo para obtener SSIM estricto. No se declara ninguna mejora de SSIM de v13 hasta pasar esa puerta.

Criterio de aceptación: v13 solo se convertirá en estable cuando supere v11 en el banco y no introduzca regresiones significativas, manteniendo editabilidad.
