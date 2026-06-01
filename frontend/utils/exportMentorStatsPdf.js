// utils/exportMentorStatsPdf.js
// Generates a PDF report for the Mentor statistics.
//
// • Web  → opens the report in a new tab and triggers window.print()
// • iOS / Android → uses expo-print + expo-sharing

import { Platform } from "react-native";

// ─── Colour palette ────────────────────────────────────────────────────────
const BLUE = "#10345b";
const ORANGE = "#FF9800";
const PURPLE = "#9C27B0";
const LIGHT = "#f5f5f5";
const BORDER = "#e0e0e0";
const GREEN = "#4CAF50";
const PINK = "#E91E63";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const labelWithYear = (name, year) => (year ? name + " (" + year + ")" : name);

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

// ─── Section builders ─────────────────────────────────────────────────────────

const buildKpiSection = (kpi) => (
  "<section>" +
  "<h2 class='section-title'>Pregled</h2>" +
  "<div class='kpi-grid'>" +
  "<div class='kpi-card' style='border-top:4px solid " + ORANGE + ";'><div class='kpi-icon'>🔬</div><div class='kpi-value'>" + (kpi.competitions ?? "–") + "</div><div class='kpi-label'>Broj takmičenja</div></div>" +
  "<div class='kpi-card' style='border-top:4px solid " + BLUE + ";'><div class='kpi-icon'>👥</div><div class='kpi-value'>" + (kpi.participants ?? "–") + "</div><div class='kpi-label'>Ukupno učesnika</div></div>" +
  "</div></section>"
);

const buildScoreDistributionSection = (dists) => {
  if (!dists || dists.length === 0) return "";
  
  return dists.map((dist) => {
    const data = [
      { label: "0 - 9", value: Number(dist.range_0_9) || 0 },
      { label: "10 - 19", value: Number(dist.range_10_19) || 0 },
      { label: "20 - 29", value: Number(dist.range_20_29) || 0 },
      { label: "30 - 39", value: Number(dist.range_30_39) || 0 },
      { label: "40 - 49", value: Number(dist.range_40_49) || 0 },
      { label: "50 - 59", value: Number(dist.range_50_59) || 0 },
      { label: "60 - 69", value: Number(dist.range_60_69) || 0 },
      { label: "70 - 79", value: Number(dist.range_70_79) || 0 },
      { label: "80 - 89", value: Number(dist.range_80_89) || 0 },
      { label: "90 - 100", value: Number(dist.range_90_100) || 0 },
    ];
    const maxVal = Math.max(...data.map((r) => r.value));
    const rows = data.map((r) => barRow(r.label, r.value, maxVal, PURPLE)).join("");
    return "<section><h2 class='section-title'>Raspodjela bodova: " + labelWithYear(dist.competition_name, dist.year) + "</h2><table class='bar-table'><tbody>" + rows + "</tbody></table></section>";
  }).join("");
};

const buildResultsByCompSection = (resultsByCompetition) => {
  if (!resultsByCompetition?.length) return "";
  const maxAvg = Math.max(...resultsByCompetition.map((r) => Number(r.avg_score)));
  const avgRows = resultsByCompetition.map((r) => barRow(labelWithYear(r.competition_name, r.year), Number(r.avg_score).toFixed(2), maxAvg, ORANGE)).join("");

  const maxPart = Math.max(...resultsByCompetition.map((r) => Number(r.num_participants)));
  const partRows = resultsByCompetition.map((r) => barRow(labelWithYear(r.competition_name, r.year), Number(r.num_participants), maxPart, BLUE)).join("");

  return (
    "<div class='two-col'>" +
    "<section><h2 class='section-title'>Prosjek bodova</h2><table class='bar-table'><tbody>" + avgRows + "</tbody></table></section>" +
    "<section><h2 class='section-title'>Broj učesnika</h2><table class='bar-table'><tbody>" + partRows + "</tbody></table></section>" +
    "</div>"
  );
};

const buildTeamPositionsSection = (teamPositions) => {
  if (!teamPositions?.length) return "";
  const rows = teamPositions.map((r, i) =>
    "<tr class='" + (i % 2 === 0 ? "row-even" : "row-odd") + "'>" +
    "<td class='rank-pos'>" + (r.position || "–") + "</td>" +
    "<td class='rank-name'>" + r.team_name + " <span class='sub-text'>(" + r.faculty_name + ")</span></td>" +
    "<td class='rank-comp'>" + labelWithYear(r.competition_name, r.year) + "</td>" +
    "</tr>"
  ).join("");

  return (
    "<section><h2 class='section-title'>Plasman timova</h2>" +
    "<table class='data-table'><thead><tr><th>#</th><th>Tim (Fakultet)</th><th>Takmičenje</th></tr></thead>" +
    "<tbody>" + rows + "</tbody></table></section>"
  );
};

