import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { UsageLog, Space } from "./types";

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const SHORT_MONTH_NAMES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export function getMonthKey(dateStr?: string): string {
  if (!dateStr) return "N/D";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return dateStr.slice(0, 7);
}

export function formatMonthLabel(monthKey: string): string {
  const parts = monthKey.split("-");
  if (parts.length === 2) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${MONTH_NAMES_PT[monthIndex]} ${year}`;
    }
  }
  return monthKey;
}

export function formatShortMonthLabel(monthKey: string): string {
  const parts = monthKey.split("-");
  if (parts.length === 2) {
    const year = parts[0].slice(2);
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${SHORT_MONTH_NAMES_PT[monthIndex]}/${year}`;
    }
  }
  return monthKey;
}

export interface MonthlyConsolidation {
  months: string[];
  totalLogs: number;
  distinctStudents: number;
  distinctClasses: number;
  // By space
  spacesData: {
    area: string;
    monthlyCounts: Record<string, number>;
    total: number;
    percentage: number;
  }[];
  // By class
  classesData: {
    className: string;
    gradeNumber: number;
    monthlyCounts: Record<string, number>;
    total: number;
    percentage: number;
  }[];
  // By grade
  gradesData: {
    gradeLabel: string;
    gradeNumber: number;
    monthlyCounts: Record<string, number>;
    total: number;
    percentage: number;
  }[];
  // Top activities
  activitiesData: {
    area: string;
    activity: string;
    total: number;
    percentage: number;
  }[];
  topSpace: { area: string; count: number; percentage: number } | null;
  topClass: { className: string; count: number; percentage: number } | null;
  topMonth: { monthKey: string; count: number } | null;
}

