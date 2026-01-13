import fs from "fs/promises";
import xml2js from "xml2js";
import nodemailer from "nodemailer";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; // Importación corregida para ES Modules

dotenv.config();

/* =====================================================
    ⚙️ CONFIGURACIÓN DESDE VARIABLES DE ENTORNO
===================================================== */
const { 
    EMAIL_USER, EMAIL_PASS, EMAIL_SERVICE_TYPE,
    SMTP_HOST, SMTP_PORT, SMTP_SECURE,
    DB_HOST, DB_USER, DB_PASS, DB_NAME 
} = process.env;

const dbConfig = { 
    host: DB_HOST, 
    user: DB_USER, 
    password: DB_PASS, 
    database: DB_NAME 
};

/* =====================================================
    📝 1. GENERADOR DE PLANTILLA XML (CUERPO DEL CORREO)
===================================================== */
async function crearPlantillaXML() {
    const htmlFactura = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; color: #334155; padding: 20px; }
        .invoice-box { max-width: 650px; margin: auto; background: #fff; padding: 30px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .brand { font-size: 28px; font-weight: bold; color: #0f172a; }
        .status-badge { background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: bold; }
        .grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .grid td { font-size: 14px; line-height: 1.6; vertical-align: top; }
        .table-main { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table-main th { background: #f8fafc; text-align: left; padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; }
        .table-main td { padding: 12px; border: 1px solid #e2e8f0; font-size: 14px; }
        .total { font-weight: bold; background: #f8fafc; font-size: 18px; color: #0f172a; }
        .footer-note { background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; margin-top: 25px; }
    </style>
</head>
<body>
    <div class="invoice-box">
        <div class="header">
            <div class="brand">CYGNUS <span style="font-weight: 200;">CORP</span></div>
            <div class="status-badge">DOCUMENTO OFICIAL</div>
        </div>
        <table class="grid">
            <tr>
                <td><strong>De:</strong><br>Operaciones Técnicas Cygnus<br>Sistemas de Red Global</td>
                <td style="text-align: right;"><strong>Para:</strong><br>{{NOMBRE_RECEPTOR}}<br>{{IDENTIFICADOR_USUARIO}}</td>
            </tr>
            <tr>
                <td style="padding-top: 10px;"><strong>Folio:</strong> #{{ID_TRANSACCION}}</td>
                <td style="padding-top: 10px; text-align: right;"><strong>Fecha:</strong> {{FECHA_ACTUAL}}</td>
            </tr>
        </table>
        <table class="table-main">
            <thead>
                <tr><th>SERVICIO / CONCEPTO</th><th style="text-align: right;">VALOR UNITARIO</th></tr>
            </thead>
            <tbody>
                <tr><td>{{CONCEPTO_1}}</td><td style="text-align: right;">{{VALOR_1}}</td></tr>
                <tr><td>{{CONCEPTO_2}}</td><td style="text-align: right;">{{VALOR_2}}</td></tr>
                <tr><td>{{CONCEPTO_3}}</td><td style="text-align: right;">{{VALOR_3}}</td></tr>
                <tr class="total"><td>TOTAL LIQUIDADO</td><td style="text-align: right;">{{TOTAL_FINAL}}</td></tr>
            </tbody>
        </table>
        <div class="footer-note">
            > SYSTEM_LOG: Operación procesada bajo protocolo {{TRACK_ID}}<br>
            > NOTA: {{MENSAJE_TECNICO_O_NOTA}}
        </div>
        <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px;">Notificación automática Cygnus Corp. El Salvador.</p>
    </div>
</body>
</html>`;

    const xmlTemplate = `<mensaje><html><![CDATA[${htmlFactura}]]></html></mensaje>`;
    await fs.writeFile("mensaje.xml", xmlTemplate, "utf8");
    console.log("📂 Archivo mensaje.xml (HTML) generado.");
}

/* =====================================================
    📄 2. GENERADOR DE PDF (REPRESENTACIÓN GRÁFICA)
===================================================== */
function generarPDFDTE(fila) {
    const doc = new jsPDF();
    
    // Header Estilo Cygnus
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("CYGNUS CORP", 14, 25);
    doc.setFontSize(10);
    doc.text("DOCUMENTO TRIBUTARIO ELECTRÓNICO (DTE)", 125, 25);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(12);
    doc.text("EMISOR:", 14, 50);
    doc.setFontSize(10);
    doc.text("Operaciones Técnicas Cygnus\nEl Salvador, C.A.", 14, 56);

    doc.setFontSize(12);
    doc.text("RECEPTOR:", 120, 50);
    doc.setFontSize(10);
    doc.text(`${fila.nombre}\n${fila.email}`, 120, 56);

    // Tabla usando el import autoTable corregido
    autoTable(doc, {
        startY: 75,
        head: [['CONCEPTO / DESCRIPCIÓN', 'VALOR']],
        body: [
            [fila.concepto1, fila.valor1],
            [fila.concepto2, fila.valor2],
            [fila.concepto3, fila.valor3],
        ],
        foot: [['TOTAL LIQUIDADO', fila.total]],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    const finalY = doc.lastAutoTable.finalY;
    doc.setFillColor(30, 41, 59);
    doc.rect(14, finalY + 10, 182, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("courier", "normal");
    doc.text(`> PROTOCOLO: ${fila.track_id}\n> ID TRANSACCIÓN: ${fila.id_transaccion}`, 18, finalY + 18);

    return Buffer.from(doc.output('arraybuffer'));
}

/* =====================================================
    🧩 3. RENDERIZADOR DE DATOS HTML
===================================================== */
function renderizarHTML(template, fila) {
    const data = {
        NOMBRE_RECEPTOR: fila.nombre || "Cliente",
        IDENTIFICADOR_USUARIO: fila.email,
        ID_TRANSACCION: fila.id_transaccion,
        FECHA_ACTUAL: new Date().toLocaleDateString(),
        CONCEPTO_1: fila.concepto1, VALOR_1: fila.valor1,
        CONCEPTO_2: fila.concepto2, VALOR_2: fila.valor2,
        CONCEPTO_3: fila.concepto3, VALOR_3: fila.valor3,
        TOTAL_FINAL: fila.total,
        TRACK_ID: fila.track_id,
        MENSAJE_TECNICO_O_NOTA: fila.nota || "N/A"
    };
    return template.replace(/{{(\w+)}}/g, (_, key) => data[key] || "---");
}

/* =====================================================
    🚀 4. PROCESO DE EJECUCIÓN
===================================================== */
async function ejecutarEnvio() {
    let conn;
    try {
        await crearPlantillaXML();
        const xmlData = await fs.readFile("mensaje.xml", "utf8");
        const parsed = await xml2js.parseStringPromise(xmlData);
        const htmlBase = parsed.mensaje.html[0];

        conn = await mysql.createConnection(dbConfig);
        const [filas] = await conn.execute("SELECT * FROM facturas WHERE enviado = 0");

        if (filas.length === 0) return console.log("📭 Sin facturas pendientes.");

        const transporter = nodemailer.createTransport({
            service: EMAIL_SERVICE_TYPE === "GMAIL" ? "gmail" : undefined,
            host: EMAIL_SERVICE_TYPE !== "GMAIL" ? SMTP_HOST : undefined,
            port: EMAIL_SERVICE_TYPE !== "GMAIL" ? parseInt(SMTP_PORT) : undefined,
            secure: SMTP_SECURE === "true",
            auth: { user: EMAIL_USER, pass: EMAIL_PASS }
        });

        for (const fila of filas) {
            const htmlCuerpo = renderizarHTML(htmlBase, fila);
            const pdfAdjunto = generarPDFDTE(fila);
            const jsonDTE = JSON.stringify({
                dte: {
                    emisor: "CYGNUS CORP",
                    receptor: fila.nombre,
                    documento: fila.id_transaccion,
                    codigoGeneracion: fila.track_id,
                    total: fila.total
                }
            }, null, 2);

            await transporter.sendMail({
                from: `"Cygnus Corp" <${EMAIL_USER}>`,
                to: fila.email,
                subject: `DTE #${fila.id_transaccion} - Factura Electrónica`,
                html: htmlCuerpo,
                attachments: [
                    { filename: `Factura_${fila.id_transaccion}.pdf`, content: pdfAdjunto },
                    { filename: `DTE_${fila.id_transaccion}.json`, content: jsonDTE }
                ]
            });

            await conn.execute("UPDATE facturas SET enviado = 1 WHERE id = ?", [fila.id]);
            console.log(`✅ Enviado satisfactoriamente (HTML+PDF+JSON) a: ${fila.email}`);
            
            // Pausa dinámica
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log("\n🎉 ¡Proceso completado!");

    } catch (error) {
        console.error("❌ Error Crítico:", error.message);
    } finally {
        if (conn) await conn.end();
    }
}

ejecutarEnvio();