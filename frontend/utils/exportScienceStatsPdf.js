// utils/exportScienceStatsPdf.js
// Generates a PDF report for the Science Coordinator statistics.
//
// • Web  → opens the report in a new tab and triggers window.print()
// • iOS / Android → uses expo-print + expo-sharing

import { Platform } from "react-native";

// ─── Colour palette ────────────────────────────────────────────────────────
const BLUE = "#10345b";
const ORANGE = "#fa8d10";
const GREEN = "#4CAF50";
const PURPLE = "#9C27B0";
const PINK = "#E91E63";
const LIGHT = "#f5f5f5";
const BORDER = "#e0e0e0";
const PALETTE = [GREEN, BLUE, ORANGE, PURPLE, PINK, "#00BCD4", "#FF5722"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const barRow = (label, value, maxValue, color) => {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    "<tr>" +
    "<td class='bar-label'>" + label + "</td>" +
    "<td class='bar-cell'><div class='bar-wrap'><div class='bar-fill' style='width:" + pct + "%;background:" + color + ";'></div></div></td>" +
    "<td class='bar-value'>" + value + "</td>" +
    "</tr>"
  );
};

const buildPieChart = (slices) => {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return "<p style='color:#999;font-size:12px;'>Nema podataka</p>";

  const cx = 80, cy = 80, r = 70;
  let paths = "";
  let startAngle = -Math.PI / 2;

  slices.forEach((sl) => {
    const angle = (sl.value / total) * 2 * Math.PI;
    if (angle >= 2 * Math.PI - 0.001) {
      paths += "<circle cx='" + cx + "' cy='" + cy + "' r='" + r + "' fill='" + sl.color + "' stroke='#fff' stroke-width='2'/>";
      paths += "<text x='" + cx + "' y='" + cy + "' text-anchor='middle' dominant-baseline='middle' font-size='11' font-weight='700' fill='#fff'>100%</text>";
      return;
    }
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    paths += "<path d='M" + cx + "," + cy + " L" + x1.toFixed(2) + "," + y1.toFixed(2) + " A" + r + "," + r + " 0 " + largeArc + ",1 " + x2.toFixed(2) + "," + y2.toFixed(2) + " Z' fill='" + sl.color + "' stroke='#fff' stroke-width='2'/>";
    const midAngle = startAngle + angle / 2;
    const lx = cx + (r * 0.62) * Math.cos(midAngle);
    const ly = cy + (r * 0.62) * Math.sin(midAngle);
    const pct = Math.round((sl.value / total) * 100);
    if (pct >= 5) {
      paths += "<text x='" + lx.toFixed(2) + "' y='" + ly.toFixed(2) + "' text-anchor='middle' dominant-baseline='middle' font-size='11' font-weight='700' fill='#fff'>" + pct + "%</text>";
    }
    startAngle = endAngle;
  });

  const legendRows = slices.map((sl) =>
    "<tr>" +
    "<td style='width:14px;padding:3px 8px 3px 0;font-size:16px;color:" + sl.color + ";'>&#9632;</td>" +
    "<td style='font-size:12px;padding:3px 12px 3px 0;color:#1a1a2e;'>" + sl.label + "</td>" +
    "<td style='font-size:12px;font-weight:700;padding:3px 0;color:#1a1a2e;'>" + sl.value + "</td>" +
    "<td style='font-size:11px;padding:3px 0 3px 6px;color:#888;'>(" + Math.round((sl.value / total) * 100) + "%)</td>" +
    "</tr>"
  ).join("");

  return (
    "<div style='display:flex;align-items:center;gap:28px;flex-wrap:wrap;'>" +
    "<svg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'>" + paths + "</svg>" +
    "<table style='border-collapse:collapse;'><tbody>" + legendRows + "</tbody></table>" +
    "</div>"
  );
};

// ─── Section builders ─────────────────────────────────────────────────────────