export function buildMonthlyConsolidation(
  logs: UsageLog[],
  allSpaces: Space[] = []
): MonthlyConsolidation {
  const totalLogs = logs.length;
  
  // Extract and sort unique months
  const monthSet = new Set<string>();
  logs.forEach(l => {
    if (l.date) monthSet.add(getMonthKey(l.date));
  });
  
  const months = Array.from(monthSet).sort();
  if (months.length === 0) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    months.push(currentMonth);
  }

  // Distinct students and classes
  const studentSet = new Set<number>();
  const classSet = new Set<string>();

  logs.forEach(l => {
    if (l.process_number) studentSet.add(l.process_number);
    const cls = l.grade ? `${l.grade}º ${l.class || ""}`.trim() : (l.class || "").trim();
    if (cls) classSet.add(cls);
  });

  // 1. Group by Space (Area)
  const areasFromSpaces = allSpaces.map(s => s.area.trim());
  const areasFromLogs = logs.map(l => (l.area || "Outro").trim());
  const uniqueAreas = Array.from(new Set([...areasFromSpaces, ...areasFromLogs])).filter(Boolean);

  const spacesMap = new Map<string, Record<string, number>>();
  uniqueAreas.forEach(area => {
    spacesMap.set(area, {});
    months.forEach(m => {
      spacesMap.get(area)![m] = 0;
    });
  });

  logs.forEach(log => {
    const area = (log.area || "Outro").trim();
    const m = getMonthKey(log.date);
    if (!spacesMap.has(area)) {
      spacesMap.set(area, {});
      months.forEach(mo => {
        spacesMap.get(area)![mo] = 0;
      });
    }
    const counts = spacesMap.get(area)!;
    counts[m] = (counts[m] || 0) + 1;
  });

  const spacesData = Array.from(spacesMap.entries()).map(([area, monthlyCounts]) => {
    const total = Object.values(monthlyCounts).reduce((acc, c) => acc + c, 0);
    const percentage = totalLogs > 0 ? (total / totalLogs) * 100 : 0;
    return {
      area,
      monthlyCounts,
      total,
      percentage: Math.round(percentage * 10) / 10
    };
  }).sort((a, b) => b.total - a.total);

  // 2. Group by Class (Turma)
  const classesMap = new Map<string, { gradeNum: number; counts: Record<string, number> }>();
  
  logs.forEach(log => {
    const gradeNum = log.grade ? Number(log.grade) : 99;
    const label = log.grade 
      ? `${log.grade}º ${log.class || ""}`.trim() 
      : (log.class ? `Turma ${log.class}` : "Sem turma atribuída");
    
    const m = getMonthKey(log.date);
    if (!classesMap.has(label)) {
      const initialCounts: Record<string, number> = {};
      months.forEach(mo => { initialCounts[mo] = 0; });
      classesMap.set(label, { gradeNum, counts: initialCounts });
    }
    const item = classesMap.get(label)!;
    item.counts[m] = (item.counts[m] || 0) + 1;
  });

  const classesData = Array.from(classesMap.entries()).map(([className, { gradeNum, counts }]) => {
    const total = Object.values(counts).reduce((acc, c) => acc + c, 0);
    const percentage = totalLogs > 0 ? (total / totalLogs) * 100 : 0;
    return {
      className,
      gradeNumber: gradeNum,
      monthlyCounts: counts,
      total,
      percentage: Math.round(percentage * 10) / 10
    };
  }).sort((a, b) => {
    if (a.gradeNumber !== b.gradeNumber) return a.gradeNumber - b.gradeNumber;
    return a.className.localeCompare(b.className);
  });

  // 3. Group by Grade (Ano de Escolaridade)
  const gradesMap = new Map<string, { gradeNum: number; counts: Record<string, number> }>();
  logs.forEach(log => {
    const gradeNum = log.grade ? Number(log.grade) : 99;
    const label = log.grade ? `${log.grade}º Ano` : "Outro / Não especificado";
    const m = getMonthKey(log.date);
    if (!gradesMap.has(label)) {
      const initialCounts: Record<string, number> = {};
      months.forEach(mo => { initialCounts[mo] = 0; });
      gradesMap.set(label, { gradeNum, counts: initialCounts });
    }
    const item = gradesMap.get(label)!;
    item.counts[m] = (item.counts[m] || 0) + 1;
  });

  const gradesData = Array.from(gradesMap.entries()).map(([gradeLabel, { gradeNum, counts }]) => {
    const total = Object.values(counts).reduce((acc, c) => acc + c, 0);
    const percentage = totalLogs > 0 ? (total / totalLogs) * 100 : 0;
    return {
      gradeLabel,
      gradeNumber: gradeNum,
      monthlyCounts: counts,
      total,
      percentage: Math.round(percentage * 10) / 10
    };
  }).sort((a, b) => a.gradeNumber - b.gradeNumber);

  // 4. Top Activities
  const activityMap = new Map<string, { area: string; activity: string; count: number }>();
  logs.forEach(l => {
    const key = `${l.area || "Outro"}|||${l.activity || "Geral"}`;
    if (!activityMap.has(key)) {
      activityMap.set(key, { area: l.area || "Outro", activity: l.activity || "Geral", count: 0 });
    }
    activityMap.get(key)!.count += 1;
  });

  const activitiesData = Array.from(activityMap.values()).map(item => ({
    area: item.area,
    activity: item.activity,
    total: item.count,
    percentage: totalLogs > 0 ? Math.round((item.count / totalLogs) * 1000) / 10 : 0
  })).sort((a, b) => b.total - a.total).slice(0, 10);

  // Highlights
  const topSpace = spacesData.length > 0 ? {
    area: spacesData[0].area,
    count: spacesData[0].total,
    percentage: spacesData[0].percentage
  } : null;

  const topClass = classesData.length > 0 ? {
    className: classesData[0].className,
    count: classesData[0].total,
    percentage: classesData[0].percentage
  } : null;

  // Month with highest attendance
  let topMonth: { monthKey: string; count: number } | null = null;
  months.forEach(m => {
    const count = logs.filter(l => getMonthKey(l.date) === m).length;
    if (!topMonth || count > topMonth.count) {
      topMonth = { monthKey: m, count };
    }
  });

  return {
    months,
    totalLogs,
    distinctStudents: studentSet.size,
    distinctClasses: classSet.size,
    spacesData,
    classesData,
    gradesData,
    activitiesData,
    topSpace,
    topClass,
    topMonth
  };
}

