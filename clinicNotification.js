function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function fieldRow(label, value) {
  return `<tr>
    <th scope="row" style="padding:10px 14px;text-align:left;vertical-align:top;width:140px;color:#52606a;font-size:13px;font-weight:600;border-bottom:1px solid #e8ecec;">${label}</th>
    <td style="padding:10px 14px;vertical-align:top;color:#193543;font-size:14px;line-height:1.5;border-bottom:1px solid #e8ecec;">${escapeHtml(value)}</td>
  </tr>`;
}

export function buildClinicNotification(appointment, sender) {
  const preferredDate = appointment.date instanceof Date
    ? appointment.date.toISOString().slice(0, 10)
    : appointment.date;
  const message = appointment.message || 'None provided';
  const htmlMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');

  return {
    from: `"EMIS Dental" <${sender}>`,
    to: 'emisconsultation@emisdental.com',
    replyTo: appointment.email,
    subject: 'New appointment request | EMIS Dental',
    text: `NEW APPOINTMENT REQUEST

PATIENT CONTACT
Name: ${appointment.name}
Email: ${appointment.email}
Phone: ${appointment.phone}

REQUEST DETAILS
Preferred date: ${preferredDate}
Service: ${appointment.service}

MESSAGE AND PREFERENCES
${message}

The clinic should contact the patient to confirm an appointment time.`,
    html: `<html><body style="margin:0;padding:24px;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e1e7e5;border-radius:12px;">
        <tr><td style="padding:28px;">
          <p style="margin:0 0 8px;color:#8b6b2e;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">EMIS Dental</p>
          <h1 style="margin:0 0 8px;color:#193543;font-size:24px;line-height:1.25;">New appointment request</h1>
          <p style="margin:0 0 26px;color:#52606a;font-size:14px;line-height:1.5;">Contact the patient to confirm an appointment time.</p>

          <h2 style="margin:0 0 10px;color:#193543;font-size:16px;">Patient contact</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${fieldRow('Name', appointment.name)}
            ${fieldRow('Email', appointment.email)}
            ${fieldRow('Phone', appointment.phone)}
          </table>

          <h2 style="margin:0 0 10px;color:#193543;font-size:16px;">Request details</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${fieldRow('Preferred date', preferredDate)}
            ${fieldRow('Service', appointment.service)}
          </table>

          <h2 style="margin:0 0 10px;color:#193543;font-size:16px;">Message and preferences</h2>
          <div style="padding:14px;background:#f7f9f8;border:1px solid #e1e7e5;border-radius:8px;color:#193543;font-size:14px;line-height:1.6;overflow-wrap:anywhere;">${htmlMessage}</div>
        </td></tr>
      </table>
    </body></html>`,
  };
}