const buildStatusSection = (competitionStatuses) => {
  if (!competitionStatuses?.length) return "";
  const rows = competitionStatuses.map((c, i) => {
    const solIcon = c.has_solution ? "✅" : "❌";
    const revIcon = c.has_review ? "✅" : "❌";
    return (
      "<tr class='" + (i % 2 === 0 ? "row-even" : "row-odd") + "'>" +
      "<td class='rank-name'>" + labelWithYear(c.competition_name, c.year) + "</td>" +
      "<td style='text-align:center;'>" + solIcon + "</td>" +
      "<td style='text-align:center;'>" + revIcon + "</td>" +
      "</tr>"
    );
  }).join("");

  return (
    "<section><h2 class='section-title'>Status takmičenja</h2>" +
    "<table class='data-table'><thead><tr><th>Takmičenje</th><th style='text-align:center;'>Rješenje</th><th style='text-align:center;'>Termin uvida</th></tr></thead>" +
    "<tbody>" + rows + "</tbody></table></section>"
  );
};

// ─── Full HTML template ───────────────────────────────────────────────────────

const buildHtml = (stats) => {
  const {
    kpiCards = {},
    resultsByCompetition = [],
    scoreDistributions = [],
    teamPositions = [],
    competitionStatuses = [],
  } = stats;

  const now = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const css = (
    "* { box-sizing: border-box; margin: 0; padding: 0; }" +
    "body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 32px 40px; }" +
    ".report-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid " + ORANGE + "; padding-bottom: 14px; margin-bottom: 28px; }" +
    ".report-title { font-size: 20px; font-weight: 800; color: " + ORANGE + "; }" +
    ".report-subtitle { font-size: 12px; color: #666; margin-top: 4px; }" +
    "section { margin-bottom: 32px; page-break-inside: avoid; }" +
    ".section-title { font-size: 14px; font-weight: 700; color: " + ORANGE + "; border-left: 4px solid " + BLUE + "; padding-left: 10px; margin-bottom: 14px; }" +
    ".kpi-grid { display: flex; flex-wrap: wrap; gap: 12px; }" +
    ".kpi-card { flex: 1 1 200px; background: " + LIGHT + "; border-radius: 10px; padding: 14px 16px; text-align: center; border: 1px solid " + BORDER + "; }" +
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
    ".data-table thead tr { background: " + BLUE + "; color: #fff; }" +
    ".data-table th { padding: 8px 10px; font-size: 12px; text-align: left; }" +
    ".data-table td { padding: 7px 10px; font-size: 12px; vertical-align: middle; }" +
    ".row-even { background: " + LIGHT + "; } .row-odd { background: #fff; }" +
    ".rank-pos { font-weight: 800; color: " + ORANGE + "; width: 32px; }" +
    ".rank-name { color: #1a1a2e; font-weight: 600; }" +
    ".sub-text { font-weight: 400; color: #777; font-size: 11px; }" +
    ".rank-comp { color: #555; text-align: right; }" +
    ".two-col { display: flex; gap: 20px; flex-wrap: wrap; }" +
    ".two-col > * { flex: 1 1 300px; }" +
    ".report-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid " + BORDER + "; font-size: 10px; color: #aaa; text-align: center; }"
  );

  return (
    "<!DOCTYPE html><html lang='bs'><head>" +
    "<meta charset='UTF-8'/>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1.0'/>" +
    "<title>Mentorski izvještaj</title>" +
    "<style>" + css + "</style>" +
    "</head><body>" +
    "<div class='report-header'>" +
    "<div><div class='report-title'>Mentorski izvjestaj</div>" +
    "<div class='report-subtitle'>Generisano: " + now + "</div></div>" +
    "</div>" +
    buildKpiSection(kpiCards) +
    buildScoreDistributionSection(scoreDistributions) +
    buildResultsByCompSection(resultsByCompetition) +
    buildTeamPositionsSection(teamPositions) +
    buildStatusSection(competitionStatuses) +
    "<div class='report-footer'>Automatski generisan mentorski izvještaj</div>" +
    "</body></html>"
  );
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const exportMentorStatsPdf = async (stats) => {
  const html = buildHtml(stats);

  if (Platform.OS === "web") {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mentor-izvjestaj.html";
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
        dialogTitle: "Mentorski izvještaj",
        UTI: "com.adobe.pdf",
      });
    } catch (err) {
      console.error("PDF export failed:", err);
      throw err;
    }
  }
};
