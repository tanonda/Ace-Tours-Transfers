import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, MapPin, Calendar, Users, Phone, Mail, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Booking {
  id: string;
  tourName: string;
  customerName: string;
  date: string;
  guests: number;
  amount: string;
  status: string;
}

interface PrintItineraryProps {
  booking: Booking;
  onClose: () => void;
}

export function PrintItinerary({ booking, onClose }: PrintItineraryProps) {
  const { t } = useTranslation();

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Itinerary - ${booking.tourName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              padding: 20px;
            }
            .itinerary-container {
              max-width: 800px;
              margin: 0 auto;
              border: 2px solid #e67e22;
              border-radius: 12px;
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #004165 0%, #006699 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              font-size: 28px;
              margin-bottom: 5px;
            }
            .header p {
              opacity: 0.9;
              font-size: 14px;
            }
            .booking-badge {
              display: inline-block;
              background: #e67e22;
              color: white;
              padding: 8px 20px;
              border-radius: 20px;
              font-weight: bold;
              margin-top: 15px;
            }
            .content {
              padding: 30px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #004165;
              border-bottom: 2px solid #e67e22;
              padding-bottom: 8px;
              margin-bottom: 15px;
            }
            .tour-box {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
            }
            .tour-title {
              font-size: 20px;
              font-weight: bold;
              color: #333;
              margin-bottom: 8px;
            }
            .tour-desc {
              color: #666;
              font-size: 14px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 16px;
              font-weight: 600;
              color: #333;
            }
            .total-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 20px;
            }
            .total-label {
              font-size: 16px;
              color: #666;
            }
            .total-amount {
              font-size: 28px;
              font-weight: bold;
              color: #004165;
            }
            .notes {
              background: #fff9e6;
              border-left: 4px solid #e67e22;
              padding: 15px;
              margin-top: 20px;
              border-radius: 0 8px 8px 0;
            }
            .notes h4 {
              color: #e67e22;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .notes ul {
              margin-left: 20px;
              font-size: 14px;
              color: #555;
            }
            .notes li {
              margin-bottom: 5px;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px 30px;
              text-align: center;
              border-top: 1px solid #eee;
            }
            .contact-info {
              display: flex;
              justify-content: center;
              gap: 40px;
              margin-bottom: 10px;
            }
            .contact-item {
              font-size: 14px;
              color: #333;
            }
            .footer-note {
              font-size: 12px;
              color: #666;
              margin-top: 10px;
              font-style: italic;
            }
            @media print {
              body { padding: 0; }
              .itinerary-container { border: 1px solid #ddd; }
            }
          </style>
        </head>
        <body>
          <div class="itinerary-container">
            <div class="header">
              <h1>Ace Tours & Transfers</h1>
              <p>Port Vila, Vanuatu</p>
              <div class="booking-badge">
                ${t("itinerary.confirmationNumber", "Confirmation")}: #${booking.id?.slice(0, 8).toUpperCase()}
              </div>
            </div>
            
            <div class="content">
              <div class="section">
                <div class="section-title">${t("itinerary.tourDetails", "Tour Details")}</div>
                <div class="tour-box">
                  <div class="tour-title">${booking.tourName}</div>
                  <div class="tour-desc">${t("itinerary.tourDescription", "Experience the beauty of Vanuatu with our expertly guided tour.")}</div>
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">${t("itinerary.bookingInfo", "Booking Information")}</div>
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">${t("booking.customer")}</div>
                    <div class="info-value">${booking.customerName}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">${t("booking.date")}</div>
                    <div class="info-value">${booking.date}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">${t("booking.guests")}</div>
                    <div class="info-value">${booking.guests} ${t("itinerary.travelers", "Travelers")}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">${t("booking.status")}</div>
                    <div class="info-value" style="text-transform: capitalize;">${booking.status}</div>
                  </div>
                </div>
              </div>
              
              <div class="total-section">
                <span class="total-label">${t("itinerary.totalAmount", "Total Amount")}</span>
                <span class="total-amount">${booking.amount}</span>
              </div>
              
              <div class="notes">
                <h4>${t("itinerary.importantNotes", "Important Notes")}</h4>
                <ul>
                  <li>${t("itinerary.note1", "Please arrive 15 minutes before your scheduled pickup time")}</li>
                  <li>${t("itinerary.note2", "Bring comfortable walking shoes and sun protection")}</li>
                  <li>${t("itinerary.note3", "Water and light refreshments are provided")}</li>
                  <li>${t("itinerary.note4", "Present this itinerary upon arrival for check-in")}</li>
                </ul>
              </div>
            </div>
            
            <div class="footer">
              <div class="contact-info">
                <span class="contact-item">📞 7114045 / 7342389</span>
                <span class="contact-item">✉️ acetoursvanuatu@outlook.com</span>
              </div>
              <p class="footer-note">${t("itinerary.footerNote", "Thank you for choosing Ace Tours & Transfers. Have a wonderful trip!")}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {t("itinerary.title", "Travel Itinerary")}
          </DialogTitle>
        </DialogHeader>

        <div className="itinerary-container">
          <div className="header bg-gradient-to-r from-[#004165] to-[#006699] text-white p-6 text-center rounded-t-lg">
            <h1 className="text-2xl font-bold mb-1">Ace Tours & Transfers</h1>
            <p className="text-white/80 text-sm">Port Vila, Vanuatu</p>
            <div className="booking-badge inline-block bg-primary text-white px-4 py-2 rounded-full font-bold mt-3">
              {t("itinerary.confirmationNumber", "Confirmation")}: #{booking.id?.slice(0, 8).toUpperCase()}
            </div>
          </div>

          <div className="content p-6 space-y-6">
            <div className="section">
              <h3 className="section-title text-lg font-bold text-[#004165] border-b-2 border-primary pb-2 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {t("itinerary.tourDetails", "Tour Details")}
              </h3>
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-xl font-bold text-foreground mb-2">{booking.tourName}</h4>
                <p className="text-muted-foreground text-sm">
                  {t("itinerary.tourDescription", "Experience the beauty of Vanuatu with our expertly guided tour.")}
                </p>
              </div>
            </div>

            <div className="section">
              <h3 className="section-title text-lg font-bold text-[#004165] border-b-2 border-primary pb-2 mb-4">
                {t("itinerary.bookingInfo", "Booking Information")}
              </h3>
              <div className="info-grid grid grid-cols-2 gap-4">
                <div className="info-item flex items-start gap-3">
                  <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="info-label text-xs text-muted-foreground uppercase">{t("booking.customer")}</div>
                    <div className="info-value font-semibold">{booking.customerName}</div>
                  </div>
                </div>
                <div className="info-item flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="info-label text-xs text-muted-foreground uppercase">{t("booking.date")}</div>
                    <div className="info-value font-semibold">{booking.date}</div>
                  </div>
                </div>
                <div className="info-item flex items-start gap-3">
                  <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="info-label text-xs text-muted-foreground uppercase">{t("booking.guests")}</div>
                    <div className="info-value font-semibold">{booking.guests} {t("itinerary.travelers", "Travelers")}</div>
                  </div>
                </div>
                <div className="info-item flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="info-label text-xs text-muted-foreground uppercase">{t("booking.status")}</div>
                    <div className="info-value font-semibold capitalize">{booking.status}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="total-section bg-muted/30 p-5 rounded-lg flex justify-between items-center">
              <span className="total-label text-muted-foreground">{t("itinerary.totalAmount", "Total Amount")}</span>
              <span className="total-amount text-2xl font-bold text-[#004165]">{booking.amount}</span>
            </div>

            <div className="notes bg-amber-50 dark:bg-amber-900/20 border-l-4 border-primary p-4 rounded-r-lg">
              <h4 className="text-primary font-semibold mb-2">{t("itinerary.importantNotes", "Important Notes")}</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>{t("itinerary.note1", "Please arrive 15 minutes before your scheduled pickup time")}</li>
                <li>{t("itinerary.note2", "Bring comfortable walking shoes and sun protection")}</li>
                <li>{t("itinerary.note3", "Water and light refreshments are provided")}</li>
                <li>{t("itinerary.note4", "Present this itinerary upon arrival for check-in")}</li>
              </ul>
            </div>
          </div>

          <div className="footer bg-muted/30 p-5 text-center border-t">
            <div className="contact-info flex justify-center gap-8 mb-3">
              <div className="contact-item flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary" />
                <span>7114045 / 7342389</span>
              </div>
              <div className="contact-item flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary" />
                <span>acetoursvanuatu@outlook.com</span>
              </div>
            </div>
            <p className="footer-note text-xs text-muted-foreground">
              {t("itinerary.footerNote", "Thank you for choosing Ace Tours & Transfers. Have a wonderful trip!")}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            data-testid="button-print-itinerary" 
            onClick={handlePrint} 
            className="flex-1 bg-[#004165] hover:bg-[#003050]"
          >
            <Printer className="h-4 w-4 mr-2" />
            {t("itinerary.print", "Print Itinerary")}
          </Button>
          <Button 
            data-testid="button-close-itinerary" 
            variant="outline" 
            onClick={onClose} 
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            {t("dashboard.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
