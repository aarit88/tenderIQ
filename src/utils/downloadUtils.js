export const downloadBlob = (content, filename, contentType) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateAuditCSV = (logs) => {
  const header = 'Timestamp,User,Action,Entity,Details,Type\n';
  const rows = logs.map(log => 
    `"${log.timestamp}","${log.user}","${log.action}","${log.entity}","${log.details}","${log.type}"`
  ).join('\n');
  return header + rows;
};

export const generateEvaluationReport = (bidder, evaluations) => {
  let report = `CRPF OFFICIAL EVALUATION REPORT\n`;
  report += `================================\n\n`;
  report += `BIDDER: ${bidder.name}\n`;
  report += `TENDER: CRPF-CONST-2024\n`;
  report += `DATE: ${new Date().toLocaleDateString()}\n`;
  report += `OVERALL STATUS: ${bidder.match_score >= 80 ? 'ELIGIBLE' : 'REVIEW REQUIRED'}\n\n`;
  report += `CRITERIA BREAKDOWN:\n`;
  report += `-------------------\n`;
  
  evaluations.forEach(ev => {
    report += `[${ev.verdict.toUpperCase()}] ${ev.criterion_id}\n`;
    report += `Reasoning: ${ev.reasoning}\n`;
    report += `Extracted Value: ${ev.extracted_value}\n`;
    report += `Source: Page ${ev.source_page}\n\n`;
  });
  
  report += `\nDIGITALLY SIGNED BY CRPF EVALUATION SYSTEM\n`;
  return report;
};