export function generateFormalMonthlyPDF(
  logs: UsageLog[],
  spaces: Space[],
  startDate: string,
  endDate: string,
  schoolName: string = "Agrupamento de Escolas Vale de São Torcato",
  libraryName: string = "Biblioteca Escolar AEVST"
) {
  const consolidation = buildMonthlyConsolidation(logs, spaces);
  const { months, spacesData, classesData, gradesData, activitiesData, totalLogs, distinctStudents, distinctClasses } = consolidation;

  // Select orientation based on number of month columns
  const isLandscape = months.length > 5;
  const orientation = isLandscape ? "landscape" : "portrait";
  
  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800 / navy
  const accentIndigo: [number, number, number] = [67, 56, 202]; // indigo-700
  const emeraldColor: [number, number, number] = [16, 185, 129];
  const mutedTextColor: [number, number, number] = [100, 116, 139];

  // Helper for formatting dates nicely
  const formatDateBR = (dStr: string) => {
    if (!dStr) return "-";
    const parts = dStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  };

  const todayStr = new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const nowTimeStr = new Date().toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit"
  });

  // Top header banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 24, "F");

  // School & Library Branding
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(schoolName.toUpperCase(), margin, 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${libraryName} | Rede de Bibliotecas Escolares`, margin, 15);

  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`Documento Institucional Oficial | Emitido a: ${todayStr} às ${nowTimeStr}`, pageWidth - margin, 15, { align: "right" });

  let y = 32;

  // Title Box
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("RELATÓRIO CONSOLIDADO DE UTILIZAÇÃO E OCUPAÇÃO", margin, y);
  y += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedTextColor);
  doc.text(
    `Totais Mensais de Ocupação por Espaço e Turma | Período de Análise: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    margin,
    y
  );
  y += 8;

  // Summary Metrics Bar
  const summaryBoxHeight = 18;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), summaryBoxHeight, 3, 3, "FD");

  const colWidth = (pageWidth - (margin * 2)) / 4;

  const metrics = [
    { label: "TOTAL DE UTILIZAÇÕES", val: String(totalLogs) },
    { label: "ALUNOS DISTINTOS", val: String(distinctStudents) },
    { label: "TURMAS ENVOLVIDAS", val: String(distinctClasses) },
    { label: "MESES ABRANGIDOS", val: `${months.length} (${formatShortMonthLabel(months[0])} a ${formatShortMonthLabel(months[months.length - 1])})` }
  ];

  metrics.forEach((m, idx) => {
    const xPos = margin + (idx * colWidth) + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...mutedTextColor);
    doc.text(m.label, xPos, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text(m.val, xPos, y + 13.5);
  });

  y += summaryBoxHeight + 8;

  // --- SECTION 1: CONSOLIDAÇÃO MENSAL POR ESPAÇO ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text("1. Consolidação Mensal de Ocupação por Espaço da Biblioteca", margin, y);
  y += 2;

  // Build table columns: Espaço, [Month 1], [Month 2], ..., Total Período, % Ocupação
  const spaceHeaders = [
    "Espaço / Área da Biblioteca",
    ...months.map(m => formatShortMonthLabel(m)),
    "Total",
    "% Relativa"
  ];

  const spaceRows: (string | number)[][] = spacesData.map(s => {
    return [
      s.area,
      ...months.map(m => s.monthlyCounts[m] || 0),
      s.total,
      `${s.percentage.toFixed(1)}%`
    ];
  });

  // Calculate totals row
  const spaceMonthTotals = months.map(m => {
    return spacesData.reduce((acc, s) => acc + (s.monthlyCounts[m] || 0), 0);
  });
  const spaceGrandTotal = spacesData.reduce((acc, s) => acc + s.total, 0);

  spaceRows.push([
    "TOTAL GERAL DE OCUPAÇÃO",
    ...spaceMonthTotals,
    spaceGrandTotal,
    "100.0%"
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [spaceHeaders],
    body: spaceRows,
    theme: "grid",
    headStyles: {
      fillColor: accentIndigo,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      [spaceHeaders.length - 2]: { halign: "center", fontStyle: "bold", textColor: [67, 56, 202] },
      [spaceHeaders.length - 1]: { halign: "center", fontStyle: "bold" }
    },
    didParseCell: (data) => {
      // Right align numeric month cells
      if (data.section === "body" && data.column.index > 0 && data.column.index < spaceHeaders.length - 2) {
        data.cell.styles.halign = "center";
      }
      // Highlight last row (Totals)
      if (data.section === "body" && data.row.index === spaceRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    margin: { left: margin, right: margin }
  });

  // Update y after table
  y = (doc as any).lastAutoTable.finalY + 8;

  // --- SECTION 2: TOP ATIVIDADES DENTRO DOS ESPAÇOS ---
  if (activitiesData.length > 0 && y < pageHeight - 50) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryColor);
    doc.text("1.1. Principais Atividades Requisitadas nos Espaços", margin, y);
    y += 2;

    const actHeaders = ["Área", "Atividade", "Total de Requisições", "% do Total"];
    const actRows = activitiesData.map(a => [
      a.area,
      a.activity,
      a.total,
      `${a.percentage.toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: y + 2,
      head: [actHeaders],
      body: actRows,
      theme: "striped",
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold" },
        1: { halign: "left" },
        2: { halign: "center", fontStyle: "bold" },
        3: { halign: "center" }
      },
      margin: { left: margin, right: margin }
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- SECTION 3: CONSOLIDAÇÃO MENSAL POR TURMA ---
  // Start on new page if remaining vertical space is tight (< 70mm)
  if (y > pageHeight - 75) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text("2. Consolidação Mensal de Ocupação por Turma", margin, y);
  y += 2;

  const classHeaders = [
    "Turma / Grupo",
    ...months.map(m => formatShortMonthLabel(m)),
    "Total Período",
    "% Relativa"
  ];

  const classRows: (string | number)[][] = classesData.map(c => {
    return [
      c.className,
      ...months.map(m => c.monthlyCounts[m] || 0),
      c.total,
      `${c.percentage.toFixed(1)}%`
    ];
  });

  const classMonthTotals = months.map(m => {
    return classesData.reduce((acc, c) => acc + (c.monthlyCounts[m] || 0), 0);
  });
  const classGrandTotal = classesData.reduce((acc, c) => acc + c.total, 0);

  classRows.push([
    "TOTAL GERAL POR TURMAS",
    ...classMonthTotals,
    classGrandTotal,
    "100.0%"
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [classHeaders],
    body: classRows,
    theme: "grid",
    headStyles: {
      fillColor: accentIndigo,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      [classHeaders.length - 2]: { halign: "center", fontStyle: "bold", textColor: [67, 56, 202] },
      [classHeaders.length - 1]: { halign: "center", fontStyle: "bold" }
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0 && data.column.index < classHeaders.length - 2) {
        data.cell.styles.halign = "center";
      }
      if (data.section === "body" && data.row.index === classRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    margin: { left: margin, right: margin }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // --- SECTION 4: RESUMO POR ANO DE ESCOLARIDADE ---
  if (gradesData.length > 0 && y < pageHeight - 55) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryColor);
    doc.text("2.1. Distribuição Global por Ano de Escolaridade", margin, y);
    y += 2;

    const gradeHeaders = ["Ano de Escolaridade", ...months.map(m => formatShortMonthLabel(m)), "Total", "% Global"];
    const gradeRows = gradesData.map(g => [
      g.gradeLabel,
      ...months.map(m => g.monthlyCounts[m] || 0),
      g.total,
      `${g.percentage.toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: y + 2,
      head: [gradeHeaders],
      body: gradeRows,
      theme: "striped",
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold" },
        [gradeHeaders.length - 2]: { halign: "center", fontStyle: "bold" },
        [gradeHeaders.length - 1]: { halign: "center" }
      },
      margin: { left: margin, right: margin }
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- SECTION 5: CONCLUSÕES E ASSINATURAS FORMAIS ---
  // Ensure we have enough room for conclusions and signature block (approx 55mm)
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...primaryColor);
  doc.text("3. Síntese Executiva e Observações para a Direção", margin, y);
  y += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedTextColor);

  const topSpaceText = consolidation.topSpace 
    ? `• Espaço Mais Frequente: "${consolidation.topSpace.area}" registou a maior afluência no período, com ${consolidation.topSpace.count} utilizações (${consolidation.topSpace.percentage.toFixed(1)}% do total).`
    : "• Dados de ocupação de espaços devidamente consolidados.";

  const topClassText = consolidation.topClass
    ? `• Turma com Maior Participação: ${consolidation.topClass.className} destaca-se com ${consolidation.topClass.count} presenças registadas.`
    : "• Diversas turmas participaram nas dinâmicas da biblioteca.";

  const topMonthText = consolidation.topMonth
    ? `• Mês de Pico: ${formatMonthLabel(consolidation.topMonth.monthKey)} registou o maior volume de registos (${consolidation.topMonth.count} utilizações).`
    : "";

  doc.text(topSpaceText, margin + 2, y);
  y += 4.5;
  doc.text(topClassText, margin + 2, y);
  y += 4.5;
  if (topMonthText) {
    doc.text(topMonthText, margin + 2, y);
    y += 4.5;
  }
  doc.text("• Os registos foram aferidos de acordo com o sistema de monitorização e controlo da Biblioteca Escolar.", margin + 2, y);
  y += 12;

  // Signature Blocks
  const sigBlockY = Math.max(y, pageHeight - 35);
  const sigColWidth = (pageWidth - (margin * 2)) / 2;

  // Signature 1
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, sigBlockY, margin + sigColWidth - 15, sigBlockY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text("O/A Professor(a) Bibliotecário(a)", margin + (sigColWidth / 2) - 2.5, sigBlockY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...mutedTextColor);
  doc.text("Coordenação da Biblioteca Escolar", margin + (sigColWidth / 2) - 2.5, sigBlockY + 8, { align: "center" });

  // Signature 2
  const sig2X = margin + sigColWidth + 10;
  doc.line(sig2X, sigBlockY, margin + (sigColWidth * 2) - 10, sigBlockY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text("A Direção do Agrupamento", sig2X + (sigColWidth / 2) - 10, sigBlockY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...mutedTextColor);
  doc.text("Visto / Homologação", sig2X + (sigColWidth / 2) - 10, sigBlockY + 8, { align: "center" });

  // Running Header & Footer with Page Numbers on ALL pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Top border line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    // Footer text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedTextColor);
    doc.text(
      `${schoolName} — ${libraryName} | Relatório Mensal Consolidado`,
      margin,
      pageHeight - 7.5
    );

    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 7.5,
      { align: "right" }
    );
  }

  // Save the PDF
  const filename = `relatorio_mensal_ocupacao_${startDate}_a_${endDate}.pdf`;
  doc.save(filename);
}
