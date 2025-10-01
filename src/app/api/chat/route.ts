import { NextResponse } from "next/server";
import OpenAI from "openai";
import sql from "mssql";

type Factura = {
  UUID: number;
  RFC_Emisor: string;
  RFC_Receptor: string;
  Fecha: string;
  Subtotal: number;
  TotalTrasladadoIVADieciseis: number;
  TotalTrasladadoIVAOcho: number;
  Total: number;
  Movimiento: string; // 👈 Ingreso o Egreso
  Moneda: string;
  UsoCFDI: string;
  tipoCambio: string;
  MetodoPago: string;
  TipoPago: string;
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 👈 ahora se toma de Vercel
});

const sqlConfig = {
  user: "mmendoza-server-admin",
  password: "P@to0102",
  server: "mmendoza-server.database.windows.net",
  database: "mmendoza-database",
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 6000000,
    requestTimeout: 6000000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

export async function POST(req: Request) {
  let pool: sql.ConnectionPool | undefined;
  
  try {
    const { message, rfc, fechaInicio, fechaFin } = await req.json();

  let inicio: Date;
  let fin: Date;
  let fechasManual = true;
  
  if (!fechaInicio || !fechaFin) {
    const year = new Date().getFullYear();
    inicio = new Date(`${year}-01-01`);
    fin = new Date(`${year}-12-31`);
    fechasManual = false; // 👈 no fue manual, usar todo el año
  } else {
    inicio = new Date(fechaInicio);
    fin = new Date(fechaFin);
  }
  
  // ✅ Solo validar si las fechas fueron enviadas manualmente
  if (fechasManual) {
    const diffMeses =
      (fin.getFullYear() - inicio.getFullYear()) * 12 +
      (fin.getMonth() - inicio.getMonth());
  
    if (diffMeses > 1 || (diffMeses === 1 && fin.getDate() > inicio.getDate())) {
      return NextResponse.json(
        { reply: "⚠️ El rango de fechas no puede ser mayor a un mes." },
        { status: 400 }
      );
    }
  }

    pool = await sql.connect(sqlConfig);

    // 1. Traer número de facturas
    const countResult = await pool
      .request()
      .input("rfc", sql.VarChar, rfc)
      .input("fechaInicio", sql.Date, inicio)
      .input("fechaFin", sql.Date, fin)
      .query<{ TotalFacturas: number }>(`
        SELECT COUNT(*) AS TotalFacturas
        FROM facturalo_cfdis
        WHERE Fecha BETWEEN @fechaInicio AND @fechaFin
          AND (RFC_Emisor = @rfc OR RFC_Receptor = @rfc)
      `);

    const totalFacturas = countResult.recordset[0]?.TotalFacturas || 0;
    let contexto = "";

    if (totalFacturas > 1000) {
      // 2. Si son muchas → resumen mensual (separando ingresos y egresos)
      const resumenResult = await pool
        .request()
        .input("rfc", sql.VarChar, rfc)
        .input("fechaInicio", sql.Date, inicio)
        .input("fechaFin", sql.Date, fin)
        .query(`
          SELECT 
            FORMAT(Fecha, 'yyyy-MM') AS Mes,
            Movimiento,
            COUNT(*) AS NumeroFacturas,
            SUM(Subtotal) AS Subtotal,
            SUM(TotalTrasladadoIVADieciseis) AS IVA16,
            SUM(TotalTrasladadoIVAOcho) AS IVA8,
            SUM(Total) AS Total
          FROM facturalo_cfdis
          WHERE Fecha BETWEEN @fechaInicio AND @fechaFin
            AND (RFC_Emisor = @rfc OR RFC_Receptor = @rfc)
          GROUP BY FORMAT(Fecha, 'yyyy-MM'), Movimiento
          ORDER BY Mes DESC, Movimiento;
        `);

      contexto = resumenResult.recordset
        .map(
          (r) =>
            `${r.Mes} (${r.Movimiento}) → ${r.NumeroFacturas} facturas | Subtotal: ${r.Subtotal?.toFixed(
              2
            )} | IVA16: ${r.IVA16?.toFixed(2) || 0} | IVA8: ${
              r.IVA8?.toFixed(2) || 0
            } | Total: ${r.Total?.toFixed(2)}`
        )
        .join("\n");
    } else {
        // 3. Si son pocas → detalle normal (incluyendo movimiento)
       const facturasResult = await pool
        .request()
        .input("rfc", sql.VarChar, rfc)
        .input("fechaInicio", sql.Date, inicio)
        .input("fechaFin", sql.Date, fin)
        .query<Factura>(`
          SELECT 
            UUID, 
            RFC_Emisor, 
            RFC_Receptor, 
            Fecha, 
            Subtotal, 
            TotalTrasladadoIVADieciseis, 
            TotalTrasladadoIVAOcho, 
            Total,
            Movimiento,
            UsoCFDI,
            Moneda,
            tipoCambio,
            MetodoPago,
            TipoPago
          FROM facturalo_cfdis
          WHERE Fecha BETWEEN @fechaInicio AND @fechaFin
            AND (RFC_Emisor = @rfc OR RFC_Receptor = @rfc)
          ORDER BY Fecha DESC
        `);
      
      const facturasTexto = facturasResult.recordset
        .map(
          (f) =>
            `Factura ${f.UUID} (${f.Movimiento}) 
             - Emisor: ${f.RFC_Emisor}, Receptor: ${f.RFC_Receptor} 
             - Fecha: ${f.Fecha} 
             - Subtotal: ${f.Subtotal}, IVA8: ${f.TotalTrasladadoIVAOcho}, IVA16: ${f.TotalTrasladadoIVADieciseis}, Total: ${f.Total} 
             - UsoCFDI: ${f.UsoCFDI}, Moneda: ${f.Moneda}, TipoCambio: ${f.tipoCambio} 
             - Método de pago: ${f.MetodoPago}, Tipo de pago: ${f.TipoPago}`
        )
        .join("\n\n");
      
      // --- 2. Nueva consulta para conceptos ---
      const conceptosResult = await pool
        .request()
        .input("rfc", sql.VarChar, rfc)
        .input("fechaInicio", sql.Date, inicio)
        .input("fechaFin", sql.Date, fin)
        .query(`
          SELECT TOP 100
            c.UUID,
            c.ClaveProductoServicio,
            c.Descripcion,
            c.Cantidad,
            c.ValorUnitario,
            c.Importe
          FROM facturalo_conceptos c
          INNER JOIN facturalo_cfdis f ON c.UUID = f.UUID
          WHERE f.Fecha BETWEEN @fechaInicio AND @fechaFin
            AND f.rfc_cliente = @rfc
          ORDER BY f.Fecha DESC
        `);
  
      const conceptosTexto = conceptosResult.recordset
        .map(
          (c) =>
            `Concepto (UUID: ${c.UUID})
             - Producto: ${c.ClaveProductoServicio} | ${c.Descripcion}
             - Cantidad: ${c.Cantidad}
             - Precio Unitario: ${c.ValorUnitario}
             - Importe: ${c.Importe}`
        )
        .join("\n\n");
      
      // --- 3. Unimos todo en el contexto ---
      contexto = `
      === FACTURAS ===
      ${facturasTexto}
      
      === PRODUCTOS / CONCEPTOS ===
      ${conceptosTexto}
      `;
    }

    const prompt = `
    Eres un asesor financiero experto. Analiza los datos de ingresos, egresos, montos, frecuencia y movimientos para detectar patrones, oportunidades de ahorro, riesgos y áreas de mejora.
    
    Cuando el usuario haga preguntas amplias (como "¿cómo puedo mejorar mi negocio?"), utiliza los datos proporcionados para:
    - Identificar tendencias
    - Comparar ingresos vs egresos
    - Sugerir medidas concretas
    - Detectar meses malos o buenos
    - Recomendar acciones estratégicas (reducción de gastos, mejora de clientes, etc.)
    
    Datos disponibles:
    ${contexto || "⚠️ No hay facturas para este RFC en el periodo seleccionado."}
    
    Pregunta del usuario:
    ${message}
    `;


    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Eres un experto en contabilidad electrónica." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    });

    let respuesta = completion.choices[0]?.message?.content;
    if (!respuesta || respuesta.trim() === "") {
      respuesta = "⚠️ El modelo no devolvió respuesta.";
    }

    return NextResponse.json({ reply: respuesta });
  } catch (error) {
    console.error("Error en API:", error);
    return NextResponse.json(
      { reply: "⚠️ Error al procesar tu consulta." },
      { status: 500 }
    );
  } finally {
    if (pool) await pool.close();
  }
}
