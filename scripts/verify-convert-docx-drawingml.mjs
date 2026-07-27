import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const formats=fs.readFileSync(path.join(root,"src","convert-export-formats.js"),"utf8");
const index=fs.readFileSync(path.join(root,"src","index.html"),"utf8");
const prepare=fs.readFileSync(path.join(root,"scripts","prepare-frontend.mjs"),"utf8");
const checks=[
 ["DrawingML Word shape", formats.includes("wordprocessingShape") && formats.includes("wps",)],
 ["Conversión VML visible a DrawingML", formats.includes("modernizeEditableDocxTextboxes") && formats.includes("drawingMlTextboxParagraph")],
 ["Texto oculto visual conservado", formats.includes("docxTextboxHasHiddenText(shape)")],
 ["Posición absoluta por página", formats.includes('relativeFrom: "page"') && formats.includes("DOCX_EMUS_PER_POINT")],
 ["Cuadro sin relleno ni borde", formats.includes('docxXmlElement(documentXml, "a", "noFill")')],
 ["JSZip local en interfaz", index.includes("vendor/jszip/jszip.min.js")],
 ["JSZip copiado al frontend", prepare.includes("node_modules", "jszip") && prepare.includes("vendor", "jszip")],
 ["Sin CDN nueva", !index.includes("cdn.jsdelivr") && !index.includes("cdnjs.cloudflare")],
];
let failed=false; for(const [name,ok] of checks){console.log(`${ok?"OK  ":"ERROR"} ${name}`); if(!ok) failed=true;}
if(failed) process.exit(1);