const buildKpiSection = (kpi, sol) => {
  const withSol = Number(sol.with_solution) || 0;
  const total = withSol + (Number(sol.without_solution) || 0);
  return (
    "<section>" +
    "<h2 class='section-title'>Ključni pokazatelji</h2>" +
    "<div class='kpi-grid'>" +
    "<div class='kpi-card' style='border-top:4px solid " + GREEN + ";'><div class='kpi-icon'>🔬</div><div class='kpi-value'>" + (kpi.scienceCompetitions ?? "–") + "</div><div class='kpi-label'>Naučna takmičenja</div></div>" +
    "<div class='kpi-card' style='border-top:4px solid " + BLUE + ";'><div class='kpi-icon'>🛡️</div><div class='kpi-value'>" + (kpi.teams ?? "–") + "</div><div class='kpi-label'>Timovi</div></div>" +
    "<div class='kpi-card' style='border-top:4px solid " + ORANGE + ";'><div class='kpi-icon'>👤</div><div class='kpi-value'>" + (kpi.participants ?? "–") + "</div><div class='kpi-label'>Učesnici</div></div>" +
    "<div class='kpi-card' style='border-top:4px solid " + PURPLE + ";'><div class='kpi-icon'>📄</div><div class='kpi-value'>" + withSol + "/" + total + "</div><div class='kpi-label'>Sa rješenjem</div></div>" +
    "</div></section>"
  );
};

const buildScoresSection = (avgScoreByCompetition) => {
  if (!avgScoreByCompetition?.length) return "";
  const maxVal = Math.max(...avgScoreByCompetition.map((r) => Number(r.avg_score)));
  const rows = avgScoreByCompetition.map((r) => barRow(r.competition_name, Number(r.avg_score), maxVal, GREEN)).join("");
  return "<section><h2 class='section-title'>Prosjek bodova po takmičenju</h2><table class='bar-table'><tbody>" + rows + "</tbody></table></section>";
};

const buildParticipantsSection = (participantsByFaculty) => {
  if (!participantsByFaculty?.length) return "";
  const maxVal = Math.max(...participantsByFaculty.map((r) => Number(r.participant_count)));
  const rows = participantsByFaculty.map((r) => barRow(r.faculty_name, Number(r.participant_count), maxVal, BLUE)).join("");
  return "<section><h2 class='section-title'>Učesnici po fakultetima</h2><table class='bar-table'><tbody>" + rows + "</tbody></table></section>";
};

const buildSolutionSection = (sol) => {
  const withSol = Number(sol.with_solution) || 0;
  const withoutSol = Number(sol.without_solution) || 0;
  const slices = [
    { label: "Sa rješenjem", value: withSol, color: GREEN },
    { label: "Bez rješenja", value: withoutSol, color: PINK },
  ];
  return "<section><h2 class='section-title'>Status rješenja</h2>" + buildPieChart(slices) + "</section>";
};

const buildMentorsSection = (mentorOverview) => {
  if (!mentorOverview?.length) return "";
  const rows = mentorOverview.map((r, i) =>
    "<tr class='" + (i % 2 === 0 ? "row-even" : "row-odd") + "'>" +
    "<td class='rank-pos'>" + (i + 1) + "</td>" +
    "<td class='rank-name'>" + r.mentor_name + "</td>" +
    "<td class='rank-score'>" + r.comp_count + " <span class='unit'>tak.</span></td>" +
    "</tr>"
  ).join("");
  return (
    "<section><h2 class='section-title'>Mentori – broj takmičenja</h2>" +
    "<table class='data-table'><thead><tr><th>#</th><th>Mentor</th><th>Takmičenja</th></tr></thead>" +
    "<tbody>" + rows + "</tbody></table></section>"
  );
};

// ─── Full HTML template ───────────────────────────────────────────────────────

