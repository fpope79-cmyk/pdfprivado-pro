# PDFPrivado Pro — mejoras y herramientas futuras

Este documento registra ideas aplazadas. No deben anunciarse como disponibles hasta que estén implementadas, verificadas y funcionen completamente de forma local.

## Principios obligatorios

- Los PDF nunca se suben a servidores.
- Funcionamiento sin conexión y sin CDN.
- Sin telemetría, analítica, cookies ni rastreo.
- No enviar nombres, rutas, contraseñas ni contenido de archivos a Internet.
- No sobrescribir originales; guardar resultados como archivos nuevos.
- Las contraseñas nunca deben almacenarse.

## Procesamiento por lotes

Futura herramienta premium para aplicar operaciones a muchos PDF sin abrirlos uno por uno:

- Rotar todos los documentos o aplicar reglas distintas por archivo.
- Página completa, pares, impares y rangos.
- Vista previa de la primera página de cada PDF.
- Reglas reutilizables y patrones de nombres.
- Progreso y errores archivo por archivo.
- Guardado en una carpeta elegida sin sobrescribir.
- Ampliar después a metadatos, numeración, protección y otras operaciones compatibles.

La rotación normal no será una herramienta independiente: permanece integrada en el visor central y en Organizar páginas.

## Orientación y escaneos

- Detección local de páginas giradas o boca abajo, con revisión antes de aplicar.
- Herramienta «Mejorar escaneos»: enderezar inclinación, recortar márgenes y limpiar fondos.
- No anunciar detección automática hasta que sea fiable.

## Unir PDF

- Marcadores automáticos por cada documento de origen.
- Portadas o páginas separadoras opcionales antes de cada documento.
- Probar cuidadosamente las estructuras PDF de bajo nivel antes de habilitarlo.

## Dividir PDF

- División por marcadores del documento.
- División inteligente local por títulos o reglas de contenido, sin servicios externos.
- Mejorar la división por tamaño aproximado si puede hacerse de forma fiable.
- Apertura de PDF protegidos mediante contraseña con una biblioteca local adecuada.

## Visor y aplicación de escritorio

- Probar la asociación real de archivos `.pdf` en un instalador.
- Añadir instancia única para que un segundo PDF se abra en la ventana existente.
- Valorar pestañas para varios documentos sin aumentar innecesariamente el consumo de memoria.
- Historial de documentos recientes solo local, opcional y desactivable.

## Herramientas avanzadas sujetas a viabilidad

- OCR completamente local.
- Compresión avanzada con control de calidad.
- Conversión a Word u otros formatos con fidelidad suficiente.
- Edición real de texto existente conservando fuentes y estructura.
- Formularios, anotaciones, firmas y protección, siempre localmente.

## Lenguaje comercial

- Usar «sin límites diarios», no «uso completamente ilimitado».
- No decir «archivos infinitos».
- No prometer OCR, compresión avanzada, Word, edición completa de texto ni lotes hasta que funcionen realmente.
