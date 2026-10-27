"""Reports and Export router (CSV / PDF)."""

import csv
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from auth import require_viewer_or_admin
from database import fetch_all, fetch_one
from schemas import ReportItem, User

router = APIRouter(prefix="/api/reports", tags=["Reportes y Exportación"])


@router.get("", response_model=list[ReportItem], summary="Historial de reportes generados")
def get_reports(_: User = Depends(require_viewer_or_admin)):
    """Retorna el historial de reportes diarios ejecutivos almacenados en gold.ai_reports."""
    sql = """
        SELECT
            id,
            report_date::text,
            title,
            executive_summary,
            total_events,
            max_magnitude,
            anomalies_detected,
            model_used,
            cost_usd,
            generated_at
        FROM gold.ai_reports
        ORDER BY report_date DESC
        LIMIT 30;
    """
    try:
        rows = fetch_all(sql)
        return [
            ReportItem(
                id=r["id"],
                report_date=str(r["report_date"]),
                title=r["title"],
                executive_summary=r["executive_summary"],
                total_events=r["total_events"],
                max_magnitude=(
                    float(r["max_magnitude"]) if r["max_magnitude"] is not None else None
                ),
                anomalies_detected=r["anomalies_detected"],
                model_used=r["model_used"],
                cost_usd=float(r["cost_usd"]) if r["cost_usd"] is not None else 0.0,
                generated_at=r["generated_at"],
            )
            for r in rows
        ]
    except Exception:
        # If table empty or awaiting Phase 7, return empty list gracefully
        return []


@router.get("/export", summary="Exportar datos en formato CSV o PDF")
def export_report(
    format: str = Query("csv", regex="^(csv|pdf)$", description="Formato de salida (csv o pdf)"),
    limit: int = Query(100, ge=1, le=1000, description="Cantidad máxima de registros a exportar"),
    min_mag: Optional[float] = Query(None, description="Filtrar por magnitud mínima"),
    _: User = Depends(require_viewer_or_admin),
):
    """Exporta los eventos de la capa Gold a formato CSV o PDF."""
    where_clauses = ["1=1"]
    params = {"limit": limit}

    if min_mag is not None:
        where_clauses.append("mag >= %(min_mag)s")
        params["min_mag"] = min_mag

    where_str = " AND ".join(where_clauses)
    sql = f"""
        SELECT id, place, time, latitude, longitude, depth_km, mag, mag_type, tsunami, status
        FROM gold.earthquakes
        WHERE {where_str}
        ORDER BY time DESC
        LIMIT %(limit)s;
    """
    rows = fetch_all(sql, params)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        # Header
        writer.writerow(
            ["ID", "Lugar", "Fecha (UTC)", "Latitud", "Longitud", "Profundidad (km)", "Magnitud", "Tipo Mag", "Tsunami", "Estado"]
        )
        for r in rows:
            writer.writerow(
                [
                    r.get("id"),
                    r.get("place"),
                    r.get("time").isoformat() if r.get("time") else "",
                    r.get("latitude"),
                    r.get("longitude"),
                    r.get("depth_km"),
                    r.get("mag"),
                    r.get("mag_type"),
                    r.get("tsunami"),
                    r.get("status"),
                ]
            )
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=sismowatch_report.csv"},
        )

    elif format == "pdf":
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
            styles = getSampleStyleSheet()

            elements = []

            # Title
            title_style = ParagraphStyle(
                'TitleStyle',
                parent=styles['Heading1'],
                fontSize=20,
                leading=24,
                textColor=colors.HexColor('#0f172a'),
            )
            subtitle_style = ParagraphStyle(
                'SubStyle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#64748b'),
            )

            elements.append(Paragraph("SismoWatch - Reporte Oficial de Actividad Sísmica", title_style))
            elements.append(Paragraph(f"Exportación de {len(rows)} eventos sísmicos recientes desde la capa Gold (Medallion).", subtitle_style))
            elements.append(Spacer(1, 16))

            # Table data
            table_data = [["ID", "Lugar", "Fecha (UTC)", "Mag", "Prof (km)", "Tsunami"]]
            for r in rows[:40]:  # limit to 40 in single PDF page view
                place = (r.get("place") or "Desconocido")[:32]
                dt = r.get("time").strftime("%Y-%m-%d %H:%M") if r.get("time") else "-"
                mag = f"{r.get('mag', 0.0):.1f}" if r.get("mag") is not None else "-"
                depth = f"{r.get('depth_km', 0.0):.1f}" if r.get("depth_km") is not None else "-"
                tsunami = "Sí" if r.get("tsunami") == 1 else "No"
                table_data.append([r.get("id", "")[:12], place, dt, mag, depth, tsunami])

            t = Table(table_data, colWidths=[70, 200, 100, 45, 65, 55])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (3, 0), (4, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
            ]))
            elements.append(t)

            doc.build(elements)
            buffer.seek(0)
            return Response(
                content=buffer.getvalue(),
                media_type="application/pdf",
                headers={"Content-Disposition": "attachment; filename=sismowatch_report.pdf"},
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(exc)}")