const buildHtml = (stats, year) => {
  const {
    kpiCards = {},
    avgScoreByCompetition = [],
    participantsByFaculty = [],
    mentorOverview = [],
    solutionStatus = { with_solution: 0, without_solution: 0 },
  } = stats;

  const now = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const css = (
    "* { box-sizing: border-box; margin: 0; padding: 0; }" +
    "body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 32px 40px; }" +
    ".report-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid " + GREEN + "; padding-bottom: 14px; margin-bottom: 28px; }" +
    ".report-title { font-size: 20px; font-weight: 800; color: " + GREEN + "; }" +
    ".report-subtitle { font-size: 12px; color: #666; margin-top: 4px; }" +
    ".report-year { font-size: 36px; font-weight: 900; color: " + BLUE + "; line-height: 1; }" +
    "section { margin-bottom: 32px; page-break-inside: avoid; }" +
    ".section-title { font-size: 14px; font-weight: 700; color: " + GREEN + "; border-left: 4px solid " + BLUE + "; padding-left: 10px; margin-bottom: 14px; }" +
    ".kpi-grid { display: flex; flex-wrap: wrap; gap: 12px; }" +
    ".kpi-card { flex: 1 1 140px; background: " + LIGHT + "; border-radius: 10px; padding: 14px 16px; text-align: center; border: 1px solid " + BORDER + "; }" +
    ".kpi-icon { font-size: 20px; margin-bottom: 6px; }" +
    ".kpi-value { font-size: 28px; font-weight: 900; color: #1a1a2e; }" +
    ".kpi-label { font-size: 11px; color: #666; margin-top: 4px; }" +
    ".bar-table { width: 100%; border-collapse: collapse; }" +
    ".bar-label { width: 35%; padding: 5px 10px 5px 0; font-size: 12px; vertical-align: middle; word-break: break-word; }" +
    ".bar-cell { width: 55%; padding: 5px 8px; vertical-align: middle; }" +
    ".bar-value { width: 10%; padding: 5px 0 5px 6px; font-weight: 700; font-size: 12px; text-align: right; vertical-align: middle; white-space: nowrap; }" +
    ".bar-wrap { background: " + BORDER + "; border-radius: 4px; height: 14px; overflow: hidden; }" +
    ".bar-fill { height: 100%; border-radius: 4px; min-width: 2px; }" +
    ".data-table { width: 100%; border-collapse: collapse; }" +
    ".data-table thead tr { background: " + GREEN + "; color: #fff; }" +
    ".data-table th { padding: 8px 10px; font-size: 12px; text-align: left; }" +
    ".data-table td { padding: 7px 10px; font-size: 12px; }" +
    ".row-even { background: " + LIGHT + "; } .row-odd { background: #fff; }" +
    ".rank-pos { font-weight: 800; color: " + GREEN + "; width: 32px; }" +
    ".rank-name { color: #1a1a2e; }" +
    ".rank-score { font-weight: 700; color: " + BLUE + "; text-align: right; white-space: nowrap; }" +
    ".unit { font-size: 10px; color: #999; font-weight: 400; }" +
    ".two-col { display: flex; gap: 20px; flex-wrap: wrap; }" +
    ".two-col > * { flex: 1 1 300px; }" +
    ".report-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid " + BORDER + "; font-size: 10px; color: #aaa; text-align: center; }"
  );

  return (
    "<!DOCTYPE html><html lang='bs'><head>" +
    "<meta charset='UTF-8'/>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1.0'/>" +
    "<title>Izvještaj o naučnim takmičenjima – " + year + "</title>" +
    "<style>" + css + "</style>" +
    "</head><body>" +
    "<div class='report-header'>" +
    "<div><div class='report-title'>Godišnji izvještaj o naučnim takmičenjima</div>" +
    "<div class='report-subtitle'>Generisano: " + now + "</div></div>" +
    "<div class='report-year'>" + year + "</div>" +
    "</div>" +
    buildKpiSection(kpiCards, solutionStatus) +
    "<div class='two-col'>" +
    buildScoresSection(avgScoreByCompetition) +
    buildParticipantsSection(participantsByFaculty) +
    "</div>" +
    buildSolutionSection(solutionStatus) +
    buildMentorsSection(mentorOverview) +
    "<div class='report-footer'>Izvještaj za godinu " + year + " · Automatski generisan</div>" +
    "</body></html>"
  );
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const exportScienceStatsPdf = async (stats, year) => {
  const html = buildHtml(stats, year);

  if (Platform.OS === "web") {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nauka-izvjestaj-" + year + ".html";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  } else {
    try {
      const Print = require("expo-print");
      const Sharing = require("expo-sharing");
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Izvještaj nauka - " + year,
        UTI: "com.adobe.pdf",
      });
    } catch (err) {
      console.error("PDF export failed:", err);
      throw err;
    }
  }
};
