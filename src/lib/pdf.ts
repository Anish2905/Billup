import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures an HTML element as canvas and converts it directly to a PDF download.
 * Ensures the result is mapped perfectly onto A4 paper size.
 */
export async function exportToPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  // A4 dimensions in mm
  const a4Width = 210;
  const a4Height = 297;

  try {
    const canvas = await html2canvas(element, {
      scale: 3, // High resolution for text crispness comparable to Tally
      useCORS: true, 
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    // PDF orientation based on canvas proportion (usually P for portrait invoice)
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

    const pxWidth = canvas.width;
    const pxHeight = canvas.height;
    
    // Calculate aspect ratio
    const ratio = pxHeight / pxWidth;
    
    // Scale image to fit A4 width
    const pdfImgWidth = a4Width;
    const pdfImgHeight = a4Width * ratio;

    // Check if the content exceeds one page height. 
    // Usually Tally invoices are 1 page for small quantities, but we do basic pagination if needed.
    let heightLeft = pdfImgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
    heightLeft -= a4Height;

    while (heightLeft >= 0) {
      position = heightLeft - pdfImgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
      heightLeft -= a4Height;
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Failed to generate PDF', error);
    throw error;
  }
}
