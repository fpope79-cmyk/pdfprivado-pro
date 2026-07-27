# PDFPrivado Pro - Motor PDF -> Word v18 candidato

Fecha: 2026-07-26
Base estable de referencia: v11 (SSIM estricto oficial 144 dpi = 0.7854564260168981)
Base de desarrollo: v14 candidato

## Objetivo de esta iteración

Mejorar la fidelidad y la editabilidad general sin añadir reglas por documento, nombre de archivo o número de página. Se mantiene la puerta de no promover una versión a estable hasta superar el benchmark oficial Node/docx -> LibreOffice -> PNG 144 dpi -> SSIM.

## Cambios del motor

1. Anclaje adaptativo por palabra OCR
   - Detecta líneas donde el flujo continuo de Word deriva respecto a las cajas OCR.
   - Inserta tabulaciones Word en las X reales de las palabras solo cuando la deriva es significativa.
   - Ajusta la anchura de palabras con límites de seguridad y confianza OCR.

2. Baseline OCR robusta
   - La referencia vertical usa la mediana de los fondos de palabra en vez del extremo inferior de la caja unión.
   - Evita que una g/y/p, sello o ruido desplace toda la línea.

3. Retroalimentación visual coherente con el renderer final
   - La calibración visual dibuja la misma geometría de segmentos/palabras que el DOCX.
   - Puede inferir color, negrita, cursiva y, con evidencia fuerte, familia tipográfica estándar.
   - Se añadió ajuste vertical fino por línea, con aceptación local y puerta atómica de página.

4. OCR adaptativo de tercera pasada
   - Fast -> balanced -> precise cuando la evidencia de calidad lo exige.
   - La pasada precisa no puede sustituir una OCR válida si pierde cobertura textual de forma material.

5. Páginas híbridas PDF + imagen
   - En modo automático, una página con texto PDF nativo y una región raster relevante puede ejecutar OCR adicional.
   - El texto OCR que duplica texto nativo se elimina por geometría + similitud textual.
   - El texto que solo existe dentro de la imagen se conserva como líneas OCR editables.
   - Las líneas nativas conservan sus métricas PDF y las OCR sus calibraciones propias.

6. Separación raster más segura
   - El renderer ya elimina el texto nativo al crear la capa gráfica; el inpainting se aplica solo a líneas OCR raster.
   - Reduce el riesgo de dañar reglas, fondos y gráficos situados tras texto PDF nativo.

## Métricas internas

### Geometría horizontal

Banco: 40 páginas OCR, 1.503 líneas.

- MAE de comienzo de palabra antes del anclaje: 1.463957 pt
- MAE con anclaje adaptativo: 0.509579 pt
- reducción media: 65.19 %
- líneas ancladas: 715
- regresiones en el proxy geométrico: 0

### Referencia vertical

Proxy visual sobre 1.152 líneas OCR de alta confianza:

- error absoluto medio usando fondo de caja unión: 4.3672 pt
- error absoluto medio usando mediana robusta: 2.5565 pt
- mediana robusta mejor: 1.047 líneas
- caja unión mejor: 64 líneas
- empates: 41

### Render real DOCX -> LibreOffice -> 144 dpi (proxy relativo)

Se usó un harness OOXML/Python para comparar el núcleo geométrico v14 frente al nuevo núcleo (anclaje + baseline robusta) en las 40 páginas OCR disponibles.

- SSIM medio proxy v14: 0.793898
- SSIM medio proxy nuevo núcleo: 0.818113
- delta medio: +0.024215
- 38 páginas mejoran
- 2 empatan
- 0 regresiones

Este valor NO sustituye al benchmark oficial porque el harness no usa el paquete Node `docx` ni reproduce toda la calibración del frontend.

### Páginas híbridas

Fixture de validación: 3 líneas de texto PDF nativo + imagen incrustada con 2 líneas de texto.

Resultado del merge: 5 líneas editables; las 3 lecturas OCR duplicadas del texto nativo se descartaron y las 2 líneas presentes únicamente en la imagen se conservaron como OCR editable.

## Pruebas superadas

- npm run verify:convert-docx
- test-convert-export-core.mjs
- test-convert-export-adaptive-ocr.mjs
- test-convert-export-layout-refresh-v3.mjs
- test-ocr-original-readable-layout.mjs
- test-ocr-original-visual-layout.mjs
- verify-convert-docx-drawingml.mjs
- node --check de los módulos modificados
- py_compile de scripts de benchmark

## Estado

v11 continúa siendo la última versión estable estrictamente validada.

v18 es candidato. Sus cambios geométricos superan la puerta relativa de 40 páginas sin regresiones y las nuevas capas de feedback visual/híbrido están protegidas por aceptación basada en evidencia. Falta ejecutar el benchmark oficial completo con el runtime Node `docx` disponible antes de promover v18 a estable.
