import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const exportDashboardPDF = async (elementId = 'dashboard-container', filename = 'WebGuard_Security_Report.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0B0F17',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

    const targetWidth = imgWidth * ratio;
    const targetHeight = imgHeight * ratio;
    const marginX = (pdfWidth - targetWidth) / 2;
    const marginY = (pdfHeight - targetHeight) / 2;

    pdf.addImage(imgData, 'PNG', marginX, marginY, targetWidth, targetHeight);
    pdf.save(filename);
  } catch (error) {
    console.error('Exporting PDF failed:', error);
    throw error;
  }
};
