# PDFPrivado Pro — Motor PDF→Word v14 candidato

Fecha: 2026-07-26

## Base estable

La última versión promovida mediante la puerta estricta continúa siendo **v11**, con SSIM medio a 144 dpi de `0.7854564260168981` sobre 41 páginas y cero regresiones frente a v10.

v14 es un candidato. No sustituye a v11 hasta superar la generación DOCX completa, renderizado con LibreOffice y comparación SSIM página por página.

## Problema genérico encontrado

v13 corrigió la separación de palabras OCR y mejoró la capa raster, pero todavía convertía una línea OCR completa como flujo continuo. Esto funciona bien para prosa, pero no para formularios, tablas, fichas y documentos con dos campos alejados horizontalmente dentro de la misma línea OCR.

Un espacio visual grande podía convertirse en un espacio normal de Word. Para intentar ocupar el ancho total de la caja OCR, el ajuste tipográfico terminaba compensando también ese espacio vacío y alterando tamaño, anchura y posición de los textos.

## Cambios de v14

### Segmentación geométrica de línea OCR

- Las palabras OCR se ordenan por su geometría real X.
- Los huecos internos muy grandes separan la línea en segmentos editables.
- El umbral es relativo al tamaño tipográfico de la línea, a la mediana tipográfica de la página y al espacio observado localmente.
- El umbral final conservador usa `3.7 × tamaño de fuente de línea` dentro de la combinación de límites geométricos.
- Los segmentos se reconstruyen en Word mediante tabulaciones con posiciones calculadas desde sus coordenadas X originales.
- La prosa normal permanece como texto continuo; no se convierte cada palabra en una tabulación.

### Ajuste de fuente basado en tinta, no en huecos

Cuando una línea tiene varios segmentos, el ajuste de tamaño ya no utiliza el ancho de la caja completa —que incluye columnas o espacios vacíos—. Usa la suma de los anchos de los segmentos con tinta. Así, un formulario con dos campos alejados no obliga a encoger o estirar el texto para cubrir el vacío intermedio.

### Escala horizontal conservadora por segmento

Para OCR de confianza suficiente, un segmento puede recibir una corrección horizontal moderada mediante la escala del run de Word:

- requiere al menos tres caracteres útiles;
- confianza OCR mínima de 70 cuando está disponible;
- solo se acepta una corrección entre `90 %` y `110 %`;
- se ignoran correcciones de aproximadamente `±1 %` para evitar ruido.

El objetivo es acercar el ancho visible al original sin convertir el motor en un conjunto de excepciones.

### Banco headless alineado con runtime

El preparador del banco conserva ahora geometría X/Y/ancho/alto de los runs y deriva los mismos segmentos usados por la aplicación. Esto evita validar una representación simplificada distinta de la entrada real del motor.

## Validación geométrica sobre el banco OCR

Se ejecutó un proxy independiente sobre las **40 páginas OCR** del banco, con **1.503 líneas** evaluables. El proxy mide el error absoluto medio de la posición X de inicio de cada palabra; no mide apariencia global.

Resultados v13 → v14:

- MAE medio de todas las líneas: `3.548018 → 1.463957`, reducción de `58.74 %`.
- Líneas en las que v14 activa segmentación: `127`.
- En esas 127 líneas: `25.695633 → 1.031519`, reducción de `95.99 %`.
- Líneas mejoradas por la segmentación: `127`.
- Regresiones detectadas por este proxy: `0`.

Ejemplos fuertes del banco incluyen campos/formularios de AXON, cabeceras y bloques separados de Maíz y páginas de bajo texto nativo del manual SD700. No hay condiciones por nombre de esos documentos: son únicamente muestras del resultado de la misma regla general.

**Estas cifras no son SSIM.** Solo prueban que la nueva representación reproduce mucho mejor la geometría horizontal OCR antes de pasar por Word.

## Ajuste conservador adicional

Se evaluó una recalibración robusta de baseline/posición vertical. Se descartó porque afectaba demasiadas líneas sin disponer de la puerta estricta de render para demostrar ausencia de regresiones. v14 conserva por tanto la lógica vertical de v13.

También se ensayaron umbrales de segmentación más agresivos. Reducían algo más el error medio, pero introducían falsas separaciones en ciertas líneas. El candidato se fijó en el límite conservador que mantiene **cero regresiones del proxy**.

## Pruebas automáticas superadas

- `npm run verify:convert-docx`
- `test-convert-export-core.mjs`
- `test-convert-export-adaptive-ocr.mjs`
- `test-convert-export-layout-refresh-v3.mjs`
- `test-ocr-original-readable-layout.mjs`
- `test-ocr-original-visual-layout.mjs`
- `verify-convert-docx-drawingml.mjs`
- sintaxis JavaScript
- compilación sintáctica Python

Se mantienen DrawingML, posicionamiento absoluto, cuadros sin relleno/borde, JSZip local y ausencia de CDN nueva.

## Reglas del motor

No se han añadido reglas por:

- nombre de archivo;
- documento;
- número de página;
- Seguro olivar, AXON, Maíz, SD700 ni otro ejemplar del banco.

## Puerta estricta pendiente

El entorno actual no contiene las dependencias npm necesarias para generar el banco DOCX completo y el acceso al registro npm no está disponible. LibreOffice sí está presente, pero sin el runtime DOCX de la aplicación no puede ejecutarse de forma honesta la cadena completa.

Por ello no se afirma que v14 supere todavía el SSIM `0.785456` de v11. La promoción exige repetir el banco DOCX → LibreOffice → PNG 144 dpi → SSIM y conservar cero regresiones significativas.
